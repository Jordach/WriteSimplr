/**
 * Main application initialization
 */
 document.addEventListener('DOMContentLoaded', () => {
    // Initialize settings manager first
    window.settingsManager = new SettingsManager();
    
    // Initialize file manager
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
    
    // Setup XHR interception for authentication
    setupAuthInterception();
});

/**
 * Setup XHR interception for handling authentication
 */
function setupAuthInterception() {
    // Store original fetch
    const originalFetch = window.fetch;
    
    // Override fetch to add authentication headers
    window.fetch = function(url, options = {}) {
        // Only intercept API requests
        if (typeof url === 'string' && url.startsWith('/api/')) {
            // Clone options to avoid modifying the original
            const newOptions = { ...options };
            
            // Initialize headers if not present
            newOptions.headers = newOptions.headers || {};
            
            // Add authentication header if available
            if (window.authHeader && !newOptions.headers['Authorization']) {
                newOptions.headers = {
                    ...newOptions.headers,
                    'Authorization': window.authHeader
                };
            }
            
            // Make the request
            return originalFetch(url, newOptions)
                .then(response => {
                    // Check for authentication errors
                    if (response.status === 401) {
                        // Save the failed operation to retry after authentication
                        window._lastAuthFailedOperation = () => {
                            // Retry the request with updated auth header
                            const retryOptions = { ...newOptions };
                            if (window.authHeader) {
                                retryOptions.headers = {
                                    ...retryOptions.headers,
                                    'Authorization': window.authHeader
                                };
                            }
                            return originalFetch(url, retryOptions);
                        };
                        
                        // Dispatch event to show login modal
                        document.dispatchEvent(new CustomEvent('auth-error'));
                    }
                    return response;
                });
        }
        
        // For non-API requests, use original fetch
        return originalFetch(url, options);
    };
}