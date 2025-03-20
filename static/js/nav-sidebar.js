class NavigationSidebar {
    constructor() {
        this.sidebarElement = null;
        this.toggleButton = null;
        this.navContent = null;
        this.closeButton = null;
        this.overlay = null;
        this.isActive = false;
        this.headingMap = new Map(); // Maps heading elements to their nav items
        
        // Initialize the sidebar when the document is ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.initialize());
        } else {
            this.initialize();
        }
    }
    
    initialize() {
        console.log("Initializing Navigation Sidebar");
        
        // Create the sidebar elements
        this.createSidebarElements();
        
        // Attach event listeners
        this.attachEventListeners();
        
        // Hide initially
        this.sidebarElement.classList.remove('active');
        
        // Perform initial heading scan
        this.scanDocumentHeadings();
    }
    
    createSidebarElements() {
        // Get the editor container to append the sidebar
        const editorContainer = document.querySelector('.editor-container');
        if (!editorContainer) {
            console.error('Editor container not found, cannot attach navigation sidebar');
            return;
        }
        
        // Add the sidebar HTML to the document
        const sidebarHtml = document.querySelector('#nav-sidebar');
        
        if (!sidebarHtml) {
            // Elements don't exist yet, so create and append them
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = `
                <!-- Navigation Sidebar -->
                <div id="nav-sidebar" class="nav-sidebar">
                    <div class="nav-sidebar-header">
                        <h3>Document Navigation</h3>
                        <button id="close-nav-sidebar" class="close-nav-btn">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                    <div id="nav-sidebar-content" class="nav-sidebar-content">
                        <!-- Navigation tree will be populated here -->
                    </div>
                </div>
                
                <!-- Overlay for sidebar -->
                <div id="nav-overlay" class="nav-overlay"></div>
            `;
            
            // Append the elements to the editor container instead of body
            while (tempDiv.firstChild) {
                editorContainer.appendChild(tempDiv.firstChild);
            }
        }
        
        // Get references to the elements
        this.sidebarElement = document.getElementById('nav-sidebar');
        this.navContent = document.getElementById('nav-sidebar-content');
        this.closeButton = document.getElementById('close-nav-sidebar');
        this.overlay = document.getElementById('nav-overlay');
        
        console.log("Navigation sidebar elements created:", {
            sidebar: this.sidebarElement,
            content: this.navContent,
            closeButton: this.closeButton,
            overlay: this.overlay
        });
    }
    
    attachEventListeners() {
        // // Toggle sidebar visibility
        // this.toggleButton.addEventListener('click', () => {
        //     this.toggleSidebar();
        // });
        
        // Close the sidebar
        this.closeButton.addEventListener('click', () => {
            this.closeSidebar();
        });
        
        // Close when clicking overlay
        this.overlay.addEventListener('click', () => {
            this.closeSidebar();
        });
        
        // Close on escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.isActive) {
                this.closeSidebar();
            }
        });
        
        // Listen for editor content changes to update the navigation
        if (window.editor && window.editor.editor) {
            const toastEditor = window.editor.editor;
            
            toastEditor.on('change', () => {
                // Debounce the scanning to avoid excessive updates
                clearTimeout(this._scanTimeout);
                this._scanTimeout = setTimeout(() => {
                    this.scanDocumentHeadings();
                }, 500);
            });
        }
    }
    
    toggleSidebar() {
        if (this.isActive) {
            this.closeSidebar();
        } else {
            this.openSidebar();
        }
    }
    
    openSidebar() {
        // Scan for headings before opening
        this.scanDocumentHeadings();
        
        // Show the sidebar
        this.sidebarElement.classList.add('active');
        this.overlay.classList.add('active');
        this.isActive = true;
    }
    
    closeSidebar() {
        this.sidebarElement.classList.remove('active');
        this.overlay.classList.remove('active');
        this.isActive = false;
    }
    
    /**
     * Scan the document for h2, h3, and h4 headings and build the navigation tree
     */
    scanDocumentHeadings() {
        // Clear the heading map
        this.headingMap.clear();
        
        // Clear the navigation content
        this.navContent.innerHTML = '';
        
        // Get the editor content container
        let contentContainer = null;
        if (window.editor && window.editor.editor) {
            const toastEditor = window.editor.editor;
            
            // Find the content container based on the current mode
            if (toastEditor.isWysiwygMode()) {
                contentContainer = document.querySelector('.toastui-editor-contents');
            } else {
                // In markdown mode, find the preview element
                contentContainer = document.querySelector('.toastui-editor-md-preview');
            }
        }
        
        if (!contentContainer) {
            console.warn('Could not find editor content container');
            return;
        }
        
        // Find all headings (h2, h3, h4)
        const headings = contentContainer.querySelectorAll('h2, h3, h4');
        
        if (headings.length === 0) {
            this.navContent.innerHTML = '<div class="nav-empty" style="padding: 15px; color: #777; text-align: center;">No headings found in document.</div>';
            return;
        }
        
        // Create the navigation tree
        const navTree = document.createElement('ul');
        navTree.className = 'nav-tree';
        
        // Track parent headings for nesting
        let currentH2 = null;
        let currentH3 = null;
        
        // Process each heading
        headings.forEach((heading) => {
            const headingText = heading.textContent.trim();
            const headingLevel = heading.tagName.toLowerCase();
            
            // Create navigation item
            const navItem = document.createElement('li');
            navItem.className = `nav-item ${headingLevel}`;
            
            const navLink = document.createElement('a');
            navLink.className = 'nav-link';
            navLink.textContent = headingText;
            navLink.setAttribute('data-heading', headingLevel);
            navLink.setAttribute('title', headingText);
            
            // Store reference to the heading element
            this.headingMap.set(heading, navLink);
            
            // Add click handler to scroll to heading
            navLink.addEventListener('click', () => {
                this.scrollToHeading(heading);
                this.closeSidebar();
            });
            
            navItem.appendChild(navLink);
            
            // Handle nesting based on heading level
            if (headingLevel === 'h2') {
                navTree.appendChild(navItem);
                currentH2 = navItem;
                currentH3 = null;
            } else if (headingLevel === 'h3') {
                // If there's a parent h2, nest under it
                if (currentH2) {
                    let h2SubList = currentH2.querySelector('.nav-sublist');
                    if (!h2SubList) {
                        h2SubList = document.createElement('ul');
                        h2SubList.className = 'nav-sublist';
                        currentH2.appendChild(h2SubList);
                    }
                    h2SubList.appendChild(navItem);
                } else {
                    // No parent h2, add directly to the tree
                    navTree.appendChild(navItem);
                }
                currentH3 = navItem;
            } else if (headingLevel === 'h4') {
                // If there's a parent h3, nest under it
                if (currentH3) {
                    let h3SubList = currentH3.querySelector('.nav-sublist');
                    if (!h3SubList) {
                        h3SubList = document.createElement('ul');
                        h3SubList.className = 'nav-sublist';
                        currentH3.appendChild(h3SubList);
                    }
                    h3SubList.appendChild(navItem);
                } else if (currentH2) {
                    // No parent h3, but there is an h2, nest under it
                    let h2SubList = currentH2.querySelector('.nav-sublist');
                    if (!h2SubList) {
                        h2SubList = document.createElement('ul');
                        h2SubList.className = 'nav-sublist';
                        currentH2.appendChild(h2SubList);
                    }
                    h2SubList.appendChild(navItem);
                } else {
                    // No parent h2 or h3, add directly to the tree
                    navTree.appendChild(navItem);
                }
            }
        });
        
        // Add the navigation tree to the content
        this.navContent.appendChild(navTree);
        
        console.log(`Navigation tree built with ${headings.length} headings`);
    }
    
    /**
     * Scroll to a specific heading in the document
     */
    scrollToHeading(heading) {
        if (!heading) return;
        
        // Find the editor container
        let editorContainer = null;
        if (window.editor && window.editor.editor) {
            const toastEditor = window.editor.editor;
            
            // Find the scrollable container based on the current mode
            if (toastEditor.isWysiwygMode()) {
                editorContainer = document.querySelector('.toastui-editor-ww-container');
            } else {
                editorContainer = document.querySelector('.toastui-editor-md-container');
            }
        }
        
        // Calculate the scroll position
        const headingPosition = heading.offsetTop;
        
        // Scroll the container instead of the whole page
        if (editorContainer) {
            editorContainer.scrollTo({
                top: headingPosition - 30, // Add some padding
                behavior: 'smooth'
            });
        } else {
            // Fallback to default scroll behavior
            heading.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
        
        // Highlight the heading briefly
        const originalBackground = heading.style.backgroundColor;
        heading.style.backgroundColor = 'rgba(74, 111, 165, 0.2)';
        heading.style.transition = 'background-color 1s';
        
        // Reset the highlight after a delay
        setTimeout(() => {
            heading.style.backgroundColor = originalBackground;
        }, 1500);
        
        // Update the active state in the navigation
        this.updateActiveHeading(heading);
    }
    
    /**
     * Update the active state in the navigation tree
     */
    updateActiveHeading(activeHeading) {
        // Remove active class from all nav links
        const allNavLinks = this.navContent.querySelectorAll('.nav-link');
        allNavLinks.forEach(link => link.classList.remove('active'));
        
        // Add active class to the corresponding nav link
        const activeNavLink = this.headingMap.get(activeHeading);
        if (activeNavLink) {
            activeNavLink.classList.add('active');
        }
    }
    
    /**
     * Update the navigation based on visible headings while scrolling
     */
    updateActiveHeadingOnScroll() {
        // Find the editor content container
        let contentContainer = null;
        if (window.editor && window.editor.editor) {
            const toastEditor = window.editor.editor;
            
            // Find the content container based on the current mode
            if (toastEditor.isWysiwygMode()) {
                contentContainer = document.querySelector('.toastui-editor-contents');
            } else {
                // In markdown mode, find the preview element
                contentContainer = document.querySelector('.toastui-editor-md-preview');
            }
        }
        
        if (!contentContainer) return;
        
        // Get all headings
        const headings = contentContainer.querySelectorAll('h2, h3, h4');
        
        // Calculate which heading is in view
        let activeHeading = null;
        const scrollTop = contentContainer.scrollTop;
        
        headings.forEach(heading => {
            const headingTop = heading.offsetTop;
            
            // Consider a heading active if it's above the middle of the viewport
            if (headingTop <= scrollTop + (contentContainer.clientHeight / 2)) {
                activeHeading = heading;
            }
        });
        
        // Update the active state
        if (activeHeading) {
            this.updateActiveHeading(activeHeading);
        }
    }
}

// The navigation sidebar will be initialized in main.js
// Export the class for use
if (typeof module !== 'undefined' && module.exports) {
    module.exports = NavigationSidebar;
}