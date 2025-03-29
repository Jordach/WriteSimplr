/**
 * File Manager functionality
 */
class FileManager {
    constructor() {
        this.fileTree = document.getElementById('file-tree');
        this.currentFilePath = null;
        
        // Set initial document title
        this.updateDocumentTitle(null);
        
        // Add logging to debug initialization
        console.log("FileManager initialized, element:", this.fileTree);
        
        this.initEventListeners();
        
        // Initialize drag and drop functionality
        this.initDragAndDrop();
        
        // Explicitly load the file tree on initialization
        this.loadFileTree();

        // Set up periodic auto-save (every 30 seconds)
        this.autoSaveInterval = setInterval(() => {
            if (window.fileManager && window.fileManager.currentFilePath) {
                console.log("Performing periodic auto-save");
                this.saveCurrentFile(true); // true = auto-save
            }
        }, 30000);
    }

    // Add a cleanup method to Editor class
    destroy() {
        // Clear auto-save interval to prevent memory leaks
        if (this.autoSaveInterval) {
            clearInterval(this.autoSaveInterval);
        }
        
        // Clean up editor if needed
        if (this.editor && typeof this.editor.destroy === 'function') {
            this.editor.destroy();
        }
    }
    
    initEventListeners() {
        // Create new file button
        document.getElementById('new-file-btn').addEventListener('click', () => {
            this.showNewFileModal();
        });
        
        // Create new folder button
        document.getElementById('new-folder-btn').addEventListener('click', () => {
            this.showNewFolderModal();
        });
        
        // Modal close button
        document.querySelector('.modal .close').addEventListener('click', () => {
            this.closeModal();
        });
        
        // Close modal when clicking outside
        window.addEventListener('click', (e) => {
            if (e.target === document.getElementById('modal')) {
                this.closeModal();
            }
        });
    }

    initDragAndDrop() {
        // Maintain state about the current drag operation
        this.dragState = {
            isDragging: false,
            draggedItem: null,
            draggedPath: null,
            draggedType: null, // 'file' or 'folder'
            dropTarget: null
        };
        
        // Add event delegation for drag events on the file tree
        this.fileTree.addEventListener('dragstart', this.handleDragStart.bind(this));
        this.fileTree.addEventListener('dragover', this.handleDragOver.bind(this));
        this.fileTree.addEventListener('dragleave', this.handleDragLeave.bind(this));
        this.fileTree.addEventListener('drop', this.handleDrop.bind(this));
        this.fileTree.addEventListener('dragend', this.handleDragEnd.bind(this));
        
        console.log("Drag and drop initialized for file tree");
    }

    // Handle the start of a drag operation
    handleDragStart(e) {
        // Only proceed if we clicked directly on a file-item or a folder-header
        if (!e.target.classList.contains('file-item') && 
            !e.target.classList.contains('folder-header') &&
            !e.target.closest('.folder-header')) {
            e.preventDefault();
            e.stopPropagation();
            return;
        }
        
        // Get the file item - either the target itself or its parent
        const fileItem = e.target.classList.contains('file-item') 
            ? e.target 
            : e.target.closest('.file-item');
            
        if (!fileItem) {
            e.preventDefault();
            e.stopPropagation();
            return;
        }
        
        // Determine if this is a file or folder
        const isFolder = fileItem.querySelector('.fa-folder') || fileItem.querySelector('.fa-folder-open');
        
        // Get the path - either from data-path for files or data-folder-path for folders
        let draggedPath = fileItem.getAttribute('data-path');
        
        if (!draggedPath && isFolder) {
            draggedPath = fileItem.getAttribute('data-folder-path');
        }
        
        // Don't allow dragging if we couldn't determine the path
        if (!draggedPath) {
            e.preventDefault();
            e.stopPropagation();
            return;
        }
        
        const draggedType = isFolder ? 'folder' : 'file';
        
        // Set the drag effect
        e.dataTransfer.effectAllowed = 'move';
        
        // Set drag data
        e.dataTransfer.setData('text/plain', draggedPath);
        e.dataTransfer.setData('application/x-file-type', draggedType);
        
        // Store information about what's being dragged
        this.dragState = this.dragState || {};
        this.dragState.isDragging = true;
        this.dragState.draggedItem = fileItem;
        this.dragState.draggedPath = draggedPath;
        this.dragState.draggedType = draggedType;
        
        // Add a dragging class for visual feedback
        fileItem.classList.add('dragging');
        
        console.log(`Started dragging ${draggedType}: ${draggedPath}`);
    }

    // Handle dragover events to indicate valid drop targets
    handleDragOver(e) {
        // If we're not dragging anything, ignore
        if (!this.dragState.isDragging) return;
        
        // Find the closest potential drop target (a folder item)
        const dropTarget = e.target.closest('.file-item');
        const isFolder = dropTarget && (
            dropTarget.querySelector('.fa-folder') || 
            dropTarget.querySelector('.fa-folder-open')
        );
        
        // Only allow dropping onto folders or the root file tree
        if (isFolder || e.target === this.fileTree) {
            e.preventDefault(); // Allow drop
            e.dataTransfer.dropEffect = 'move';
            
            // Provide visual feedback for the drop target
            if (this.dragState.dropTarget && this.dragState.dropTarget !== dropTarget) {
                // Remove highlight from previous target
                this.dragState.dropTarget.classList.remove('drop-target');
            }
            
            if (dropTarget) {
                // Don't allow dropping onto itself or its children
                const draggedPath = this.dragState.draggedPath;
                let targetPath = '';
                
                // Get the path for the drop target
                const targetPathAttr = dropTarget.getAttribute('data-path');
                if (targetPathAttr) {
                    targetPath = targetPathAttr;
                } else {
                    // For folders, construct the path from nested spans
                    const pathParts = [];
                    let currentEl = dropTarget;
                    
                    while (currentEl && currentEl.classList.contains('file-item')) {
                        const nameSpan = currentEl.querySelector('span');
                        if (nameSpan) {
                            pathParts.unshift(nameSpan.textContent.trim());
                        }
                        
                        currentEl = currentEl.parentElement.closest('.file-item');
                    }
                    
                    targetPath = pathParts.join('/');
                }
                
                // Check if we're trying to drop into current location or a child folder
                if (draggedPath === targetPath || 
                    (this.dragState.draggedType === 'folder' && targetPath.startsWith(draggedPath + '/'))) {
                    // Invalid drop target - either same location or child folder
                    dropTarget.classList.remove('drop-target');
                    return;
                }
                
                // Highlight valid drop target
                dropTarget.classList.add('drop-target');
                this.dragState.dropTarget = dropTarget;
            } else if (e.target === this.fileTree) {
                // Root file tree as drop target (move to root)
                this.fileTree.classList.add('drop-target');
                this.dragState.dropTarget = this.fileTree;
            }
        }
    }

    // Handle dragleave events to remove drop target styling
    handleDragLeave(e) {
        // Only handle if we have a drop target
        if (!this.dragState.dropTarget) return;
        
        // Check if we're leaving the current drop target
        const relatedTarget = e.relatedTarget;
        if (!this.dragState.dropTarget.contains(relatedTarget)) {
            this.dragState.dropTarget.classList.remove('drop-target');
            this.dragState.dropTarget = null;
        }
    }

    // Handle drop events to perform the move operation
    handleDrop(e) {
        e.preventDefault();
        
        // Get the data directly from the dataTransfer object
        const draggedPath = e.dataTransfer.getData('text/plain');
        const draggedType = e.dataTransfer.getData('application/x-file-type') || 'file';
        
        if (!draggedPath) {
            console.error('No path information found in drop event');
            return;
        }
        
        // Find the drop target (folder or root)
        const dropTarget = e.target.closest('.file-item');
        let targetPath = '';
        
        if (dropTarget) {
            // If dropped on a folder item, get its path
            const folderPath = dropTarget.getAttribute('data-folder-path');
            if (folderPath) {
                targetPath = folderPath;
            } else {
                // It might be a file, so get its parent folder
                const filePath = dropTarget.getAttribute('data-path');
                if (filePath && filePath.includes('/')) {
                    // Extract the parent folder path
                    targetPath = filePath.substring(0, filePath.lastIndexOf('/'));
                }
            }
        }
        
        // Remove any drag/drop highlighting
        document.querySelectorAll('.drop-target').forEach(el => {
            el.classList.remove('drop-target');
        });
        
        document.querySelectorAll('.dragging').forEach(el => {
            el.classList.remove('dragging');
        });
        
        // Don't allow dropping onto the same location
        if (draggedPath === targetPath) {
            console.log('Cancelled: Trying to drop in the same location');
            return;
        }
        
        // Don't allow dropping a folder into its own subfolder
        if (draggedType === 'folder' && targetPath.startsWith(draggedPath + '/')) {
            console.log('Cancelled: Trying to drop a folder into its own subfolder');
            return;
        }
        
        // Check if the source path exists in the current file structure
        // This check should be done on the server side as well
        
        // Perform the move operation
        console.log(`Moving ${draggedType} from "${draggedPath}" to "${targetPath || 'root'}"`);
        
        if (draggedType === 'file') {
            this.moveFile(draggedPath, targetPath);
        } else {
            this.moveFolder(draggedPath, targetPath);
        }
    }

    // Handle dragend events to clean up if drop didn't occur
    handleDragEnd(e) {
        this.resetDragState();
    }

    // Helper method to reset drag state
    resetDragState() {
        // Remove drag styling from item
        if (this.dragState.draggedItem) {
            this.dragState.draggedItem.classList.remove('dragging');
        }
        
        // Remove highlight from drop target
        if (this.dragState.dropTarget) {
            this.dragState.dropTarget.classList.remove('drop-target');
        }
        
        // Reset the file tree highlight if it was a target
        this.fileTree.classList.remove('drop-target');
        
        // Reset drag state
        this.dragState = {
            isDragging: false,
            draggedItem: null,
            draggedPath: null,
            draggedType: null,
            dropTarget: null
        };
    }
    
    loadFileTree() {
        console.log("Loading file tree...");
        fetch('/api/files')
            .then(response => {
                if (!response.ok) {
                    throw new Error(`API request failed with status ${response.status}`);
                }
                return response.json();
            })
            .then(files => {
                console.log("Received files:", files);
                // Organize files into a tree structure
                const tree = this.organizeFilesIntoTree(files);
                console.log("Organized file tree:", tree);
                this.renderFileTree(tree);
            })
            .catch(error => {
                console.error('Error loading file tree:', error);
                // Display error message in file tree
                this.fileTree.innerHTML = `
                    <div class="file-tree-error">
                        <p>Error loading files: ${error.message}</p>
                        <button id="retry-load-files">Retry</button>
                    </div>
                `;
                document.getElementById('retry-load-files')?.addEventListener('click', () => {
                    this.loadFileTree();
                });
            });
    }
    
    organizeFilesIntoTree(files) {
        const tree = { children: {} };
        
        if (!files || !Array.isArray(files)) {
            console.error("Invalid files data:", files);
            return tree;
        }
        
        // First process directories to ensure parent folders exist
        const sortedFiles = [...files].sort((a, b) => {
            // Sort directories first, then by path length (to ensure parent folders are processed before children)
            if (a.type === 'directory' && b.type !== 'directory') return -1;
            if (a.type !== 'directory' && b.type === 'directory') return 1;
            return a.path.length - b.path.length;
        });
        
        // Process each file/directory
        sortedFiles.forEach(item => {
            const parts = item.path.split('/').filter(Boolean);
            let current = tree;
            
            // For directories, ensure the entire path exists
            if (item.type === 'directory') {
                for (let i = 0; i < parts.length; i++) {
                    const part = parts[i];
                    if (!current.children[part]) {
                        current.children[part] = { children: {} };
                    }
                    current = current.children[part];
                }
            } 
            // For files, navigate to parent directory then add the file
            else {
                const fileName = parts.pop(); // Get the file name (last part)
                
                // Navigate to the parent directory
                for (const part of parts) {
                    if (!current.children[part]) {
                        current.children[part] = { children: {} };
                    }
                    current = current.children[part];
                }
                
                // Add the file to its parent directory
                current.children[fileName] = { type: 'file', path: item.path };
            }
        });
        
        return tree;
    }
    
    renderFileTree(tree, parentElement = null, path = '') {
        const container = parentElement || this.fileTree;
        
        // Clear the container if it's the root call
        if (!parentElement) {
            container.innerHTML = '';
        }
        
        if (!tree || !tree.children) {
            console.error("Invalid tree structure:", tree);
            container.innerHTML = '<div class="file-error">Error displaying files</div>';
            return;
        }
        
        // If there are no files, show a message
        if (Object.keys(tree.children).length === 0) {
            if (!parentElement) {
                container.innerHTML = '<div class="file-empty">No files found.<br><br>Go create some!</div>';
            }
            return;
        }
        
        // Sort items: directories first, then files, all alphabetically
        const items = Object.keys(tree.children).sort((a, b) => {
            const aIsDir = typeof tree.children[a].children === 'object';
            const bIsDir = typeof tree.children[b].children === 'object';
            if (aIsDir && !bIsDir) return -1;
            if (!aIsDir && bIsDir) return 1;
            return a.localeCompare(b);
        });
        
        // Render each item
        items.forEach(key => {
            const item = tree.children[key];
            const isDirectory = typeof item.children === 'object';
            const itemPath = path ? `${path}/${key}` : key;
            
            const fileItem = document.createElement('div');
            fileItem.className = 'file-item';
            
            // Make items draggable
            fileItem.draggable = true;
            
            // Add correct icon - folder or file
            const iconClass = isDirectory ? 'fa-folder' : 'fa-file-alt';
            fileItem.innerHTML = `
                <i class="fas ${iconClass}"></i>
                <span>${key}</span>
            `;
            
            if (isDirectory) {
                // Set folder path in a data attribute for drag and drop operations
                fileItem.setAttribute('data-folder-path', itemPath);
                
                // Create folder contents container
                const folderContents = document.createElement('div');
                folderContents.className = 'folder-contents';
                folderContents.style.display = 'none';
                folderContents.style.paddingLeft = '15px';
                
                // IMPORTANT: Make folder-contents stop propagation of draggable events
                folderContents.addEventListener('dragstart', (e) => {
                    // Allow the event to bubble only if it started directly on a child item
                    if (e.target.classList.contains('file-item')) {
                        // Let it proceed
                    } else {
                        e.stopPropagation();
                    }
                });
                
                // Render folder contents recursively
                this.renderFileTree(item, folderContents, itemPath);
                
                // Create folder header that extends full width
                const folderHeader = document.createElement('div');
                folderHeader.className = 'folder-header';
                
                // Move icon and span from fileItem to folderHeader
                const icon = fileItem.querySelector('i');
                const label = fileItem.querySelector('span');
                
                if (icon && label) {
                    fileItem.innerHTML = '';
                    folderHeader.appendChild(icon);
                    folderHeader.appendChild(label);
                    fileItem.appendChild(folderHeader);
                }
                
                // Add the click event to the header only
                folderHeader.addEventListener('click', (e) => {
                    e.stopPropagation();
                    fileItem.classList.toggle('open');
                    
                    const folderIcon = folderHeader.querySelector('i');
                    if (folderIcon) {
                        folderIcon.className = fileItem.classList.contains('open') 
                            ? 'fas fa-folder-open'
                            : 'fas fa-folder';
                    }
                    
                    folderContents.style.display = fileItem.classList.contains('open') 
                        ? 'block'
                        : 'none';
                });
                
                // Add context menu for folders (on the folder header only)
                folderHeader.addEventListener('contextmenu', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    this.showFolderContextMenu(e, itemPath);
                });
                
                // Add the folder contents to the folder item
                fileItem.appendChild(folderContents);
                
                // Prevent drag events from bubbling up from folder contents
                folderContents.addEventListener('click', (e) => {
                    e.stopPropagation();
                });
                
                // Set up drag handlers specifically for the folder header
                folderHeader.addEventListener('dragstart', (e) => {
                    // Only handle drag if clicked directly on the header
                    if (e.target !== folderHeader && !folderHeader.contains(e.target)) {
                        return;
                    }
                    
                    // Set drag data
                    e.dataTransfer.setData('text/plain', itemPath);
                    e.dataTransfer.setData('application/x-file-type', 'folder');
                    
                    // Store information about what's being dragged
                    this.dragState = this.dragState || {};
                    this.dragState.isDragging = true;
                    this.dragState.draggedItem = fileItem;
                    this.dragState.draggedPath = itemPath;
                    this.dragState.draggedType = 'folder';
                    
                    // Add a dragging class for visual feedback
                    fileItem.classList.add('dragging');
                });
            } else {
                // Set path data attribute for files
                fileItem.setAttribute('data-path', item.path);
                
                // Add click handler to load file
                fileItem.addEventListener('click', (e) => {
                    e.stopPropagation(); // Prevent bubbling to parent folders
                    this.loadFile(item.path);
                    
                    // Highlight the active file
                    document.querySelectorAll('.file-item.active').forEach(item => {
                        item.classList.remove('active');
                    });
                    fileItem.classList.add('active');
                });
                
                // Add context menu for files
                fileItem.addEventListener('contextmenu', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    this.showFileContextMenu(e, item.path);
                });
            }
            
            container.appendChild(fileItem);
        });
    }
    
    loadFile(path) {
        // First, save the current file if one is open
        if (this.currentFilePath && window.editor) {
            console.log("Auto-saving before switching files");
            this.saveCurrentFile();
        }
        
        console.log("Loading file:", path);
        fetch(`/api/file?path=${encodeURIComponent(path)}`)
            .then(response => {
                if (!response.ok) {
                    throw new Error(`Failed to load file: ${response.statusText}`);
                }
                return response.json();
            })
            .then(data => {
                if (data.error) {
                    console.error('Error loading file:', data.error);
                    return;
                }
                
                console.log("File loaded, content length:", data.content ? data.content.length : 0);
                this.currentFilePath = path;
                
                // Update the document title with the current file
                this.updateDocumentTitle(path);
                
                // Highlight the active file in the file tree
                this.highlightActiveFile(path);
                
                // Update the editor content and formatting
                if (window.editor) {
                    if (typeof window.editor.setContent === 'function') {
                        window.editor.setContent(data.content);
                        
                        // Store this as the last saved content for change detection
                        window.editor._lastSavedContent = data.content;
                    }
                    
                    if (typeof window.editor.applyFormatOptions === 'function') {
                        window.editor.applyFormatOptions(data.formatOptions);
                    }
                }
            })
            .catch(error => console.error('Error loading file:', error));
    }
    
    // Helper method to highlight the active file in the file tree
    highlightActiveFile(path) {
        // Remove active class from all file items
        document.querySelectorAll('.file-item.active').forEach(item => {
            item.classList.remove('active');
        });
        
        // Add active class to the current file
        const fileItem = document.querySelector(`.file-item[data-path="${path}"]`);
        if (fileItem) {
            fileItem.classList.add('active');
            
            // Expand parent folders if needed
            let parent = fileItem.parentElement;
            while (parent && parent.classList.contains('folder-contents')) {
                const folderItem = parent.parentElement;
                if (folderItem && folderItem.classList.contains('file-item')) {
                    folderItem.classList.add('open');
                    const folderIcon = folderItem.querySelector('i');
                    if (folderIcon) {
                        folderIcon.className = 'fas fa-folder-open';
                    }
                    parent.style.display = 'block';
                }
                parent = folderItem ? folderItem.parentElement : null;
            }
        }
    }
    
    saveCurrentFile(isAutoSave = false) {
        let wasNoFile = false;
        if (!this.currentFilePath) {
            this.showNewFileModal();
            return;
        }
        
        // Get content from editor
        let content = '';
        if (window.editor && typeof window.editor.getContent === 'function') {
            content = window.editor.getContent();
            
            // Store this as the last saved content for change detection
            if (window.editor._lastSavedContent !== undefined) {
                window.editor._lastSavedContent = content;
            }
        }
        
        console.log("Saving file:", this.currentFilePath, "Content length:", content.length);
        
        // Since we removed the old toolbar, get format options directly from the editor
        const formatOptions = window.editor.currentFormatOptions || {
            font: 'Garamond, serif',
            fontSize: '14pt',
            fontColor: '#222222'
        };
        
        // Make the save request
        fetch('/api/file', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                path: this.currentFilePath,
                content: content,
                formatOptions: formatOptions
            })
        })
        .then(response => {
            if (!response.ok) {
                throw new Error(`Failed to save file: ${response.status} ${response.statusText}`);
            }
            return response.json();
        })
        .then(data => {
            if (data.success) {
                console.log('File saved successfully:', this.currentFilePath);
                // Show save indicator
                this.showSaveIndicator(isAutoSave);
            } else {
                console.error('Error saving file:', data.error);
                alert('Error saving file: ' + (data.error || 'Unknown error'));
            }
        })
        .catch(error => {
            console.error('Error saving file:', error);
            alert('Error saving file: ' + error.message);
        });
    }

    // Add this method to fileManager.js
    showSaveIndicator(isAuto = false) {
        // Create or get save indicator
        let indicator = document.getElementById('save-indicator');
        if (!indicator) {
            indicator = document.createElement('div');
            indicator.id = 'save-indicator';
            indicator.style.position = 'fixed';
            indicator.style.bottom = '32pt';
            indicator.style.right = '8pt';
            indicator.style.backgroundColor = '#4CAF50';
            indicator.style.color = 'white';
            indicator.style.padding = '10px 20px';
            indicator.style.borderRadius = '4px';
            indicator.style.opacity = '0';
            indicator.style.transition = 'opacity 0.5s';
            indicator.style.zIndex = '20';
            document.body.appendChild(indicator);
        }
        
        // Show the indicator with appropriate message
        indicator.textContent = isAuto ? 'Auto-saved' : 'File saved';
        indicator.style.opacity = '1';
        
        // Hide it after 2 seconds
        setTimeout(() => {
            indicator.style.opacity = '0';
        }, 2000);
    }

    createNewFile(name, folder = '') {
        const path = folder ? `${folder}/${name}` : name;
        const finalPath = path.endsWith('.md') ? path : `${path}.md`;
        
        // Get the current content from the editor before we switch files
        let currentContent = '';
        if (window.editor && typeof window.editor.getContent === 'function') {
            currentContent = window.editor.getContent();
        }
        
        // Save the current file first if one is open
        if (this.currentFilePath && window.editor) {
            this.saveCurrentFile();
        }
        
        console.log("Creating new file:", finalPath);
        
        // Get format options from the editor
        const formatOptions = window.editor && window.editor.currentFormatOptions 
            ? window.editor.currentFormatOptions
            : {
                font: 'Arial, sans-serif',
                fontSize: '16px',
                fontColor: '#333333'
            };
        
        // Set the current path before making the API call
        // This ensures we're tracking the right file from the beginning
        this.currentFilePath = finalPath;
        
        // Update the document title with the new file name
        this.updateDocumentTitle(finalPath);
        
        // If we're creating from the "New Document" button, content is empty
        // Otherwise, use the content from the editor (if any)
        const initialContent = currentContent;
        
        // Set the content in the editor immediately so user can start typing
        if (window.editor && typeof window.editor.setContent === 'function') {
            window.editor.setContent(initialContent);
            // Store this as the last saved content for change detection
            window.editor._lastSavedContent = initialContent;
        }
        
        // Create the file on the server
        fetch('/api/file', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                path: finalPath,
                content: initialContent,  // Use the initial content we set
                formatOptions: formatOptions
            })
        })
        .then(response => {
            if (!response.ok) {
                throw new Error(`Server returned ${response.status}: ${response.statusText}`);
            }
            return response.json();
        })
        .then(data => {
            if (data.success) {
                console.log("File created:", finalPath);
                this.loadFileTree();
                this.refreshAvailableDocuments(); // Update document list
                
                // Show save indicator
                this.showSaveIndicator(false);
            } else {
                console.error('Error creating file:', data.error);
                alert('Error creating file: ' + (data.error || 'Unknown error'));
            }
        })
        .catch(error => {
            console.error('Error creating file:', error);
            alert('Error creating file: ' + error.message);
        });
    }
    
    createNewFolder(name, parentFolder = '') {
        const path = parentFolder ? `${parentFolder}/${name}` : name;
        
        fetch('/api/directory', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                path: path
            })
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                this.loadFileTree();
            } else {
                console.error('Error creating folder:', data.error);
            }
        })
        .catch(error => console.error('Error creating folder:', error));
    }
    
    deleteFile(path) {
        if (confirm(`Are you sure you want to delete "${path}"?`)) {
            fetch(`/api/file?path=${encodeURIComponent(path)}`, {
                method: 'DELETE'
            })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    this.loadFileTree();
                    if (this.currentFilePath === path) {
                        this.currentFilePath = null;
                        editor.setContent('');
                        // Reset the title when the current file is deleted
                        this.updateDocumentTitle(null);
                    }
                } else {
                    console.error('Error deleting file:', data.error);
                }
            })
            .catch(error => console.error('Error deleting file:', error));
        }
    }
    
    deleteFolder(path) {
        if (confirm(`Are you sure you want to delete the folder "${path}" and all its contents?`)) {
            fetch(`/api/directory?path=${encodeURIComponent(path)}`, {
                method: 'DELETE'
            })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    this.loadFileTree();
                    this.refreshAvailableDocuments(); // Update document list
                    if (this.currentFilePath && this.currentFilePath.startsWith(path + '/')) {
                        this.currentFilePath = null;
                        editor.setContent('');
                    }
                } else {
                    console.error('Error deleting folder:', data.error);
                }
            })
            .catch(error => console.error('Error deleting folder:', error));
        }
    }
    
    uploadAttachment(file) {
        const formData = new FormData();
        formData.append('file', file);
        
        return fetch('/api/upload', {
            method: 'POST',
            body: formData
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                return data.url;
            } else {
                throw new Error(data.error || 'Error uploading file');
            }
        });
    }
    
    showNewFileModal(preSelectedFolder = '') {
        const modal = document.getElementById('modal');
        const modalTitle = document.getElementById('modal-title');
        const modalBody = document.getElementById('modal-body');
        
        // Capture current editor content if available
        let currentContent = '';
        if (window.editor && typeof window.editor.getContent === 'function') {
            currentContent = window.editor.getContent();
        }
        
        modalTitle.textContent = 'Create New File';
        
        // First load the folder structure to populate the dropdown
        fetch('/api/files')
            .then(response => response.json())
            .then(files => {
                // Filter to get only directories
                const folders = files.filter(item => item.type === 'directory').map(dir => dir.path);
                
                // Always include root directory option
                folders.unshift('(Root Directory)');
                
                // Create dropdown HTML
                const options = folders.map(folder => {
                    const displayName = folder === '(Root Directory)' ? folder : folder;
                    const value = folder === '(Root Directory)' ? '' : folder;
                    const selected = value === preSelectedFolder ? 'selected' : '';
                    return `<option value="${value}" ${selected}>${displayName}</option>`;
                }).join('');
                
                // Build the modal body with folder selection
                modalBody.innerHTML = `
                    <div style="margin-bottom: 15px;">
                        <label for="new-file-name">File Name:</label>
                        <input type="text" id="new-file-name" placeholder="Enter file name" autocomplete="off" 
                            style="width: 100%; padding: 8px; margin-top: 5px; box-sizing: border-box;">
                    </div>
                    
                    <div style="margin-bottom: 15px;">
                        <label for="folder-select">Location:</label>
                        <select id="folder-select" style="width: 100%; padding: 8px; margin-top: 5px; box-sizing: border-box;">
                            ${options}
                        </select>
                    </div>
                    
                    <div style="display: flex; justify-content: flex-end; margin-top: 20px;">
                        <button class="cancel" style="margin-right: 10px;">Cancel</button>
                        <button id="create-file-btn">Create</button>
                    </div>
                `;
                
                // Function to create the file
                const createFileWithContent = () => {
                    const fileName = document.getElementById('new-file-name').value.trim();
                    const selectedFolder = document.getElementById('folder-select').value;
                    
                    if (fileName) {
                        // Store the current path to reset it if needed
                        const previousPath = this.currentFilePath;
                        
                        // Create the new file path
                        const path = selectedFolder ? `${selectedFolder}/${fileName}` : fileName;
                        const finalPath = path.endsWith('.md') ? path : `${path}.md`;
                        
                        // Set the current path
                        this.currentFilePath = finalPath;
                        
                        // Update the document title with the new file name
                        this.updateDocumentTitle(finalPath);
                        
                        // Get format options from the editor
                        const formatOptions = window.editor && window.editor.currentFormatOptions 
                            ? window.editor.currentFormatOptions
                            : {
                                font: 'Arial, sans-serif',
                                fontSize: '16px',
                                fontColor: '#333333'
                            };
                        
                        // Create the file on the server, including the current content
                        fetch('/api/file', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json'
                            },
                            body: JSON.stringify({
                                path: finalPath,
                                content: currentContent,
                                formatOptions: formatOptions
                            })
                        })
                        .then(response => {
                            if (!response.ok) {
                                throw new Error(`Server returned ${response.status}: ${response.statusText}`);
                            }
                            return response.json();
                        })
                        .then(data => {
                            if (data.success) {
                                console.log("File created:", finalPath);
                                
                                // If there's content, make sure it's set in the editor
                                if (window.editor && typeof window.editor.setContent === 'function') {
                                    window.editor.setContent(currentContent);
                                    window.editor._lastSavedContent = currentContent;
                                }
                                
                                this.loadFileTree();
                                this.refreshAvailableDocuments();
                                
                                // Show save indicator
                                this.showSaveIndicator(false);
                            } else {
                                console.error('Error creating file:', data.error);
                                alert('Error creating file: ' + (data.error || 'Unknown error'));
                                
                                // Revert to previous path if there was an error
                                this.currentFilePath = previousPath;
                                this.updateDocumentTitle(previousPath);
                            }
                        })
                        .catch(error => {
                            console.error('Error creating file:', error);
                            alert('Error creating file: ' + error.message);
                            
                            // Revert to previous path if there was an error
                            this.currentFilePath = previousPath;
                            this.updateDocumentTitle(previousPath);
                        });
                        
                        this.closeModal();
                    } else {
                        // Display an error if no filename is provided
                        const nameInput = document.getElementById('new-file-name');
                        nameInput.style.borderColor = 'red';
                        nameInput.placeholder = 'Please enter a file name';
                    }
                };
                
                // Add event listeners
                const cancelBtn = document.querySelector('.modal button.cancel');
                const createBtn = document.getElementById('create-file-btn');
                
                // Function to close the modal
                const closeModal = () => {
                    this.closeModal();
                };
                
                // Cancel button click
                cancelBtn.addEventListener('click', closeModal);
                
                // Create button click
                createBtn.addEventListener('click', createFileWithContent);
                
                // Add key event listeners for the entire modal
                const keyHandler = (e) => {
                    // Enter key should confirm
                    if (e.key === 'Enter') {
                        e.preventDefault();
                        createFileWithContent();
                    }
                    // Escape key should cancel
                    else if (e.key === 'Escape') {
                        e.preventDefault();
                        closeModal();
                    }
                };
                
                // Add the key handler to the modal
                modal.addEventListener('keydown', keyHandler);
                
                // Clean up event listener when modal is closed
                const modalCloseObserver = new MutationObserver((mutations) => {
                    mutations.forEach((mutation) => {
                        if (mutation.attributeName === 'style' && 
                            modal.style.display === 'none') {
                            modal.removeEventListener('keydown', keyHandler);
                            modalCloseObserver.disconnect();
                        }
                    });
                });
                
                // Start observing the modal for attribute changes
                modalCloseObserver.observe(modal, { attributes: true });
                
                // Show the modal
                modal.style.display = 'block';

                // Set focus to the filename input
                const filenameInput = document.getElementById('new-file-name');
                filenameInput.focus();
            })
            .catch(error => {
                console.error('Error loading folders:', error);
                
                // Fall back to a simpler modal without folder selection
                // But still honor the preSelectedFolder if provided
                modalBody.innerHTML = `
                    <div style="margin-bottom: 15px;">
                        <label for="new-file-name">File Name:</label>
                        <input type="text" id="new-file-name" placeholder="Enter file name" autocomplete="off" 
                            style="width: 100%; padding: 8px; margin-top: 5px; box-sizing: border-box;">
                    </div>
                    
                    <div style="display: flex; justify-content: flex-end; margin-top: 20px;">
                        <button class="cancel" style="margin-right: 10px;">Cancel</button>
                        <button id="create-file-btn">Create</button>
                    </div>
                `;
                
                // Function to create the file (simplified version)
                const createFileSimple = () => {
                    const fileName = document.getElementById('new-file-name').value.trim();
                    if (fileName) {
                        // Store the current path to reset it if needed
                        const previousPath = this.currentFilePath;
                        
                        // Create the new file path
                        const path = preSelectedFolder ? `${preSelectedFolder}/${fileName}` : fileName;
                        const finalPath = path.endsWith('.md') ? path : `${path}.md`;
                        
                        // Set the current path
                        this.currentFilePath = finalPath;
                        
                        // Update the document title with the new file name
                        this.updateDocumentTitle(finalPath);
                        
                        // Get format options from the editor
                        const formatOptions = window.editor && window.editor.currentFormatOptions 
                            ? window.editor.currentFormatOptions
                            : {
                                font: 'Arial, sans-serif',
                                fontSize: '16px',
                                fontColor: '#333333'
                            };
                        
                        // Create the file on the server, including the current content
                        fetch('/api/file', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json'
                            },
                            body: JSON.stringify({
                                path: finalPath,
                                content: currentContent,
                                formatOptions: formatOptions
                            })
                        })
                        .then(response => {
                            if (!response.ok) {
                                throw new Error(`Server returned ${response.status}: ${response.statusText}`);
                            }
                            return response.json();
                        })
                        .then(data => {
                            if (data.success) {
                                console.log("File created:", finalPath);
                                
                                // If there's content, make sure it's set in the editor
                                if (window.editor && typeof window.editor.setContent === 'function') {
                                    window.editor.setContent(currentContent);
                                    window.editor._lastSavedContent = currentContent;
                                }
                                
                                this.loadFileTree();
                                this.refreshAvailableDocuments();
                                
                                // Show save indicator
                                this.showSaveIndicator(false);
                            } else {
                                console.error('Error creating file:', data.error);
                                alert('Error creating file: ' + (data.error || 'Unknown error'));
                                
                                // Revert to previous path if there was an error
                                this.currentFilePath = previousPath;
                                this.updateDocumentTitle(previousPath);
                            }
                        })
                        .catch(error => {
                            console.error('Error creating file:', error);
                            alert('Error creating file: ' + error.message);
                            
                            // Revert to previous path if there was an error
                            this.currentFilePath = previousPath;
                            this.updateDocumentTitle(previousPath);
                        });
                        
                        this.closeModal();
                    } else {
                        // Display an error if no filename is provided
                        const nameInput = document.getElementById('new-file-name');
                        nameInput.style.borderColor = 'red';
                        nameInput.placeholder = 'Please enter a file name';
                    }
                };
                
                // Add event listeners
                const cancelBtn = document.querySelector('.modal button.cancel');
                const createBtn = document.getElementById('create-file-btn');
                
                // Function to close the modal
                const closeModal = () => {
                    this.closeModal();
                };
                
                // Cancel button click
                cancelBtn.addEventListener('click', closeModal);
                
                // Create button click
                createBtn.addEventListener('click', createFileSimple);
                
                // Add key event listeners for the entire modal
                const keyHandler = (e) => {
                    // Enter key should confirm
                    if (e.key === 'Enter') {
                        e.preventDefault();
                        createFileSimple();
                    }
                    // Escape key should cancel
                    else if (e.key === 'Escape') {
                        e.preventDefault();
                        closeModal();
                    }
                };
                
                // Add the key handler to the modal
                modal.addEventListener('keydown', keyHandler);
                
                // Clean up event listener when modal is closed
                const modalCloseObserver = new MutationObserver((mutations) => {
                    mutations.forEach((mutation) => {
                        if (mutation.attributeName === 'style' && 
                            modal.style.display === 'none') {
                            modal.removeEventListener('keydown', keyHandler);
                            modalCloseObserver.disconnect();
                        }
                    });
                });
                
                // Start observing the modal for attribute changes
                modalCloseObserver.observe(modal, { attributes: true });
                
                // Show the modal
                modal.style.display = 'block';

                // Add event listeners for the fallback modal
                const filenameInput = document.getElementById('new-file-name');
                filenameInput.focus();
            });
    }
    
    showNewFolderModal(parentFolder = '') {
        const modal = document.getElementById('modal');
        const modalTitle = document.getElementById('modal-title');
        const modalBody = document.getElementById('modal-body');
        
        modalTitle.textContent = parentFolder 
            ? `Create New Folder in "${parentFolder}"`
            : 'Create New Folder';
                
        modalBody.innerHTML = `
            <div style="margin-bottom: 15px;">
                <label for="new-folder-name">Folder Name:</label>
                <input type="text" id="new-folder-name" placeholder="Enter folder name" autocomplete="off" 
                    style="width: 100%; padding: 8px; margin-top: 5px; box-sizing: border-box;">
            </div>
            ${parentFolder ? `<div style="margin-bottom: 15px; font-size: 12px;">Will be created in: ${parentFolder}</div>` : ''}
            <div style="display: flex; justify-content: flex-end; margin-top: 20px;">
                <button class="cancel" style="margin-right: 10px;">Cancel</button>
                <button id="create-folder-btn">Create</button>
            </div>
        `;
        
        // Function to create the folder
        const createFolder = () => {
            const folderName = folderNameInput.value.trim();
            if (folderName) {
                this.createNewFolder(folderName, parentFolder);
                this.closeModal();
            } else {
                // Display an error if no folder name is provided
                folderNameInput.style.borderColor = 'red';
                folderNameInput.placeholder = 'Please enter a folder name';
            }
        };
        
        // Function to close the modal
        const closeModal = () => {
            this.closeModal();
        };
        
        // Add event listeners
        const cancelBtn = document.querySelector('.modal button.cancel');
        const createBtn = document.getElementById('create-folder-btn');
        
        // Cancel button click
        cancelBtn.addEventListener('click', closeModal);
        
        // Create button click
        createBtn.addEventListener('click', createFolder);
        
        // Add key event listeners for the entire modal
        const keyHandler = (e) => {
            // Enter key should confirm
            if (e.key === 'Enter') {
                e.preventDefault();
                createFolder();
            }
            // Escape key should cancel
            else if (e.key === 'Escape') {
                e.preventDefault();
                closeModal();
            }
        };
        
        // Add the key handler to the modal
        modal.addEventListener('keydown', keyHandler);
        
        // Clean up event listener when modal is closed
        const modalCloseObserver = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.attributeName === 'style' && 
                    modal.style.display === 'none') {
                    modal.removeEventListener('keydown', keyHandler);
                    modalCloseObserver.disconnect();
                }
            });
        });
        
        // Start observing the modal for attribute changes
        modalCloseObserver.observe(modal, { attributes: true });
        
        // Show the modal
        modal.style.display = 'block';

        // Set focus to the folder name input
        const folderNameInput = document.getElementById('new-folder-name');
        folderNameInput.focus();
    }
    
    showFileContextMenu(e, path) {
        const contextMenu = document.createElement('div');
        contextMenu.className = 'context-menu';
        contextMenu.style.position = 'fixed';
        contextMenu.style.top = `${e.clientY}px`;
        contextMenu.style.left = `${e.clientX}px`;
        contextMenu.style.backgroundColor = 'white';
        contextMenu.style.border = '1px solid #ddd';
        contextMenu.style.boxShadow = '0 2px 5px rgba(0, 0, 0, 0.2)';
        contextMenu.style.borderRadius = '4px';
        contextMenu.style.padding = '5px 0';
        contextMenu.style.zIndex = '1000';
        
        contextMenu.innerHTML = `
            <div class="context-menu-item" data-action="open">Open</div>
            <div class="context-menu-item" data-action="duplicate">Duplicate</div>
            <div class="context-menu-item" data-action="rename">Rename</div>
            <div class="context-menu-item" data-action="move">Move to...</div>
            <div class="context-menu-item" data-action="delete">Delete</div>
        `;
        
        document.body.appendChild(contextMenu);
        
        // Apply some basic styling to menu items
        const items = contextMenu.querySelectorAll('.context-menu-item');
        items.forEach(item => {
            item.style.padding = '8px 12px';
            item.style.cursor = 'pointer';
            item.style.fontSize = '14px';
            
            // Add hover effect
            item.addEventListener('mouseover', () => {
                item.style.backgroundColor = '#f0f0f0';
            });
            
            item.addEventListener('mouseout', () => {
                item.style.backgroundColor = 'transparent';
            });
        });
        
        // Handle context menu item clicks
        contextMenu.addEventListener('click', (event) => {
            const action = event.target.getAttribute('data-action');
            
            if (action === 'open') {
                this.loadFile(path);
            } else if (action === 'duplicate') {
                this.duplicateFile(path);
            } else if (action === 'rename') {
                this.showRenameFileModal(path);
            } else if (action === 'move') {
                this.showMoveFileModal(path);
            } else if (action === 'delete') {
                this.deleteFile(path);
            }
            
            // Remove the context menu
            document.body.removeChild(contextMenu);
        });
        
        // Close the context menu when clicking elsewhere
        const closeContextMenu = () => {
            if (document.body.contains(contextMenu)) {
                document.body.removeChild(contextMenu);
            }
            document.removeEventListener('click', closeContextMenu);
        };
        
        setTimeout(() => {
            document.addEventListener('click', closeContextMenu);
        }, 0);
    }
    
    showFolderContextMenu(e, path) {
        const contextMenu = document.createElement('div');
        contextMenu.className = 'context-menu';
        contextMenu.style.position = 'fixed';
        contextMenu.style.top = `${e.clientY}px`;
        contextMenu.style.left = `${e.clientX}px`;
        contextMenu.style.backgroundColor = 'white';
        contextMenu.style.border = '1px solid #ddd';
        contextMenu.style.boxShadow = '0 2px 5px rgba(0, 0, 0, 0.2)';
        contextMenu.style.borderRadius = '4px';
        contextMenu.style.padding = '5px 0';
        contextMenu.style.zIndex = '1000';
        
        contextMenu.innerHTML = `
            <div class="context-menu-item" data-action="new-file">New File</div>
            <div class="context-menu-item" data-action="new-folder">New Folder</div>
            <div class="context-menu-item" data-action="rename">Rename</div>
            <div class="context-menu-item" data-action="move">Move to...</div>
            <div class="context-menu-item" data-action="delete">Delete</div>
        `;
        
        document.body.appendChild(contextMenu);
        
        // Apply some basic styling to menu items
        const items = contextMenu.querySelectorAll('.context-menu-item');
        items.forEach(item => {
            item.style.padding = '8px 12px';
            item.style.cursor = 'pointer';
            item.style.fontSize = '14px';
            
            // Add hover effect
            item.addEventListener('mouseover', () => {
                item.style.backgroundColor = '#f0f0f0';
            });
            
            item.addEventListener('mouseout', () => {
                item.style.backgroundColor = 'transparent';
            });
        });
        
        // Handle context menu item clicks
        contextMenu.addEventListener('click', (event) => {
            const action = event.target.getAttribute('data-action');
            
            if (action === 'new-file') {
                this.showNewFileModal(path);
            } else if (action === 'new-folder') {
                this.showNewFolderModal(path);
            } else if (action === 'rename') {
                this.showRenameFolderModal(path);
            } else if (action === 'move') {
                this.showMoveFolderModal(path);
            } else if (action === 'delete') {
                this.deleteFolder(path);
            }
            
            // Remove the context menu
            document.body.removeChild(contextMenu);
        });
        
        // Close the context menu when clicking elsewhere
        const closeContextMenu = () => {
            if (document.body.contains(contextMenu)) {
                document.body.removeChild(contextMenu);
            }
            document.removeEventListener('click', closeContextMenu);
        };
        
        setTimeout(() => {
            document.addEventListener('click', closeContextMenu);
        }, 0);
    }
    
    showNewFileInFolderModal(folder) {
        // Use the updated showNewFileModal with the folder pre-selected
        this.showNewFileModal(folder);
    }
    
    showNewFolderInFolderModal(folder) {
        const modal = document.getElementById('modal');
        const modalTitle = document.getElementById('modal-title');
        const modalBody = document.getElementById('modal-body');
        
        modalTitle.textContent = `Create New Folder in "${folder}"`;
        modalBody.innerHTML = `
            <input type="text" id="new-folder-name" placeholder="Enter folder name">
            <div>
                <button class="cancel">Cancel</button>
                <button id="create-folder-btn">Create</button>
            </div>
        `;
        
        document.querySelector('.modal button.cancel').addEventListener('click', () => {
            this.closeModal();
        });
        
        document.getElementById('create-folder-btn').addEventListener('click', () => {
            const folderName = document.getElementById('new-folder-name').value.trim();
            if (folderName) {
                this.createNewFolder(folderName, folder);
                this.closeModal();
            }
        });
        
        modal.style.display = 'block';

        // Focus the text box
        document.getElementById('new-folder-name').focus();
    }

    showSaveAsModal() {
        // We can only save as if there's a current file
        if (!this.currentFilePath && !window.editor.getContent().trim()) {
            alert('No content to save. Please create some content first.');
            return;
        }
        
        const modal = document.getElementById('modal');
        const modalTitle = document.getElementById('modal-title');
        const modalBody = document.getElementById('modal-body');
        
        modalTitle.textContent = 'Save As';
        
        // Capture current editor content
        let currentContent = '';
        if (window.editor && typeof window.editor.getContent === 'function') {
            currentContent = window.editor.getContent();
        }
        
        // First load the folder structure to populate the dropdown
        fetch('/api/files')
            .then(response => response.json())
            .then(files => {
                // Filter to get only directories
                const folders = files.filter(item => item.type === 'directory').map(dir => dir.path);
                
                // Always include root directory option
                folders.unshift('(Root Directory)');
                
                // Extract current filename and directory if a file is open
                let currentFolder = '';
                let currentFilename = '';
                
                if (this.currentFilePath) {
                    if (this.currentFilePath.includes('/')) {
                        currentFolder = this.currentFilePath.substring(0, this.currentFilePath.lastIndexOf('/'));
                        currentFilename = this.currentFilePath.split('/').pop();
                    } else {
                        currentFilename = this.currentFilePath;
                    }
                    
                    // Remove .md extension for display
                    if (currentFilename.endsWith('.md')) {
                        currentFilename = currentFilename.slice(0, -3);
                    }
                }
                
                // Create dropdown HTML
                const options = folders.map(folder => {
                    const displayName = folder === '(Root Directory)' ? folder : folder;
                    const value = folder === '(Root Directory)' ? '' : folder;
                    const selected = value === currentFolder ? 'selected' : '';
                    return `<option value="${value}" ${selected}>${displayName}</option>`;
                }).join('');
                
                // Build the modal body with folder selection
                modalBody.innerHTML = `
                    <div style="margin-bottom: 15px;">
                        <label for="save-as-file-name">File Name:</label>
                        <input type="text" id="save-as-file-name" placeholder="Enter file name" autocomplete="off" 
                            value="${currentFilename ? currentFilename : ''}"
                            style="width: 100%; padding: 8px; margin-top: 5px; box-sizing: border-box;">
                    </div>
                    
                    <div style="margin-bottom: 15px;">
                        <label for="folder-select">Location:</label>
                        <select id="folder-select" style="width: 100%; padding: 8px; margin-top: 5px; box-sizing: border-box;">
                            ${options}
                        </select>
                    </div>
                    
                    <div style="display: flex; justify-content: flex-end; margin-top: 20px;">
                        <button class="cancel" style="margin-right: 10px;">Cancel</button>
                        <button id="save-as-btn">Save</button>
                    </div>
                `;
                
                // Function to save the file as a new file
                const saveAsNewFile = () => {
                    const fileName = document.getElementById('save-as-file-name').value.trim();
                    const selectedFolder = document.getElementById('folder-select').value;
                    
                    if (fileName) {
                        // Create the new file path
                        const path = selectedFolder ? `${selectedFolder}/${fileName}` : fileName;
                        const finalPath = path.endsWith('.md') ? path : `${path}.md`;
                        
                        // First check if file exists
                        fetch(`/api/file?path=${encodeURIComponent(finalPath)}`)
                            .then(response => {
                                if (response.ok) {
                                    // File exists, ask for confirmation to overwrite
                                    return confirm(`File "${finalPath}" already exists. Overwrite?`);
                                }
                                return true; // File doesn't exist, proceed
                            })
                            .then(shouldProceed => {
                                if (!shouldProceed) return;
                                
                                // Store the previous path to restore in case of error
                                const previousPath = this.currentFilePath;
                                
                                // Update the current path to the new file
                                this.currentFilePath = finalPath;
                                
                                // Update the document title with the new file name
                                this.updateDocumentTitle(finalPath);
                                
                                // Get format options from the editor
                                const formatOptions = window.editor && window.editor.currentFormatOptions 
                                    ? window.editor.currentFormatOptions
                                    : {
                                        font: 'Arial, sans-serif',
                                        fontSize: '16px',
                                        fontColor: '#333333'
                                    };
                                
                                // Create the new file with the current content
                                fetch('/api/file', {
                                    method: 'POST',
                                    headers: {
                                        'Content-Type': 'application/json'
                                    },
                                    body: JSON.stringify({
                                        path: finalPath,
                                        content: currentContent,
                                        formatOptions: formatOptions
                                    })
                                })
                                .then(response => {
                                    if (!response.ok) {
                                        throw new Error(`Server returned ${response.status}: ${response.statusText}`);
                                    }
                                    return response.json();
                                })
                                .then(data => {
                                    if (data.success) {
                                        console.log("File saved as:", finalPath);
                                        
                                        // If there's content, make sure it's set in the editor
                                        if (window.editor && typeof window.editor.setContent === 'function') {
                                            window.editor.setContent(currentContent);
                                            window.editor._lastSavedContent = currentContent;
                                        }
                                        
                                        this.loadFileTree();
                                        this.refreshAvailableDocuments();
                                        
                                        // Show save indicator
                                        this.showSaveIndicator(false);
                                    } else {
                                        console.error('Error saving file:', data.error);
                                        alert('Error saving file: ' + (data.error || 'Unknown error'));
                                        
                                        // Revert to previous path if there was an error
                                        this.currentFilePath = previousPath;
                                        this.updateDocumentTitle(previousPath);
                                    }
                                })
                                .catch(error => {
                                    console.error('Error saving file:', error);
                                    alert('Error saving file: ' + error.message);
                                    
                                    // Revert to previous path if there was an error
                                    this.currentFilePath = previousPath;
                                    this.updateDocumentTitle(previousPath);
                                });
                                
                                this.closeModal();
                            });
                    } else {
                        // Display an error if no filename is provided
                        const nameInput = document.getElementById('save-as-file-name');
                        nameInput.style.borderColor = 'red';
                        nameInput.placeholder = 'Please enter a file name';
                    }
                };
                
                // Add event listeners
                const cancelBtn = document.querySelector('.modal button.cancel');
                const saveAsBtn = document.getElementById('save-as-btn');
                
                // Function to close the modal
                const closeModal = () => {
                    this.closeModal();
                };
                
                // Cancel button click
                cancelBtn.addEventListener('click', closeModal);
                
                // Save As button click
                saveAsBtn.addEventListener('click', saveAsNewFile);
                
                // Add key event listeners for the entire modal
                const keyHandler = (e) => {
                    // Enter key should confirm
                    if (e.key === 'Enter') {
                        e.preventDefault();
                        saveAsNewFile();
                    }
                    // Escape key should cancel
                    else if (e.key === 'Escape') {
                        e.preventDefault();
                        closeModal();
                    }
                };
                
                // Add the key handler to the modal
                modal.addEventListener('keydown', keyHandler);
                
                // Clean up event listener when modal is closed
                const modalCloseObserver = new MutationObserver((mutations) => {
                    mutations.forEach((mutation) => {
                        if (mutation.attributeName === 'style' && 
                            modal.style.display === 'none') {
                            modal.removeEventListener('keydown', keyHandler);
                            modalCloseObserver.disconnect();
                        }
                    });
                });
                
                // Start observing the modal for attribute changes
                modalCloseObserver.observe(modal, { attributes: true });
                
                // Show the modal
                modal.style.display = 'block';

                // Set focus to the filename input
                const filenameInput = document.getElementById('save-as-file-name');
                filenameInput.focus();
                filenameInput.select();
            })
            .catch(error => {
                console.error('Error loading folders:', error);
                
                // Fall back to a simpler modal without folder selection
                modalBody.innerHTML = `
                    <div style="margin-bottom: 15px;">
                        <label for="save-as-file-name">File Name:</label>
                        <input type="text" id="save-as-file-name" placeholder="Enter file name" autocomplete="off" 
                            style="width: 100%; padding: 8px; margin-top: 5px; box-sizing: border-box;">
                    </div>
                    
                    <div style="display: flex; justify-content: flex-end; margin-top: 20px;">
                        <button class="cancel" style="margin-right: 10px;">Cancel</button>
                        <button id="save-as-btn">Save</button>
                    </div>
                `;
                
                // Simplified version of the save function
                const saveAsSimple = () => {
                    const fileName = document.getElementById('save-as-file-name').value.trim();
                    if (fileName) {
                        // Store the current path to reset it if needed
                        const previousPath = this.currentFilePath;
                        
                        // Create the new file path
                        const finalPath = fileName.endsWith('.md') ? fileName : `${fileName}.md`;
                        
                        // Set the current path
                        this.currentFilePath = finalPath;
                        
                        // Update the document title with the new file name
                        this.updateDocumentTitle(finalPath);
                        
                        // Get format options from the editor
                        const formatOptions = window.editor && window.editor.currentFormatOptions 
                            ? window.editor.currentFormatOptions
                            : {
                                font: 'Arial, sans-serif',
                                fontSize: '16px',
                                fontColor: '#333333'
                            };
                        
                        // Create the file on the server, including the current content
                        fetch('/api/file', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json'
                            },
                            body: JSON.stringify({
                                path: finalPath,
                                content: currentContent,
                                formatOptions: formatOptions
                            })
                        })
                        .then(response => {
                            if (!response.ok) {
                                throw new Error(`Server returned ${response.status}: ${response.statusText}`);
                            }
                            return response.json();
                        })
                        .then(data => {
                            if (data.success) {
                                console.log("File saved as:", finalPath);
                                
                                // If there's content, make sure it's set in the editor
                                if (window.editor && typeof window.editor.setContent === 'function') {
                                    window.editor.setContent(currentContent);
                                    window.editor._lastSavedContent = currentContent;
                                }
                                
                                this.loadFileTree();
                                this.refreshAvailableDocuments();
                                
                                // Show save indicator
                                this.showSaveIndicator(false);
                            } else {
                                console.error('Error saving file:', data.error);
                                alert('Error saving file: ' + (data.error || 'Unknown error'));
                                
                                // Revert to previous path if there was an error
                                this.currentFilePath = previousPath;
                                this.updateDocumentTitle(previousPath);
                            }
                        })
                        .catch(error => {
                            console.error('Error saving file:', error);
                            alert('Error saving file: ' + error.message);
                            
                            // Revert to previous path if there was an error
                            this.currentFilePath = previousPath;
                            this.updateDocumentTitle(previousPath);
                        });
                        
                        this.closeModal();
                    } else {
                        // Display an error if no filename is provided
                        const nameInput = document.getElementById('save-as-file-name');
                        nameInput.style.borderColor = 'red';
                        nameInput.placeholder = 'Please enter a file name';
                    }
                };
                
                // Add event listeners for the fallback modal
                const cancelBtn = document.querySelector('.modal button.cancel');
                const saveAsBtn = document.getElementById('save-as-btn');
                
                // Cancel button click
                cancelBtn.addEventListener('click', () => {
                    this.closeModal();
                });
                
                // Save As button click
                saveAsBtn.addEventListener('click', saveAsSimple);
                
                // Show the modal
                modal.style.display = 'block';
                
                // Set focus to the filename input
                const filenameInput = document.getElementById('save-as-file-name');
                filenameInput.focus();
            });
    }

    duplicateFile(path) {
        // First, load the file content
        fetch(`/api/file?path=${encodeURIComponent(path)}`)
            .then(response => {
                if (!response.ok) {
                    throw new Error(`Failed to load file: ${response.statusText}`);
                }
                return response.json();
            })
            .then(data => {
                if (data.error) {
                    console.error('Error loading file:', data.error);
                    return;
                }
                
                // Extract folder and filename
                let folder = '';
                let filename = path;
                
                if (path.includes('/')) {
                    folder = path.substring(0, path.lastIndexOf('/'));
                    filename = path.split('/').pop();
                }
                
                // Remove .md extension for display
                if (filename.endsWith('.md')) {
                    filename = filename.slice(0, -3);
                }
                
                // Create the new filename with "Copy of" prefix
                const newFilename = `Copy of ${filename}`;
                
                // Create the new path
                const newPath = folder ? `${folder}/${newFilename}.md` : `${newFilename}.md`;
                
                // Save the file with the new path
                fetch('/api/file', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        path: newPath,
                        content: data.content,
                        formatOptions: data.formatOptions
                    })
                })
                .then(response => {
                    if (!response.ok) {
                        throw new Error(`Server returned ${response.status}: ${response.statusText}`);
                    }
                    return response.json();
                })
                .then(saveData => {
                    if (saveData.success) {
                        console.log("File duplicated:", newPath);
                        this.loadFileTree();
                        this.refreshAvailableDocuments();
                        
                        // Optionally, load the new file
                        this.loadFile(newPath);
                    } else {
                        console.error('Error duplicating file:', saveData.error);
                        alert('Error duplicating file: ' + (saveData.error || 'Unknown error'));
                    }
                })
                .catch(error => {
                    console.error('Error duplicating file:', error);
                    alert('Error duplicating file: ' + error.message);
                });
            })
            .catch(error => {
                console.error('Error loading file for duplication:', error);
                alert('Error loading file for duplication: ' + error.message);
            });
    }
    
    closeModal() {
        const modal = document.getElementById('modal');
        
        // Hide the modal
        modal.style.display = 'none';
        
        // Clear the modal content to prevent memory leaks from lingering event handlers
        const modalBody = document.getElementById('modal-body');
        modalBody.innerHTML = '';
    }
    
    // Show link insert modal
    showLinkInsertModal() {
        const modal = document.getElementById('modal');
        const modalTitle = document.getElementById('modal-title');
        const modalBody = document.getElementById('modal-body');
        
        modalTitle.textContent = 'Insert Link';
        modalBody.innerHTML = `
            <div>
                <label for="link-text">Link Text:</label>
                <input type="text" id="link-text" placeholder="Enter link text" autocomplete="off">
            </div>
            <div style="margin-top: 10px;">
                <label for="link-url">Link URL:</label>
                <input type="text" id="link-url" placeholder="Enter URL or select a document" autocomplete="off">
            </div>
            <div style="margin-top: 10px;">
                <label>Or select a document:</label>
                <select id="document-select">
                    <option value="">-- Select a document --</option>
                </select>
            </div>
            <div style="margin-top: 15px;">
                <button class="cancel">Cancel</button>
                <button id="insert-link-btn">Insert</button>
            </div>
        `;
        
        // Populate the document select dropdown
        fetch('/api/files')
            .then(response => response.json())
            .then(files => {
                const docSelect = document.getElementById('document-select');
                
                files.filter(file => file.type === 'file').forEach(file => {
                    const option = document.createElement('option');
                    option.value = file.path;
                    option.textContent = file.path;
                    docSelect.appendChild(option);
                });
            })
            .catch(error => console.error('Error loading documents for link:', error));
        
        // Handle document selection
        document.getElementById('document-select').addEventListener('change', function() {
            if (this.value) {
                document.getElementById('link-url').value = this.value;
            }
        });
        
        document.querySelector('.modal button.cancel').addEventListener('click', () => {
            this.closeModal();
        });
        
        document.getElementById('insert-link-btn').addEventListener('click', () => {
            const text = document.getElementById('link-text').value.trim();
            const url = document.getElementById('link-url').value.trim();
            
            if (text && url) {
                editor.insertLink(text, url);
                this.closeModal();
                
                // Auto-save after link insertion
                setTimeout(() => this.saveCurrentFile(), 500);
            } else {
                alert('Please enter both link text and URL.');
            }
        });
            
        modal.style.display = 'block';
    }

    // Show image upload modal
    showImageUploadModal() {
        const modal = document.getElementById('modal');
        const modalTitle = document.getElementById('modal-title');
        const modalBody = document.getElementById('modal-body');
        
        modalTitle.textContent = 'Insert Image';
        modalBody.innerHTML = `
            <div class="file-upload" id="file-upload">
                <p>Drag & drop an image here, or click to select an image</p>
                <input type="file" id="image-file-input" accept="image/*" style="display: none;">
            </div>
            <div>
                <button class="cancel">Cancel</button>
            </div>
        `;
        
        const fileUpload = document.getElementById('file-upload');
        const fileInput = document.getElementById('image-file-input');
        
        // Open file dialog when clicking on the upload area
        fileUpload.addEventListener('click', () => {
            fileInput.click();
        });
        
        // Handle file selection
        fileInput.addEventListener('change', () => {
            if (fileInput.files.length > 0) {
                this.uploadAttachment(fileInput.files[0])
                    .then(url => {
                        if (window.editor && typeof window.editor.insertImage === 'function') {
                            window.editor.insertImage(url);
                        }
                        this.closeModal();
                    })
                    .catch(error => {
                        console.error('Error uploading image:', error);
                        alert('Error uploading image: ' + error.message);
                    });
            }
        });
        
        // Drag and drop functionality
        fileUpload.addEventListener('dragover', (e) => {
            e.preventDefault();
            fileUpload.classList.add('dragover');
        });
        
        fileUpload.addEventListener('dragleave', () => {
            fileUpload.classList.remove('dragover');
        });
        
        fileUpload.addEventListener('drop', (e) => {
            e.preventDefault();
            fileUpload.classList.remove('dragover');
            
            if (e.dataTransfer.files.length > 0) {
                const file = e.dataTransfer.files[0];
                if (file.type.startsWith('image/')) {
                    this.uploadAttachment(file)
                        .then(url => {
                            if (window.editor && typeof window.editor.insertImage === 'function') {
                                window.editor.insertImage(url);
                            }
                            this.closeModal();
                        })
                        .catch(error => {
                            console.error('Error uploading image:', error);
                            alert('Error uploading image: ' + error.message);
                        });
                } else {
                    alert('Please upload an image file.');
                }
            }
        });
        
        document.querySelector('.modal button.cancel').addEventListener('click', () => {
            this.closeModal();
        });
        
        modal.style.display = 'block';
    }

    refreshAvailableDocuments() {
        if (window.editor && typeof window.editor.loadAvailableDocuments === 'function') {
            window.editor.loadAvailableDocuments();
        }
    }

    updateDocumentTitle(path) {
        // If no path is provided, show "Untitled Document - Markdown Writer"
        if (!path) {
            document.title = "Untitled Document - WriteSimplr";
            return;
        }
        
        // Extract the filename from the path
        const filename = path.split('/').pop();
        
        // Set the document title to "filename - Markdown Writer"
        document.title = `${filename} - WriteSimplr`;
    }

    // Rename a file
    renameFile(oldPath, newName) {
        // Extract the directory path from the old path
        const dirPath = oldPath.includes('/') ? oldPath.substring(0, oldPath.lastIndexOf('/')) : '';
        
        // Create the new path based on the directory and new name
        const newPath = dirPath ? `${dirPath}/${newName}` : newName;
        
        // Ensure .md extension is preserved
        const finalNewPath = oldPath.endsWith('.md') && !newPath.endsWith('.md') ? `${newPath}.md` : newPath;
        
        // Call the API
        fetch('/api/file/rename', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                oldPath: oldPath,
                newPath: finalNewPath
            })
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                console.log(`Renamed file from ${oldPath} to ${finalNewPath}`);
                
                // Update the current file path if this was the active file
                if (this.currentFilePath === oldPath) {
                    this.currentFilePath = finalNewPath;
                    this.updateDocumentTitle(finalNewPath);
                }
                
                // Refresh the file tree and document list
                this.loadFileTree();
                this.refreshAvailableDocuments();
            } else {
                console.error('Error renaming file:', data.error);
                alert(`Error renaming file: ${data.error}`);
            }
        })
        .catch(error => {
            console.error('Error renaming file:', error);
            alert(`Error renaming file: ${error.message}`);
        });
    }

    // Rename a folder
    renameFolder(oldPath, newName) {
        // Extract the parent directory path from the old path
        const parentPath = oldPath.includes('/') ? oldPath.substring(0, oldPath.lastIndexOf('/')) : '';
        
        // Create the new path based on the parent directory and new name
        const newPath = parentPath ? `${parentPath}/${newName}` : newName;
        
        // Call the API
        fetch('/api/directory/rename', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                oldPath: oldPath,
                newPath: newPath
            })
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                console.log(`Renamed folder from ${oldPath} to ${newPath}`);
                
                // If the current file was in this folder, update its path
                if (this.currentFilePath && this.currentFilePath.startsWith(oldPath + '/')) {
                    // Replace the old folder prefix with the new one
                    this.currentFilePath = this.currentFilePath.replace(
                        oldPath, newPath
                    );
                    this.updateDocumentTitle(this.currentFilePath);
                }
                
                // Refresh the file tree and document list
                this.loadFileTree();
                this.refreshAvailableDocuments();
            } else {
                console.error('Error renaming folder:', data.error);
                alert(`Error renaming folder: ${data.error}`);
            }
        })
        .catch(error => {
            console.error('Error renaming folder:', error);
            alert(`Error renaming folder: ${error.message}`);
        });
    }

    // Move a file to a different folder
    moveFile(filePath, targetFolder) {
        // Extract the file name from the path
        const fileName = filePath.split('/').pop();
        
        // Create the new path
        const newPath = targetFolder ? `${targetFolder}/${fileName}` : fileName;
        
        // Don't do anything if the paths are the same
        if (filePath === newPath) {
            console.log('File is already in this location');
            return;
        }
        
        console.log(`Moving file from "${filePath}" to "${newPath}"`);
        
        // Use the rename API to move the file
        fetch('/api/file/rename', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                oldPath: filePath,
                newPath: newPath
            })
        })
        .then(response => {
            if (!response.ok) {
                throw new Error(`Server returned ${response.status}: ${response.statusText}`);
            }
            return response.json();
        })
        .then(data => {
            if (data.success) {
                console.log(`Successfully moved file from "${filePath}" to "${newPath}"`);
                
                // Update the current file path if this was the active file
                if (this.currentFilePath === filePath) {
                    this.currentFilePath = newPath;
                    this.updateDocumentTitle(newPath);
                }
                
                // Refresh the file tree and document list
                this.loadFileTree();
                this.refreshAvailableDocuments();
            } else {
                console.error('Error moving file:', data.error);
                alert(`Error moving file: ${data.error}`);
            }
        })
        .catch(error => {
            console.error('Error moving file:', error);
            alert(`Error moving file: ${error.message}`);
        });
    }

    // Move a folder to a different location
    moveFolder(folderPath, targetFolder) {
        // Extract the folder name from the path
        const folderName = folderPath.split('/').pop();
        
        // Create the new path
        const newPath = targetFolder ? `${targetFolder}/${folderName}` : folderName;
        
        // Don't do anything if the paths are the same
        if (folderPath === newPath) {
            console.log('Folder is already in this location');
            return;
        }
        
        // Don't allow moving a folder into its own subfolder
        if (newPath.startsWith(folderPath + '/')) {
            console.error('Cannot move a folder into its own subfolder');
            alert('Cannot move a folder into its own subfolder');
            return;
        }
        
        console.log(`Moving folder from "${folderPath}" to "${newPath}"`);
        
        // Use the rename API to move the folder
        fetch('/api/directory/rename', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                oldPath: folderPath,
                newPath: newPath
            })
        })
        .then(response => {
            if (!response.ok) {
                throw new Error(`Server returned ${response.status}: ${response.statusText}`);
            }
            return response.json();
        })
        .then(data => {
            if (data.success) {
                console.log(`Successfully moved folder from "${folderPath}" to "${newPath}"`);
                
                // If the current file was in this folder, update its path
                if (this.currentFilePath && this.currentFilePath.startsWith(folderPath + '/')) {
                    // Replace the old folder prefix with the new one
                    this.currentFilePath = this.currentFilePath.replace(
                        folderPath, newPath
                    );
                    this.updateDocumentTitle(this.currentFilePath);
                }
                
                // Refresh the file tree and document list
                this.loadFileTree();
                this.refreshAvailableDocuments();
            } else {
                console.error('Error moving folder:', data.error);
                alert(`Error moving folder: ${data.error}`);
            }
        })
        .catch(error => {
            console.error('Error moving folder:', error);
            alert(`Error moving folder: ${error.message}`);
        });
    }

    // Show rename file modal
    showRenameFileModal(path) {
        const fileName = path.split('/').pop();
        const baseName = fileName.endsWith('.md') ? fileName.slice(0, -3) : fileName;
        
        const modal = document.getElementById('modal');
        const modalTitle = document.getElementById('modal-title');
        const modalBody = document.getElementById('modal-body');
        
        modalTitle.textContent = `Rename File "${fileName}"`;
        modalBody.innerHTML = `
            <div style="margin-bottom: 15px;">
                <label for="rename-file-input">New Name:</label>
                <input type="text" id="rename-file-input" placeholder="Enter new name" value="${baseName}" autocomplete="off"
                    style="width: 100%; padding: 8px; margin-top: 5px; box-sizing: border-box;">
            </div>
            <div style="display: flex; justify-content: flex-end; margin-top: 20px;">
                <button class="cancel" style="margin-right: 10px;">Cancel</button>
                <button id="rename-file-btn">Rename</button>
            </div>
        `;
        
        // Function to rename the file
        const renameFile = () => {
            const newName = renameInput.value.trim();
            if (newName) {
                this.renameFile(path, newName);
                this.closeModal();
            } else {
                // Display an error if no name is provided
                renameInput.style.borderColor = 'red';
                renameInput.placeholder = 'Please enter a name';
            }
        };
        
        // Function to close the modal
        const closeModal = () => {
            this.closeModal();
        };
        
        // Add event listeners
        const cancelBtn = document.querySelector('.modal button.cancel');
        const renameBtn = document.getElementById('rename-file-btn');
        
        // Cancel button click
        cancelBtn.addEventListener('click', closeModal);
        
        // Rename button click
        renameBtn.addEventListener('click', renameFile);
        
        // Add key event listeners for the entire modal
        const keyHandler = (e) => {
            // Enter key should confirm
            if (e.key === 'Enter') {
                e.preventDefault();
                renameFile();
            }
            // Escape key should cancel
            else if (e.key === 'Escape') {
                e.preventDefault();
                closeModal();
            }
        };
        
        // Add the key handler to the modal
        modal.addEventListener('keydown', keyHandler);
        
        // Clean up event listener when modal is closed
        const modalCloseObserver = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.attributeName === 'style' && 
                    modal.style.display === 'none') {
                    modal.removeEventListener('keydown', keyHandler);
                    modalCloseObserver.disconnect();
                }
            });
        });
        
        // Start observing the modal for attribute changes
        modalCloseObserver.observe(modal, { attributes: true });
        
        // Show the modal
        modal.style.display = 'block';

        // Set focus and select the text in the input
        const renameInput = document.getElementById('rename-file-input');
        renameInput.focus();
        renameInput.select();
    }

    // Show rename folder modal
    showRenameFolderModal(path) {
        const folderName = path.split('/').pop();
        
        const modal = document.getElementById('modal');
        const modalTitle = document.getElementById('modal-title');
        const modalBody = document.getElementById('modal-body');
        
        modalTitle.textContent = `Rename Folder "${folderName}"`;
        modalBody.innerHTML = `
            <div style="margin-bottom: 15px;">
                <label for="rename-folder-input">New Name:</label>
                <input type="text" id="rename-folder-input" placeholder="Enter new name" value="${folderName}" autocomplete="off"
                    style="width: 100%; padding: 8px; margin-top: 5px; box-sizing: border-box;">
            </div>
            <div style="display: flex; justify-content: flex-end; margin-top: 20px;">
                <button class="cancel" style="margin-right: 10px;">Cancel</button>
                <button id="rename-folder-btn">Rename</button>
            </div>
        `;
        
        // Function to rename the folder
        const renameFolder = () => {
            const newName = renameInput.value.trim();
            if (newName) {
                this.renameFolder(path, newName);
                this.closeModal();
            } else {
                // Display an error if no name is provided
                renameInput.style.borderColor = 'red';
                renameInput.placeholder = 'Please enter a name';
            }
        };
        
        // Function to close the modal
        const closeModal = () => {
            this.closeModal();
        };
        
        // Add event listeners
        const cancelBtn = document.querySelector('.modal button.cancel');
        const renameBtn = document.getElementById('rename-folder-btn');
        
        // Cancel button click
        cancelBtn.addEventListener('click', closeModal);
        
        // Rename button click
        renameBtn.addEventListener('click', renameFolder);
        
        // Add key event listeners for the entire modal
        const keyHandler = (e) => {
            // Enter key should confirm
            if (e.key === 'Enter') {
                e.preventDefault();
                renameFolder();
            }
            // Escape key should cancel
            else if (e.key === 'Escape') {
                e.preventDefault();
                closeModal();
            }
        };
        
        // Add the key handler to the modal
        modal.addEventListener('keydown', keyHandler);
        
        // Clean up event listener when modal is closed
        const modalCloseObserver = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.attributeName === 'style' && 
                    modal.style.display === 'none') {
                    modal.removeEventListener('keydown', keyHandler);
                    modalCloseObserver.disconnect();
                }
            });
        });
        
        // Start observing the modal for attribute changes
        modalCloseObserver.observe(modal, { attributes: true });
        
        // Show the modal
        modal.style.display = 'block';

        // Set focus and select the text in the input
        const renameInput = document.getElementById('rename-folder-input');
        renameInput.focus();
        renameInput.select();
    }

    // Show move file modal with folder selection
    showMoveFileModal(filePath) {
        const fileName = filePath.split('/').pop();
        
        const modal = document.getElementById('modal');
        const modalTitle = document.getElementById('modal-title');
        const modalBody = document.getElementById('modal-body');
        
        modalTitle.textContent = `Move File "${fileName}"`;
        
        // First load the folder structure to populate the dropdown
        fetch('/api/files')
            .then(response => response.json())
            .then(files => {
                // Filter to get only directories
                const folders = files.filter(item => item.type === 'directory').map(dir => dir.path);
                
                // Always include root directory option
                folders.unshift('(Root Directory)');
                
                // Create dropdown HTML
                const options = folders.map(folder => {
                    const displayName = folder === '(Root Directory)' ? folder : folder;
                    const value = folder === '(Root Directory)' ? '' : folder;
                    return `<option value="${value}">${displayName}</option>`;
                }).join('');
                
                // Build the modal body
                modalBody.innerHTML = `
                    <div style="margin-bottom: 15px;">
                        <label for="move-folder-select">Select destination folder:</label>
                        <select id="move-folder-select" style="width: 100%; padding: 8px; margin-top: 5px; box-sizing: border-box;">
                            ${options}
                        </select>
                    </div>
                    <div style="display: flex; justify-content: flex-end; margin-top: 20px;">
                        <button class="cancel" style="margin-right: 10px;">Cancel</button>
                        <button id="move-file-btn">Move</button>
                    </div>
                `;
                
                // Function to move the file
                const moveFile = () => {
                    const selectedFolder = document.getElementById('move-folder-select').value;
                    this.moveFile(filePath, selectedFolder);
                    this.closeModal();
                };
                
                // Function to close the modal
                const closeModal = () => {
                    this.closeModal();
                };
                
                // Add event listeners
                const cancelBtn = document.querySelector('.modal button.cancel');
                const moveBtn = document.getElementById('move-file-btn');
                
                // Cancel button click
                cancelBtn.addEventListener('click', closeModal);
                
                // Move button click
                moveBtn.addEventListener('click', moveFile);
                
                // Add key event listeners for the entire modal
                const keyHandler = (e) => {
                    // Enter key should confirm
                    if (e.key === 'Enter') {
                        e.preventDefault();
                        moveFile();
                    }
                    // Escape key should cancel
                    else if (e.key === 'Escape') {
                        e.preventDefault();
                        closeModal();
                    }
                };
                
                // Add the key handler to the modal
                modal.addEventListener('keydown', keyHandler);
                
                // Clean up event listener when modal is closed
                const modalCloseObserver = new MutationObserver((mutations) => {
                    mutations.forEach((mutation) => {
                        if (mutation.attributeName === 'style' && 
                            modal.style.display === 'none') {
                            modal.removeEventListener('keydown', keyHandler);
                            modalCloseObserver.disconnect();
                        }
                    });
                });
                
                // Start observing the modal for attribute changes
                modalCloseObserver.observe(modal, { attributes: true });
                
                // Show the modal
                modal.style.display = 'block';

                // Focus the select element
                document.getElementById('move-folder-select').focus();
            })
            .catch(error => {
                console.error('Error loading folders for move:', error);
                alert(`Error loading folders: ${error.message}`);
            });
    }

    // Show move folder modal with folder selection
    showMoveFolderModal(folderPath) {
        const folderName = folderPath.split('/').pop();
        
        const modal = document.getElementById('modal');
        const modalTitle = document.getElementById('modal-title');
        const modalBody = document.getElementById('modal-body');
        
        modalTitle.textContent = `Move Folder "${folderName}"`;
        
        // First load the folder structure to populate the dropdown
        fetch('/api/files')
            .then(response => response.json())
            .then(files => {
                // Filter to get only directories
                let folders = files.filter(item => item.type === 'directory').map(dir => dir.path);
                
                // Remove the current folder and its subfolders
                folders = folders.filter(folder => 
                    folder !== folderPath && !folder.startsWith(folderPath + '/'));
                
                // Always include root directory option
                folders.unshift('(Root Directory)');
                
                // Create dropdown HTML
                const options = folders.map(folder => {
                    const displayName = folder === '(Root Directory)' ? folder : folder;
                    const value = folder === '(Root Directory)' ? '' : folder;
                    return `<option value="${value}">${displayName}</option>`;
                }).join('');
                
                // Build the modal body
                modalBody.innerHTML = `
                    <div style="margin-bottom: 15px;">
                        <label for="move-folder-select">Select destination folder:</label>
                        <select id="move-folder-select" style="width: 100%; padding: 8px; margin-top: 5px; box-sizing: border-box;">
                            ${options}
                        </select>
                    </div>
                    <div style="display: flex; justify-content: flex-end; margin-top: 20px;">
                        <button class="cancel" style="margin-right: 10px;">Cancel</button>
                        <button id="move-folder-btn">Move</button>
                    </div>
                `;
                
                // Function to move the folder
                const moveFolder = () => {
                    const selectedFolder = document.getElementById('move-folder-select').value;
                    this.moveFolder(folderPath, selectedFolder);
                    this.closeModal();
                };
                
                // Function to close the modal
                const closeModal = () => {
                    this.closeModal();
                };
                
                // Add event listeners
                const cancelBtn = document.querySelector('.modal button.cancel');
                const moveBtn = document.getElementById('move-folder-btn');
                
                // Cancel button click
                cancelBtn.addEventListener('click', closeModal);
                
                // Move button click
                moveBtn.addEventListener('click', moveFolder);
                
                // Add key event listeners for the entire modal
                const keyHandler = (e) => {
                    // Enter key should confirm
                    if (e.key === 'Enter') {
                        e.preventDefault();
                        moveFolder();
                    }
                    // Escape key should cancel
                    else if (e.key === 'Escape') {
                        e.preventDefault();
                        closeModal();
                    }
                };
                
                // Add the key handler to the modal
                modal.addEventListener('keydown', keyHandler);
                
                // Clean up event listener when modal is closed
                const modalCloseObserver = new MutationObserver((mutations) => {
                    mutations.forEach((mutation) => {
                        if (mutation.attributeName === 'style' && 
                            modal.style.display === 'none') {
                            modal.removeEventListener('keydown', keyHandler);
                            modalCloseObserver.disconnect();
                        }
                    });
                });
                
                // Start observing the modal for attribute changes
                modalCloseObserver.observe(modal, { attributes: true });
                
                // Show the modal
                modal.style.display = 'block';

                // Focus the select element
                document.getElementById('move-folder-select').focus();
            })
            .catch(error => {
                console.error('Error loading folders for move:', error);
                alert(`Error loading folders: ${error.message}`);
            });
    }
}