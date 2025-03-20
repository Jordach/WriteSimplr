/**
 * Main application initialization
 */
document.addEventListener('DOMContentLoaded', () => {
    // Initialize file manager first
    window.fileManager = new FileManager();
    
    // Initialize editor
    window.editor = new Editor();
    
    // Initialize navigation sidebar - with a slight delay to ensure editor is fully initialized
    setTimeout(() => {
        window.navigationSidebar = new NavigationSidebar();
    }, 500);
    
    // Properly connect components after initialization
    // This ensures that methods like createNewDocument have access to both objects
    if (window.fileManager && window.editor) {
        // Set up a reference to the editor in the fileManager
        fileManager.editor = editor;
        
        // Load the file tree
        fileManager.loadFileTree();
        
        console.log("Application initialized successfully");
    } else {
        console.error("Failed to initialize application components");
    }
    
    // Connect navigation sidebar to editor events - wait for editor to be fully initialized
    setTimeout(() => {
        if (window.editor && window.editor.editor) {
            // Listen for editor content changes to update the navigation
            window.editor.editor.on('change', () => {
                // Debounce the scanning to avoid excessive updates
                clearTimeout(window._navScanTimeout);
                window._navScanTimeout = setTimeout(() => {
                    if (window.navigationSidebar) {
                        window.navigationSidebar.scanDocumentHeadings();
                    }
                }, 500);
            });
            
            // Update navigation when scrolling the editor content
            const editorElement = document.querySelector('.toastui-editor-contents') || 
                                document.querySelector('.toastui-editor-md-preview');
            
            if (editorElement) {
                editorElement.addEventListener('scroll', () => {
                    if (window.navigationSidebar) {
                        window.navigationSidebar.updateActiveHeadingOnScroll();
                    }
                });
            }
        }
    }, 1000);
});