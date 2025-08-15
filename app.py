import os
import json
import shutil
import hashlib
import uuid
import time
import sqlite3
from contextlib import contextmanager
from datetime import datetime, timedelta
from flask import Flask, render_template, request, jsonify, send_from_directory
from waitress import serve
from werkzeug.utils import secure_filename
from config import Config
from auth import requires_auth, load_users, authenticate, add_user, delete_user, update_user_password, get_users

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

# File lock helper functions
def init_lock_db():
    """Initialize the locks database."""
    with get_lock_db() as conn:
        cursor = conn.cursor()
        # Create locks table if it doesn't exist
        cursor.execute('''
        CREATE TABLE IF NOT EXISTS file_locks (
            file_path TEXT PRIMARY KEY,
            session_id TEXT NOT NULL,
            timestamp TEXT NOT NULL,
            created_at TEXT NOT NULL
        )
        ''')

        # On server startup, clear all existing locks
        # This ensures no stale locks remain after a server restart
        try:
            cursor.execute("DELETE FROM file_locks")
            deleted_count = cursor.rowcount
            app.logger.info(f"Cleared {deleted_count} locks on server startup")
        except Exception as e:
            app.logger.error(f"Error clearing locks on startup: {e}")

        conn.commit()

@contextmanager
def get_lock_db():
    """Context manager for database connections."""
    db_path = os.path.join(app.config['WORK_DIR'], 'locks.db')
    conn = None
    try:
        conn = sqlite3.connect(db_path, timeout=10.0)  # 10-second timeout
        yield conn
    finally:
        if conn:
            conn.close()

def sqlite_acquire_lock(file_path, session_id):
    """
    Attempt to acquire a lock on a file using SQLite.
    Returns (success, owner, message)
    """
    now = datetime.now().isoformat()
    
    with get_lock_db() as conn:
        cursor = conn.cursor()
        
        # Check if lock exists and is valid
        cursor.execute(
            "SELECT session_id, timestamp FROM file_locks WHERE file_path = ?", 
            (file_path,)
        )
        lock_record = cursor.fetchone()
        
        if lock_record:
            lock_owner, lock_time_str = lock_record
            try:
                lock_time = datetime.fromisoformat(lock_time_str)
                # Check if lock is expired (older than 10 minutes)
                if datetime.now() - lock_time > timedelta(minutes=10):
                    # Lock is expired, update it
                    cursor.execute(
                        "UPDATE file_locks SET session_id = ?, timestamp = ? WHERE file_path = ?",
                        (session_id, now, file_path)
                    )
                    conn.commit()
                    return True, session_id, "Expired lock taken over"
                elif lock_owner == session_id:
                    # Session already has the lock, refresh timestamp
                    cursor.execute(
                        "UPDATE file_locks SET timestamp = ? WHERE file_path = ?",
                        (now, file_path)
                    )
                    conn.commit()
                    return True, session_id, "Lock refreshed"
                else:
                    # File is locked by another session
                    return False, lock_owner, f"File is locked by another session since {lock_time.strftime('%H:%M:%S')}"
            except Exception as e:
                app.logger.error(f"Error parsing lock timestamp: {e}")
                # If timestamp is invalid, take over the lock
                cursor.execute(
                    "UPDATE file_locks SET session_id = ?, timestamp = ? WHERE file_path = ?",
                    (session_id, now, file_path)
                )
                conn.commit()
                return True, session_id, "Invalid lock taken over"
        
        # No lock exists, create one
        try:
            cursor.execute(
                "INSERT INTO file_locks (file_path, session_id, timestamp, created_at) VALUES (?, ?, ?, ?)",
                (file_path, session_id, now, now)
            )
            conn.commit()
            return True, session_id, "Lock acquired"
        except sqlite3.IntegrityError:
            # Race condition - another process created the lock between our check and insert
            # Try the update approach instead
            try:
                cursor.execute(
                    "UPDATE file_locks SET session_id = ?, timestamp = ? WHERE file_path = ?",
                    (session_id, now, file_path)
                )
                conn.commit()
                return True, session_id, "Lock acquired (update)"
            except Exception as e:
                app.logger.error(f"Error acquiring lock via update: {e}")
                return False, None, f"Failed to acquire lock: {str(e)}"
        except Exception as e:
            app.logger.error(f"Error acquiring lock: {e}")
            return False, None, f"Failed to acquire lock: {str(e)}"

def sqlite_release_lock(file_path, session_id):
    """
    Release a lock on a file using SQLite.
    Returns (success, message)
    """
    with get_lock_db() as conn:
        cursor = conn.cursor()
        
        # Check if lock exists and is owned by this session
        cursor.execute(
            "SELECT session_id FROM file_locks WHERE file_path = ?", 
            (file_path,)
        )
        lock_record = cursor.fetchone()
        
        if not lock_record:
            return True, "No lock to release"
        
        lock_owner = lock_record[0]
        
        # Only the owner can release the lock
        if lock_owner == session_id:
            try:
                cursor.execute(
                    "DELETE FROM file_locks WHERE file_path = ?",
                    (file_path,)
                )
                conn.commit()
                return True, "Lock released"
            except Exception as e:
                app.logger.error(f"Error releasing lock: {e}")
                return False, f"Failed to release lock: {str(e)}"
        else:
            return False, "Cannot release lock owned by another session"

def sqlite_check_lock_status(file_path):
    """
    Check if a file is locked and by whom using SQLite.
    Returns (is_locked, owner, timestamp, is_expired)
    """
    with get_lock_db() as conn:
        cursor = conn.cursor()
        
        cursor.execute(
            "SELECT session_id, timestamp FROM file_locks WHERE file_path = ?", 
            (file_path,)
        )
        lock_record = cursor.fetchone()
        
        if not lock_record:
            return False, None, None, False
        
        lock_owner, lock_time_str = lock_record
        
        try:
            lock_time = datetime.fromisoformat(lock_time_str)
            is_expired = datetime.now() - lock_time > timedelta(minutes=10)
            
            return True, lock_owner, lock_time_str, is_expired
        except Exception as e:
            app.logger.error(f"Error checking lock status: {e}")
            return True, lock_owner, lock_time_str, True  # Consider invalid timestamp as expired

def sqlite_get_all_locks():
    """
    Get all active locks in the system using SQLite.
    """
    locks = []
    
    with get_lock_db() as conn:
        cursor = conn.cursor()
        
        # Get all non-expired locks
        thirty_mins_ago = (datetime.now() - timedelta(minutes=10)).isoformat()
        
        cursor.execute(
            "SELECT file_path, session_id, timestamp FROM file_locks WHERE timestamp > ?",
            (thirty_mins_ago,)
        )
        
        for file_path, session_id, timestamp in cursor.fetchall():
            locks.append({
                'filePath': file_path,
                'sessionId': session_id,
                'timestamp': timestamp
            })
    
    return locks

def sqlite_cleanup_expired_locks():
    """
    Clean up expired locks in the database.
    """
    with get_lock_db() as conn:
        cursor = conn.cursor()
        
        # Delete locks older than 30 minutes
        thirty_mins_ago = (datetime.now() - timedelta(minutes=10)).isoformat()
        
        cursor.execute(
            "DELETE FROM file_locks WHERE timestamp < ?",
            (thirty_mins_ago,)
        )
        
        conn.commit()
        
        return cursor.rowcount  # Return number of deleted locks

# Initialize the database on startup
init_lock_db()

# Setup a periodic cleanup task
def setup_lock_cleanup():
    """Setup periodic cleanup of expired locks."""
    import threading
    
    def cleanup_task():
        while True:
            try:
                deleted = sqlite_cleanup_expired_locks()
                app.logger.info(f"Cleanup task removed {deleted} expired locks")
            except Exception as e:
                app.logger.error(f"Error in cleanup task: {e}")
            
            # Sleep for 15 minutes
            time.sleep(15 * 60)
    
    # Start the cleanup thread
    cleanup_thread = threading.Thread(target=cleanup_task, daemon=True)
    cleanup_thread.start()

# Start the cleanup task in a separate thread
# Need to make sure this works with Waitress
if os.environ.get('WERKZEUG_RUN_MAIN') != 'true':  # Avoid duplicate in reloader
    setup_lock_cleanup()

# Replace the existing lock functions with the SQLite versions
acquire_lock = sqlite_acquire_lock
release_lock = sqlite_release_lock
check_lock_status = sqlite_check_lock_status

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
    """Get the content of a markdown file and check lock status."""
    file_path = request.args.get('path', '')
    session_id = request.args.get('session_id', '')
    
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
        
        # Check lock status
        is_locked, lock_owner, lock_time, is_expired = check_lock_status(file_path)
        
        # If session_id is provided, try to acquire the lock
        lock_success = False
        lock_message = ""
        if session_id:
            lock_success, _, lock_message = acquire_lock(file_path, session_id)
        
        return jsonify({
            'content': content,
            'formatOptions': format_options,
            'lockStatus': {
                'isLocked': is_locked,
                'lockOwner': lock_owner,
                'lockTime': lock_time,
                'isExpired': is_expired,
                'lockSuccess': lock_success,
                'lockMessage': lock_message
            }
        })
    except Exception as e:
        app.logger.error(f"Error reading file {file_path}: {str(e)}")
        return jsonify({'error': f"Failed to read file: {str(e)}"}), 500

@app.route('/api/file', methods=['POST'])
@requires_auth
def save_file():
    """Save or update a markdown file with lock checking."""
    data = request.json
    file_path = data.get('path', '')
    content = data.get('content', '')
    format_options = data.get('formatOptions', app.config['DEFAULT_FORMAT_OPTIONS'])
    session_id = data.get('session_id', '')
    force_save = data.get('force_save', False)  # Option to force save and override locks
    
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
    
    # Check lock status if not forcing save
    if not force_save and session_id:
        is_locked, lock_owner, lock_time, is_expired = check_lock_status(file_path)
        
        if is_locked and not is_expired and lock_owner != session_id:
            return jsonify({
                'success': False,
                'error': 'File is locked by another session',
                'lockStatus': {
                    'isLocked': True,
                    'lockOwner': lock_owner,
                    'lockTime': lock_time,
                    'isExpired': is_expired
                }
            }), 423  # 423 Locked
    
    # Acquire or refresh the lock if session_id is provided
    if session_id:
        lock_success, _, lock_message = acquire_lock(file_path, session_id)
        if not lock_success and not force_save:
            return jsonify({
                'success': False,
                'error': lock_message
            }), 423  # 423 Locked
    
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
@requires_auth
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
@requires_auth
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
@requires_auth
def delete_directory():
    """Delete a directory and all its contents."""
    dir_path = request.args.get('path', '')
    full_path = os.path.join(app.config['WORK_DIR'], 'documents', dir_path)
    
    if not os.path.exists(full_path) or not os.path.isdir(full_path):
        return jsonify({'error': 'Directory not found'}), 404
    
    shutil.rmtree(full_path)
    
    return jsonify({'success': True})

@app.route('/api/upload', methods=['POST'])
@requires_auth
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
@requires_auth
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
@requires_auth
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

# ===== User Authentication API Routes =====

@app.route('/api/auth/check', methods=['GET'])
def check_auth():
    """Check if authentication is required and if provided credentials are valid."""
    # Check if authentication is required (users exist)
    auth_required = len(load_users()) > 0
    
    # Check credentials if provided
    valid_credentials = False
    auth = request.headers.get('Authorization')
    
    if auth and auth.startswith('Basic '):
        try:
            import base64
            credentials = base64.b64decode(auth[6:]).decode('utf-8')
            username, password = credentials.split(':', 1)
            valid_credentials = authenticate(username, password)
        except Exception:
            valid_credentials = False
    
    return jsonify({
        'authRequired': auth_required,
        'validCredentials': valid_credentials
    })

# @app.route('/api/auth/users', methods=['GET'])
# @requires_auth
# def list_users():
#     """List all usernames."""
#     return jsonify(get_users())

# @app.route('/api/auth/users', methods=['POST'])
# @requires_auth
# def create_user():
#     """Create a new user."""
#     data = request.json
#     username = data.get('username', '')
#     password = data.get('password', '')
    
#     if not username or not password:
#         return jsonify({'error': 'Username and password required'}), 400
    
#     success = add_user(username, password)
    
#     if success:
#         return jsonify({'success': True})
#     else:
#         return jsonify({'error': 'Failed to create user or user already exists'}), 400

# @app.route('/api/auth/users/<username>', methods=['DELETE'])
# @requires_auth
# def remove_user(username):
#     """Delete a user."""
#     success = delete_user(username)
    
#     if success:
#         return jsonify({'success': True})
#     else:
#         return jsonify({'error': 'Failed to delete user or user not found'}), 404

# @app.route('/api/auth/users/<username>', methods=['PUT'])
# @requires_auth
# def change_password(username):
#     """Update a user's password."""
#     data = request.json
#     new_password = data.get('password', '')
    
#     if not new_password:
#         return jsonify({'error': 'New password required'}), 400
    
#     success = update_user_password(username, new_password)
    
#     if success:
#         return jsonify({'success': True})
#     else:
#         return jsonify({'error': 'Failed to update password or user not found'}), 404

# File locks:
@app.route('/api/file/lock', methods=['POST'])
def manage_file_lock():
    """Acquire, refresh, or release a lock on a file."""
    data = request.json
    file_path = data.get('path', '')
    session_id = data.get('session_id', '')
    action = data.get('action', 'acquire')  # 'acquire' or 'release'
    force = data.get('force', False)  # Whether to force acquire a lock
    
    if not file_path or not session_id:
        return jsonify({'error': 'File path and session ID are required'}), 400
    
    if action == 'acquire':
        success, owner, message = acquire_lock(file_path, session_id)
        return jsonify({
            'success': success,
            'lockOwner': owner,
            'message': message
        })
    elif action == 'release':
        success, message = release_lock(file_path, session_id)
        return jsonify({
            'success': success,
            'message': message
        })
    else:
        return jsonify({'error': 'Invalid action. Use "acquire" or "release"'}), 400

@app.route('/api/files/locks', methods=['GET'])
def get_all_locks():
    """Get all active locks in the system."""
    try:
        locks = sqlite_get_all_locks()
        return jsonify({'locks': locks})
    except Exception as e:
        app.logger.error(f"Error getting all locks: {str(e)}")
        return jsonify({'error': f"Failed to get locks: {str(e)}"}), 500

@app.route('/api/file/lock', methods=['GET'])
def check_file_lock():
    """Check the lock status of a file."""
    file_path = request.args.get('path', '')
    
    if not file_path:
        return jsonify({'error': 'File path is required'}), 400
    
    is_locked, owner, timestamp, is_expired = check_lock_status(file_path)
    
    return jsonify({
        'isLocked': is_locked,
        'lockOwner': owner,
        'lockTime': timestamp,
        'isExpired': is_expired
    })

if __name__ == '__main__':
    # app.run(debug=True)
    serve(
        app,
        host='0.0.0.0',
        port='5000',
        ident='WriteSimplr',      # Server identification
    )