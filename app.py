import datetime
import os
import json
import shutil
import hashlib
from flask import Flask, render_template, request, jsonify, send_from_directory
from waitress import serve
from werkzeug.utils import secure_filename
from config import Config

# Make the template folder explicit to avoid path issues
template_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'templates')
static_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'static')
app = Flask(__name__, 
            template_folder=template_dir,
            static_folder=static_dir)
app.config.from_object(Config)

# Ensure work directories exist
os.makedirs(os.path.join(app.config['WORK_DIR']), exist_ok=True)
os.makedirs(os.path.join(app.config['WORK_DIR'], 'documents'), exist_ok=True)
os.makedirs(os.path.join(app.config['WORK_DIR'], 'attachments'), exist_ok=True)

def calculate_md5(file_path):
    """Calculate MD5 hash of a file."""
    hash_md5 = hashlib.md5()
    with open(file_path, "rb") as f:
        for chunk in iter(lambda: f.read(4096), b""):
            hash_md5.update(chunk)
    return hash_md5.hexdigest()

def get_image_hash_mapping(directory):
    """Get or create the image hash mapping file."""
    map_file = os.path.join(directory, 'image_hashes.json')
    if os.path.exists(map_file):
        with open(map_file, 'r') as f:
            return json.load(f)
    else:
        # Initialize with existing files
        hash_map = {}
        for filename in os.listdir(directory):
            if os.path.isfile(os.path.join(directory, filename)) and not filename.endswith('.json'):
                file_path = os.path.join(directory, filename)
                file_hash = calculate_md5(file_path)
                hash_map[file_hash] = filename
        
        # Save the initial mapping
        with open(map_file, 'w') as f:
            json.dump(hash_map, f, indent=2)
        
        return hash_map

def save_hash_mapping(directory, hash_map):
    """Save the hash mapping to file."""
    map_file = os.path.join(directory, 'image_hashes.json')
    with open(map_file, 'w') as f:
        json.dump(hash_map, f, indent=2)

@app.route('/')
def index():
    """Render the main application page."""
    return render_template('index.html')

@app.route('/api/files', methods=['GET'])
def list_files():
    """List all files in the documents directory."""
    documents_dir = os.path.join(app.config['WORK_DIR'], 'documents')
    file_list = []
    
    try:
        for root, dirs, files in os.walk(documents_dir):
            # Get relative path from documents directory
            rel_path = os.path.relpath(root, documents_dir)
            
            # Skip the root dir in the path string
            if rel_path == '.':
                rel_path = ''
                
            # Add directories
            for directory in dirs:
                dir_path = os.path.join(rel_path, directory) if rel_path else directory
                # Use forward slashes for consistency across platforms
                dir_path = dir_path.replace('\\', '/')
                file_list.append({
                    'type': 'directory',
                    'name': directory,
                    'path': dir_path
                })
                
            # Add files
            for file in files:
                if file.endswith('.md'):
                    file_path = os.path.join(rel_path, file) if rel_path else file
                    # Use forward slashes for consistency
                    file_path = file_path.replace('\\', '/')
                    file_list.append({
                        'type': 'file',
                        'name': file,
                        'path': file_path
                    })
        
        return jsonify(file_list)
    except Exception as e:
        app.logger.error(f"Error listing files: {str(e)}")
        return jsonify({'error': f"Failed to list files: {str(e)}"}), 500

@app.route('/api/file', methods=['GET'])
def get_file():
    """Get the content of a markdown file."""
    file_path = request.args.get('path', '')
    
    # Basic path validation but preserving directory structure
    if '..' in file_path or file_path.startswith('/'):
        return jsonify({'error': 'Invalid file path'}), 400
    
    full_path = os.path.join(app.config['WORK_DIR'], 'documents', file_path)
    
    if not os.path.exists(full_path) or not file_path.endswith('.md'):
        return jsonify({'error': 'File not found'}), 404
    
    try:
        with open(full_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # Get the associated JSON file if it exists
        json_path = full_path.replace('.md', '.json')
        if os.path.exists(json_path):
            with open(json_path, 'r', encoding='utf-8') as f:
                format_options = json.load(f)
        else:
            format_options = app.config['DEFAULT_FORMAT_OPTIONS']
        
        return jsonify({
            'content': content,
            'formatOptions': format_options
        })
    except Exception as e:
        app.logger.error(f"Error reading file {file_path}: {str(e)}")
        return jsonify({'error': f"Failed to read file: {str(e)}"}), 500

@app.route('/api/file', methods=['POST'])
def save_file():
    """Save or update a markdown file."""
    data = request.json
    file_path = data.get('path', '')
    content = data.get('content', '')
    format_options = data.get('formatOptions', app.config['DEFAULT_FORMAT_OPTIONS'])
    
    # Custom path handling for subfolders
    if '/' in file_path:
        # Split path into directory and filename parts
        path_parts = file_path.split('/')
        filename = path_parts[-1]  # Last part is the filename
        dir_parts = path_parts[:-1]  # All earlier parts form the directory path
        
        # Apply secure_filename only to the individual components, not the whole path
        secure_dirs = []
        for part in dir_parts:
            # Only basic sanitization for directory names, preserve the structure
            secure_part = part.replace('..', '').strip()
            if secure_part:  # Skip empty parts
                secure_dirs.append(secure_part)
        
        # Apply secure_filename to the actual filename
        secure_file = secure_filename(filename)
        
        # Reconstruct the path
        file_path = '/'.join(secure_dirs + [secure_file])
    else:
        # Just the filename, no directories
        file_path = secure_filename(file_path)
    
    # Ensure .md extension
    if not file_path.endswith('.md'):
        file_path += '.md'
    
    full_path = os.path.join(app.config['WORK_DIR'], 'documents', file_path)
    
    # Ensure directory exists
    os.makedirs(os.path.dirname(full_path), exist_ok=True)
    
    try:
        with open(full_path, 'w', encoding='utf-8') as f:
            f.write(content)
        
        # Save format options to JSON file
        json_path = full_path.replace('.md', '.json')
        with open(json_path, 'w', encoding='utf-8') as f:
            json.dump(format_options, f, indent=2)
        
        return jsonify({'success': True})
    except Exception as e:
        app.logger.error(f"Error saving file {file_path}: {str(e)}")
        return jsonify({'error': f"Failed to save file: {str(e)}"}), 500

@app.route('/api/file', methods=['DELETE'])
def delete_file():
    """Delete a markdown file and its associated JSON file."""
    file_path = request.args.get('path', '')
    full_path = os.path.join(app.config['WORK_DIR'], 'documents', file_path)
    
    if not os.path.exists(full_path):
        return jsonify({'error': 'File not found'}), 404
    
    # Delete the markdown file
    os.remove(full_path)
    
    # Delete the associated JSON file if it exists
    json_path = full_path.replace('.md', '.json')
    if os.path.exists(json_path):
        os.remove(json_path)
    
    return jsonify({'success': True})

@app.route('/api/directory', methods=['POST'])
def create_directory():
    """Create a new directory."""
    data = request.json
    dir_path = data.get('path', '')
    
    # Custom path handling for nested directories
    if '/' in dir_path:
        # Split into parts
        path_parts = dir_path.split('/')
        
        # Apply basic sanitization to each part
        secure_dirs = []
        for part in path_parts:
            # Only basic sanitization for directory names
            secure_part = part.replace('..', '').strip()
            if secure_part:  # Skip empty parts
                secure_dirs.append(secure_part)
        
        # Reconstruct the path
        dir_path = '/'.join(secure_dirs)
    else:
        # Just a single directory name, basic sanitization
        dir_path = dir_path.replace('..', '').strip()
    
    full_path = os.path.join(app.config['WORK_DIR'], 'documents', dir_path)
    
    try:
        os.makedirs(full_path, exist_ok=True)
        return jsonify({'success': True})
    except Exception as e:
        app.logger.error(f"Error creating directory {dir_path}: {str(e)}")
        return jsonify({'error': f"Failed to create directory: {str(e)}"}), 500

@app.route('/api/directory', methods=['DELETE'])
def delete_directory():
    """Delete a directory and all its contents."""
    dir_path = request.args.get('path', '')
    full_path = os.path.join(app.config['WORK_DIR'], 'documents', dir_path)
    
    if not os.path.exists(full_path) or not os.path.isdir(full_path):
        return jsonify({'error': 'Directory not found'}), 404
    
    shutil.rmtree(full_path)
    
    return jsonify({'success': True})

@app.route('/api/upload', methods=['POST'])
def upload_attachment():
    """Upload an attachment file with MD5 hash checking for duplicates."""
    if 'file' not in request.files:
        return jsonify({'error': 'No file part'}), 400
    
    file = request.files['file']
    
    if file.filename == '':
        return jsonify({'error': 'No selected file'}), 400
    
    # Create a temporary file to calculate hash
    temp_path = os.path.join(app.config['WORK_DIR'], 'temp_upload')
    file.save(temp_path)
    
    # Calculate MD5 hash
    file_hash = calculate_md5(temp_path)
    
    # Get the attachment directory
    attachments_dir = os.path.join(app.config['WORK_DIR'], 'attachments')
    
    # Load hash mapping
    hash_map = get_image_hash_mapping(attachments_dir)
    
    # Check if this hash already exists
    if file_hash in hash_map:
        # File already exists, use the existing one
        filename = hash_map[file_hash]
        # Remove the temporary file
        os.remove(temp_path)
        
        return jsonify({
            'success': True,
            'filename': filename,
            'url': f'/attachment/{filename}',
            'duplicate': True
        })
    
    # This is a new file, generate a filename based on hash
    file_ext = os.path.splitext(file.filename)[1].lower()
    if not file_ext:
        # Default to .png for images without extension
        file_ext = '.png'
    
    hash_filename = f"{file_hash}{file_ext}"
    file_path = os.path.join(attachments_dir, hash_filename)
    
    # Move the temp file to the final location
    os.rename(temp_path, file_path)
    
    # Update the hash mapping
    hash_map[file_hash] = hash_filename
    save_hash_mapping(attachments_dir, hash_map)
    
    return jsonify({
        'success': True,
        'filename': hash_filename,
        'url': f'/attachment/{hash_filename}',
        'duplicate': False
    })

@app.route('/attachment/<path:filename>')
def get_attachment(filename):
    """Serve an attachment file."""
    return send_from_directory(os.path.join(app.config['WORK_DIR'], 'attachments'), filename)

@app.route('/api/file/rename', methods=['POST'])
def rename_file():
    """Rename a file or move it to a different directory."""
    data = request.json
    old_path = data.get('oldPath', '')
    new_path = data.get('newPath', '')
    
    # Basic validation
    if not old_path or not new_path:
        return jsonify({'error': 'Both old and new paths must be provided'}), 400
    
    if '..' in old_path or '..' in new_path:
        return jsonify({'error': 'Invalid path'}), 400
    
    # Ensure the new path ends with .md if the old one did
    if old_path.endswith('.md') and not new_path.endswith('.md'):
        new_path += '.md'
    
    # Full paths
    old_full_path = os.path.join(app.config['WORK_DIR'], 'documents', old_path)
    new_full_path = os.path.join(app.config['WORK_DIR'], 'documents', new_path)
    
    # Check if source exists
    if not os.path.exists(old_full_path):
        return jsonify({'error': 'Source file not found'}), 404
    
    # Check if destination already exists
    if os.path.exists(new_full_path):
        return jsonify({'error': 'A file with the new name already exists'}), 409
    
    try:
        # Create the target directory if it doesn't exist
        os.makedirs(os.path.dirname(new_full_path), exist_ok=True)
        
        # Move/rename the file
        shutil.move(old_full_path, new_full_path)
        
        # Also move the format options JSON file if it exists
        old_json_path = old_full_path.replace('.md', '.json')
        new_json_path = new_full_path.replace('.md', '.json')
        
        if os.path.exists(old_json_path):
            shutil.move(old_json_path, new_json_path)
        
        return jsonify({'success': True})
    except Exception as e:
        app.logger.error(f"Error renaming file from {old_path} to {new_path}: {str(e)}")
        return jsonify({'error': f"Failed to rename file: {str(e)}"}), 500

@app.route('/api/directory/rename', methods=['POST'])
def rename_directory():
    """Rename a directory or move it to a different location."""
    data = request.json
    old_path = data.get('oldPath', '')
    new_path = data.get('newPath', '')
    
    # Basic validation
    if not old_path or not new_path:
        return jsonify({'error': 'Both old and new paths must be provided'}), 400
    
    if '..' in old_path or '..' in new_path:
        return jsonify({'error': 'Invalid path'}), 400
    
    # Full paths
    old_full_path = os.path.join(app.config['WORK_DIR'], 'documents', old_path)
    new_full_path = os.path.join(app.config['WORK_DIR'], 'documents', new_path)
    
    # Check if source exists
    if not os.path.exists(old_full_path) or not os.path.isdir(old_full_path):
        return jsonify({'error': 'Source directory not found'}), 404
    
    # Check if destination already exists
    if os.path.exists(new_full_path):
        return jsonify({'error': 'A directory with the new name already exists'}), 409
    
    try:
        # Create the parent directory structure if needed
        parent_dir = os.path.dirname(new_full_path)
        if parent_dir:
            os.makedirs(parent_dir, exist_ok=True)
        
        # Move/rename the directory
        shutil.move(old_full_path, new_full_path)
        
        return jsonify({'success': True})
    except Exception as e:
        app.logger.error(f"Error renaming directory from {old_path} to {new_path}: {str(e)}")
        return jsonify({'error': f"Failed to rename directory: {str(e)}"}), 500

if __name__ == '__main__':
    # app.run(debug=True)
    serve(app, host='0.0.0.0', port='5000')
