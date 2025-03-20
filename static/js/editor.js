/**
 * ToastUI Editor-based WYSIWYG Markdown Editor
 */
 class Editor {
    constructor() {
        this.editorElement = document.getElementById('editor');
        this.currentMode = 'wysiwyg'; // Start in WYSIWYG mode by default
        
        // Wait for DOM to be fully ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.initialize());
        } else {
            this.initialize();
        }

        // Store a reference to available documents for link insertion
        this.availableDocuments = [];
    
         // Load the document list when the editor is initialized
        this.loadAvailableDocuments();

        // Add click handler for document links
        this.addDocumentLinkHandler();

        // Init footer
        this.footer = null;
    }
    
    initialize() {
        console.log("Initializing ToastUI Editor");
        
        if (!this.editorElement) {
            console.error("Editor element not found!");
            return;
        }
        
        // Check if ToastUI Editor is available
        if (typeof toastui === 'undefined' || !toastui.Editor) {
            console.error("ToastUI Editor not loaded! Check script includes.");
            return;
        }

        const initialFormatOptions = {
            font: document.getElementById('font-select')?.value || 'Garamond, serif',
            fontSize: document.getElementById('font-size-select')?.value || '14pt',
            fontColor: document.getElementById('font-color-picker')?.value || '#222222'
        };    
    
    // Create custom button functions
    const createSaveButton = () => {
        const button = document.createElement('button');
        button.className = 'toastui-editor-toolbar-item-wrapper';
        button.style.background = 'inherit';
        button.style.margin = '0';
        button.text = '';
        button.innerHTML = '<i class="fas fa-save"></i>';
        button.addEventListener('click', () => {
            if (window.fileManager) {
                window.fileManager.saveCurrentFile();
            }
        });
        return button;
    };

    const createSaveAsButton = () => {
        const button = document.createElement('button');
        button.className = 'toastui-editor-toolbar-item-wrapper';
        button.style.background = 'inherit';
        button.style.margin = '0';
        button.text = '';
        button.innerHTML = '<i class="fas fa-copy"></i>';
        button.addEventListener('click', () => {
            if (window.fileManager) {
                window.fileManager.showSaveAsModal();
            }
        });
        return button;
    };

    const createNavBarButton = () => {
        const button = document.createElement('button');
        button.className = 'toastui-editor-toolbar-item-wrapper';
        button.style.background = 'inherit';
        button.style.margin = '0';
        button.text = '';
        button.innerHTML = '<i class="fas fa-anchor"></i>';
        button.addEventListener('click', () => {
            if (window.fileManager) {
                window.navigationSidebar.toggleSidebar();
            }
        });
        return button;
    };
    
    const createNewDocButton = () => {
        const button = document.createElement('button');
        button.className = 'toastui-editor-toolbar-item-wrapper';
        button.style.background = 'inherit';
        button.style.margin = '0';
        button.text = '';
        button.innerHTML = '<i class="fas fa-file"></i>';
        button.addEventListener('click', () => {
            this.createNewDocument();
        });
        return button;
    };
    
    const createDocReferenceButton = () => {
        const button = document.createElement('button');
        button.className = 'toastui-editor-toolbar-item-wrapper';
        button.style.background = 'inherit';
        button.style.margin = '0';
        button.text = '';
        button.innerHTML = '<i class="fas fa-link"></i>';
        button.addEventListener('click', () => {
            this.showLinkDialog();
        });
        return button;
    };
    
    const createFontSelect = () => {
        const container = document.createElement('div');
        container.className = 'toastui-editor-toolbar-item-wrapper';
        container.style.display = 'inline-block';
        container.style.margin = '0 4px';
        
        const select = document.createElement('select');
        select.className = 'toastui-editor-toolbar-select';
        select.style.height = '28px';
        select.style.padding = '0 5px';
        select.style.border = '1px solid #ddd';
        select.style.borderRadius = '3px';
        select.style.backgroundColor = 'white';
        
        const fontOptions = [
            { label: 'Arial', value: 'Arial, sans-serif' },
            { label: 'Bush Script MT', value: 'Bush Script MT, cursive' },
            { label: 'Courier New', value: 'Courier New, monospace' },
            { label: 'Garamond', value: 'Garamond, serif' },
            { label: 'Georgia', value: 'Georgia, serif' },
            { label: 'Tahoma', value: 'Tahoma, sans-serif' },
            { label: 'Times New Roman', value: 'Times New Roman, serif' },
            { label: 'Trebuchet MS', value: 'Trebuchet MS, sans-serif' },
            { label: 'Verdana', value: 'Verdana, sans-serif' }
        ];
        
        fontOptions.forEach(opt => {
            const option = document.createElement('option');
            option.value = opt.value;
            option.textContent = opt.label;
            if (opt.value === initialFormatOptions.font) {
                option.selected = true;
            }
            select.appendChild(option);
        });
        
        select.addEventListener('change', () => {
            this.applyFormatOptions({ font: select.value });
        });
        
        container.appendChild(select);
        return container;
    };
    
    const createFontSizeSelect = () => {
        const container = document.createElement('div');
        container.className = 'toastui-editor-toolbar-item-wrapper';
        container.style.display = 'inline-block';
        container.style.margin = '0 4px';
        
        const select = document.createElement('select');
        select.className = 'toastui-editor-toolbar-select';
        select.style.height = '28px';
        select.style.padding = '0 5px';
        select.style.border = '1px solid #ddd';
        select.style.borderRadius = '3px';
        select.style.backgroundColor = 'white';
        
        const fontSizeOptions = [
            { label: '9pt', value: '9pt' },
            { label: '10pt', value: '10pt' },
            { label: '11pt', value: '11pt' },
            { label: '12pt', value: '12pt' },
            { label: '14pt', value: '14pt' },
            { label: '16pt', value: '16pt' },
            { label: '18pt', value: '18pt' },
            { label: '20pt', value: '20pt' }
        ];
        
        fontSizeOptions.forEach(opt => {
            const option = document.createElement('option');
            option.value = opt.value;
            option.textContent = opt.label;
            if (opt.value === initialFormatOptions.fontSize) {
                option.selected = true;
            }
            select.appendChild(option);
        });
        
        select.addEventListener('change', () => {
            this.applyFormatOptions({ fontSize: select.value });
        });
        
        container.appendChild(select);
        return container;
    };
    
    const createColorPicker = () => {
        const container = document.createElement('div');
        container.className = 'toastui-editor-toolbar-item-wrapper';
        container.style.display = 'inline-block';
        container.style.margin = '0 4px';
        
        const picker = document.createElement('input');
        picker.type = 'color';
        picker.style.width = '24px';
        picker.style.height = '24px';
        picker.style.border = '1px solid #ddd';
        picker.style.padding = '0';
        picker.style.cursor = 'pointer';
        picker.value = initialFormatOptions.fontColor;
        
        picker.addEventListener('change', () => {
            this.applyFormatOptions({ fontColor: picker.value });
        });
        
        container.appendChild(picker);
        return container;
    };
    
    // Initialize ToastUI Editor with custom buttons using el property
    this.editor = new toastui.Editor({
        el: this.editorElement,
        height: '100%',
        initialEditType: 'wysiwyg',
        previewStyle: 'vertical',
        toolbarItems: [
            // Custom document management tools
            [{
                el: createNewDocButton(),
                tooltip: 'New Document'
            }, {
                el: createSaveButton(),
                tooltip: 'Save Document (Ctrl+S)'
            }, {
                el: createSaveAsButton(),
                tooltip: 'Save As (Ctrl+Shift+S)'
            }, {
                el: createNavBarButton(),
                tooltip: "Document Navigation"
            }],
            // Standard editor tools
            ['heading', {
                el: createFontSelect(),
                tooltip: 'Font Family'
            }, {
                el: createFontSizeSelect(),
                tooltip: 'Font Size'
            }, 'bold', 'italic', 'strike'],
            ['hr', 'quote'],
            ['ul', 'ol', 'task', 'indent', 'outdent'],
            ['code', 'codeblock', 'table', {
                el: createDocReferenceButton(),
                tooltip: 'Insert Link/Document Reference'
            }, 'image'],
            [{
                el: createColorPicker(),
                tooltip: 'Font Color'
            }],
        ],
        hooks: {
            addImageBlobHook: (blob, callback) => {
                this.uploadImage(blob)
                    .then(url => {
                        callback(url, 'Image');
                    })
                    .catch(error => {
                        console.error('Error uploading image:', error);
                        alert('Error uploading image: ' + error.message);
                    });
                return false;
            }
        }
    });

        // Add CSS for custom icons
        const styleEl = document.createElement('style');
        styleEl.textContent = `
            .toastui-editor-toolbar-icons.save:before {
                content: "\\f0c7";  /* Font Awesome save icon */
                font-family: FontAwesome;
            }
            .toastui-editor-toolbar-icons.new-doc:before {
                content: "\\f15b";  /* Font Awesome file icon */
                font-family: FontAwesome;
            }
            .toastui-editor-toolbar-icons.doc-reference:before {
                content: "\\f15c";  /* Font Awesome file-text icon */
                font-family: FontAwesome;
            }
            .toastui-editor-toolbar-icons.font-select:before {
                content: "\\f031";  /* Font Awesome font icon */
                font-family: FontAwesome;
            }
            .toastui-editor-toolbar-icons.font-size:before {
                content: "\\f034";  /* Font Awesome text-height icon */
                font-family: FontAwesome;
            }
            .toastui-editor-toolbar-icons.font-color:before {
                content: "\\f53f";  /* Font Awesome palette icon */
                font-family: FontAwesome;
            }
        `;
        document.head.appendChild(styleEl);

        // Initialize event listeners
        this.initEventListeners();
        
        // Apply initial formatting options
        this.applyFormatOptions({
            font: initialFormatOptions.font,
            fontSize: initialFormatOptions.fontSize,
            fontColor: initialFormatOptions.fontColor
        });
        
        this.footer = new EditorFooter(this);

        console.log("ToastUI Editor initialized successfully");
    }
    
    initEventListeners() {
        // Keyboard shortcuts - capture at document level
        document.addEventListener('keydown', (e) => {           
            // Check for Ctrl+S or Cmd+S (for Mac)
            if ((e.ctrlKey || e.metaKey) && e.key === 's') {
                // Prevent default browser save action and editor strikethrough
                e.preventDefault();
                e.stopPropagation();
                if (window.fileManager) {
                    // Save the current file
                    window.fileManager.saveCurrentFile();
                }
                // Return false to stop event propagation
                return false;
            }
            
            // Ctrl+N or Cmd+N for new document
            if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
                e.preventDefault();
                e.stopPropagation();
                this.createNewDocument();
                return false;
            }
        }, true); // Use capturing phase to intercept event before it reaches the editor
        
        // Add additional editor-specific listeners here if needed
    }
    
    setContent(content) {
        if (this.editor) {
            this.editor.setMarkdown(content || '');
            
            // Explicitly reset cursor position in the footer
            if (this.footer) {
                // Force position to be line 1, column 1
                this.footer.stats.line = 1;
                this.footer.stats.column = 1;
                
                // Update the display immediately
                const positionEl = document.getElementById('cursor-position');
                if (positionEl) {
                    positionEl.innerText = `Ln: 1, Col: 1`;
                }
            }
            
            // Update navigation sidebar if available
            // Use setTimeout to ensure content is rendered first
            setTimeout(() => {
                if (window.navigationSidebar && typeof window.navigationSidebar.scanDocumentHeadings === 'function') {
                    window.navigationSidebar.scanDocumentHeadings();
                }
            }, 100);
        } else {
            console.warn("Editor not initialized yet, content will be set when available");
            // Store content to set later when editor is ready
            this._pendingContent = content;
        }
        
        // Update word count
        if (this.footer) {
            this.footer.updateWordCount();
        }
        
        // Store as last saved content for change detection
        this._lastSavedContent = content || '';
    }
    
    getContent() {
        if (this.editor) {
            return this.editor.getMarkdown() || '';
        }
        return this._pendingContent || '';
    }
    
    applyFormatOptions(options) {
        if (!this.editor) return;
        
        // Store the current format options - initialize with defaults if needed
        if (!this.currentFormatOptions) {
            this.currentFormatOptions = {
                font: 'Arial, sans-serif',
                fontSize: '16px',
                fontColor: '#333333'
            };
        }
        
        // Update only the provided options, keeping others the same
        if (options.font) this.currentFormatOptions.font = options.font;
        if (options.fontSize) this.currentFormatOptions.fontSize = options.fontSize;
        if (options.fontColor) this.currentFormatOptions.fontColor = options.fontColor;
        
        // Get the editor container element
        const editorEl = this.editorElement;
        
        // Apply combined options to all editor elements
        const combinedOptions = this.currentFormatOptions;
        
        // Apply styles to the WYSIWYG content area
        const wysiwygContent = editorEl.querySelector('.toastui-editor-contents');
        if (wysiwygContent) {
            wysiwygContent.style.fontFamily = combinedOptions.font;
            wysiwygContent.style.fontSize = combinedOptions.fontSize;
            wysiwygContent.style.color = combinedOptions.fontColor;
        }
        
        // Apply to markdown editor if present (for when in markdown mode)
        const markdownContent = editorEl.querySelector('.toastui-editor-md-container .toastui-editor-md-preview');
        if (markdownContent) {
            markdownContent.style.fontFamily = combinedOptions.font;
            markdownContent.style.fontSize = combinedOptions.fontSize;
            markdownContent.style.color = combinedOptions.fontColor;
        }
        
        // Apply to CodeMirror editor (for markdown editing)
        const codeMirrorEditor = editorEl.querySelector('.toastui-editor-md-container .CodeMirror');
        if (codeMirrorEditor) {
            codeMirrorEditor.style.fontFamily = combinedOptions.font;
            codeMirrorEditor.style.fontSize = combinedOptions.fontSize;
            codeMirrorEditor.style.color = combinedOptions.fontColor;
        }
        
        // Try to directly apply to the CodeMirror content area
        const cmContent = editorEl.querySelector('.toastui-editor-md-container .CodeMirror-code');
        if (cmContent) {
            cmContent.style.fontFamily = combinedOptions.font;
            cmContent.style.fontSize = combinedOptions.fontSize;
            cmContent.style.color = combinedOptions.fontColor;
        }
        
        // Apply to dropdown menu and heading popup for accurate preview
        const fontDropdownItems = document.querySelectorAll('.toastui-editor-dropdown-toolbar button');
        if (fontDropdownItems.length > 0) {
            fontDropdownItems.forEach(item => {
                item.style.fontFamily = combinedOptions.font;
            });
        }
        
        // Apply to the heading popup when it exists
        const headingPopup = document.querySelector('.toastui-editor-popup.toastui-editor-popup-add-heading');
        if (headingPopup) {
            headingPopup.style.fontFamily = combinedOptions.font;
            // Apply font to all heading previews in the popup
            const headingButtons = headingPopup.querySelectorAll('button');
            headingButtons.forEach(button => {
                button.style.fontFamily = combinedOptions.font;
                button.style.fontSize = combinedOptions.fontSize;
            });
        }
        
        // Update font in the font selector dropdown itself
        const fontSelect = document.getElementById('editor-font-select');
        if (fontSelect) {
            // fontSelect.style.fontFamily = combinedOptions.font;
            
            // Also update each option to display in its own font
            Array.from(fontSelect.options).forEach(option => {
                // For the selected option, use the current font
                option.style.fontFamily = option.value;
                // if (option.selected) {
                //     option.style.fontFamily = combinedOptions.font;
                // } else {
                //     // For non-selected options, use their own font
                // }
            });
        }
        
        // Update the font size selector if it exists
        // const fontSizeSelect = document.querySelector('.toastui-editor-toolbar-select[id^="font-size"]');
        // if (fontSizeSelect) {
        //     fontSizeSelect.style.fontFamily = combinedOptions.font;
        // }
        
        // Update or create the style element with CSS that targets both editors
        let styleEl = document.getElementById('editor-custom-styles');
        if (!styleEl) {
            styleEl = document.createElement('style');
            styleEl.id = 'editor-custom-styles';
            document.head.appendChild(styleEl);
        }
        
        // Generate CSS rules for both editors with all combined options
        styleEl.textContent = `
            .toastui-editor-contents {
                font-family: ${combinedOptions.font} !important;
                font-size: ${combinedOptions.fontSize} !important;
                color: ${combinedOptions.fontColor} !important;
            }
            
            .toastui-editor-contents p,
            .toastui-editor-contents h1,
            .toastui-editor-contents h2,
            .toastui-editor-contents h3,
            .toastui-editor-contents h4,
            .toastui-editor-contents h5,
            .toastui-editor-contents h6,
            .toastui-editor-contents ul,
            .toastui-editor-contents ol,
            .toastui-editor-contents li,
            .toastui-editor-contents blockquote {
                font-family: ${combinedOptions.font} !important;
                color: ${combinedOptions.fontColor} !important;
            }
            
            .toastui-editor-md-preview,
            .toastui-editor-md-container .CodeMirror,
            .toastui-editor-md-container .CodeMirror-code {
                font-family: ${combinedOptions.font} !important;
                font-size: ${combinedOptions.fontSize} !important;
                color: ${combinedOptions.fontColor} !important;
            }

            /* Apply to other UI components that should reflect the font */
            .toastui-editor-popup {
                font-family: ${combinedOptions.font} !important;
            }
            
            /* Apply to popup menus and dropdowns for consistent preview */
            .toastui-editor-popup-add-heading button {
                font-family: ${combinedOptions.font} !important;
            }
        `;

        // Add a mutation observer to apply styles to dynamically created popup menus
        if (!this._popupObserver) {
            this._popupObserver = new MutationObserver((mutations) => {
                mutations.forEach(mutation => {
                    if (mutation.addedNodes.length) {
                        mutation.addedNodes.forEach(node => {
                            // Check if the added node is a popup or contains popups
                            if (node.nodeType === Node.ELEMENT_NODE) {
                                if (node.classList && node.classList.contains('toastui-editor-popup')) {
                                    node.style.fontFamily = combinedOptions.font;
                                    const buttons = node.querySelectorAll('button');
                                    buttons.forEach(button => {
                                        button.style.fontFamily = combinedOptions.font;
                                    });
                                } else {
                                    const popups = node.querySelectorAll('.toastui-editor-popup');
                                    if (popups.length) {
                                        popups.forEach(popup => {
                                            popup.style.fontFamily = combinedOptions.font;
                                            const popupButtons = popup.querySelectorAll('button');
                                            popupButtons.forEach(button => {
                                                button.style.fontFamily = combinedOptions.font;
                                            });
                                        });
                                    }
                                }
                            }
                        });
                    }
                });
            });
            
            // Observe the entire document for popup additions
            this._popupObserver.observe(document.body, { 
                childList: true, 
                subtree: true 
            });
        }
        
        // Log the applied format for debugging
        console.log("Applied format options:", combinedOptions);
    }
    
    // Updated uploadImage method for the Editor class
    uploadImage(blob) {
        // Convert blob to File object with the original name if available
        const filename = blob.name || 'image.png';
        const file = new File([blob], filename, { type: blob.type });
        
        // Use the fileManager's upload method
        const formData = new FormData();
        formData.append('file', file);
        
        return fetch('/api/upload', {
            method: 'POST',
            body: formData
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                const imageUrl = data.url;
                
                if (data.duplicate) {
                    console.log("Using existing image with same hash:", data.filename);
                } else {
                    console.log("Uploaded new image:", data.filename);
                }
                
                // Auto-save after successful image upload
                setTimeout(() => {
                    if (window.fileManager) {
                        console.log("Auto-saving after image upload");
                        fileManager.saveCurrentFile();
                    }
                }, 500); // Small delay to ensure image is properly inserted
                
                return imageUrl;
            } else {
                throw new Error(data.error || 'Unknown error');
            }
        });
    }

    // Add this method to load available documents
    loadAvailableDocuments() {
        fetch('/api/files')
            .then(response => response.json())
            .then(files => {
                // Filter for markdown files only
                this.availableDocuments = files.filter(file => file.type === 'file');
                console.log("Available documents loaded:", this.availableDocuments.length);
            })
            .catch(error => console.error('Error loading documents:', error));
    }
    
    // Override the insertLink method to show our custom dialog
    insertLink(text, url) {
        // If text and url are provided, insert the link directly
        if (text && url) {
            this._insertLinkDirectly(text, url);
            return;
        }
        
        // Otherwise, show our custom link dialog
        this.showLinkDialog();
    }

    // Method to show custom link dialog with document references
    showLinkDialog() {
        // Create and append the modal and overlay to the DOM
        const modalHtml = `
            <div id="link-dialog-overlay" style="position: fixed; top: 0; left: 0; right: 0; bottom: 0; background-color: rgba(0,0,0,0.5); z-index: 9998;"></div>
            <div id="link-dialog-modal" style="position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); background-color: white; padding: 20px; border-radius: 4px; box-shadow: 0 2px 10px rgba(0,0,0,0.2); z-index: 9999; width: 500px; max-width: 90%;">
                <h3 style="margin-top: 0;">Insert Link</h3>
                <div style="margin-bottom: 10px;">
                    <label for="link-text">Link Text:</label>
                    <input type="text" id="link-text" style="width: 100%; padding: 8px; box-sizing: border-box; margin-top: 5px;">
                </div>
                
                <div style="margin-bottom: 10px;">
                    <div>
                        <input type="radio" id="external-link" name="link-type" value="external" checked>
                        <label for="external-link">External URL</label>
                    </div>
                    <input type="text" id="link-url" style="width: 100%; padding: 8px; box-sizing: border-box; margin-top: 5px;">
                </div>
                
                <div style="margin-bottom: 20px;">
                    <div>
                        <input type="radio" id="document-link" name="link-type" value="document">
                        <label for="document-link">Reference Document</label>
                    </div>
                    <select id="document-select" style="width: 100%; padding: 8px; box-sizing: border-box; margin-top: 5px;" disabled>
                        <option value="">-- Select a document --</option>
                        ${this.availableDocuments.map(doc => 
                            `<option value="${doc.path}">${doc.path}</option>`
                        ).join('')}
                    </select>
                </div>
                
                <div style="text-align: right;">
                    <button id="cancel-link-btn" style="padding: 8px 15px; margin-right: 10px; background: #f5f5f5; border: 1px solid #ddd; border-radius: 4px; cursor: pointer;">Cancel</button>
                    <button id="insert-link-btn" style="padding: 8px 15px; background: #4a6fa5; color: white; border: none; border-radius: 4px; cursor: pointer;">Insert</button>
                </div>
            </div>
        `;
        
        // Insert the HTML into the document
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = modalHtml;
        while (tempDiv.firstChild) {
            document.body.appendChild(tempDiv.firstChild);
        }
        
        // Get references to DOM elements
        const modalOverlay = document.getElementById('link-dialog-overlay');
        const modal = document.getElementById('link-dialog-modal');
        const linkTextField = document.getElementById('link-text');
        const externalRadio = document.getElementById('external-link');
        const documentRadio = document.getElementById('document-link');
        const linkUrlField = document.getElementById('link-url');
        const documentSelect = document.getElementById('document-select');
        const cancelBtn = document.getElementById('cancel-link-btn');
        const insertBtn = document.getElementById('insert-link-btn');
        
        // Focus the text field
        linkTextField.focus();
        
        // Set initial value to selected text if any
        const selectedText = this.getSelectedText();
        if (selectedText) {
            linkTextField.value = selectedText;
            // Focus the URL field if text was prefilled
            linkUrlField.focus();
        }
        
        // Function to close the modal
        const closeModal = () => {
            document.body.removeChild(modalOverlay);
            document.body.removeChild(modal);
        };
        
        // Function to handle radio button changes
        const handleRadioChange = () => {
            if (externalRadio.checked) {
                linkUrlField.disabled = false;
                documentSelect.disabled = true;
            } else {
                linkUrlField.disabled = true;
                documentSelect.disabled = false;
            }
        };
        
        // Function to insert the link
        const insertLink = () => {
            const text = linkTextField.value.trim();
            let url = '';
            
            if (externalRadio.checked) {
                url = linkUrlField.value.trim();
            } else {
                url = documentSelect.value;
            }
            
            if (text && url) {
                this._insertLinkDirectly(text, url);
                closeModal();
                
                // Auto-save after linking
                if (window.fileManager) {
                    setTimeout(() => fileManager.saveCurrentFile(true), 500);
                }
            } else {
                alert('Please enter both link text and select a URL or document.');
            }
        };
        
        // Attach event listeners directly to elements
        externalRadio.addEventListener('click', handleRadioChange);
        documentRadio.addEventListener('click', handleRadioChange);
        cancelBtn.addEventListener('click', closeModal);
        insertBtn.addEventListener('click', insertLink);
        
        // Close on overlay click
        modalOverlay.addEventListener('click', closeModal);
        
        // Prevent modal close when clicking the modal itself
        modal.addEventListener('click', (e) => {
            e.stopPropagation();
        });
        
        // Handle Enter key in text fields
        linkTextField.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                insertLink();
            }
            else if (e.key === 'Escape') {
                e.preventDefault();
                closeModal();
            }
        });
        
        linkUrlField.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                insertLink();
            }
            else if (e.key === 'Escape') {
                e.preventDefault();
                closeModal();
            }
        });
        
        // Update document list if needed
        if (!this.availableDocuments || this.availableDocuments.length === 0) {
            this.refreshAvailableDocuments().then(() => {
                // Update select options after documents are loaded
                documentSelect.innerHTML = `
                    <option value="">-- Select a document --</option>
                    ${this.availableDocuments.map(doc => 
                        `<option value="${doc.path}">${doc.path}</option>`
                    ).join('')}
                `;
            });
        }
        
        // For debugging - log that all elements are properly found
        console.log("Modal elements:", {
            modalOverlay, modal, linkTextField, externalRadio, documentRadio,
            linkUrlField, documentSelect, cancelBtn, insertBtn
        });
    }
    
    // Helper method to get selected text from the editor
    getSelectedText() {
        if (!this.editor) return '';
        
        try {
            if (this.currentMode === 'wysiwyg') {
                // Try different methods depending on the ToastUI version
                if (typeof this.editor.getSelectedText === 'function') {
                    return this.editor.getSelectedText();
                } else if (this.editor.wwEditor) {
                    return this.editor.wwEditor.getSelection().toString();
                }
            } else {
                // Get selected text from Markdown editor
                if (this.editor.mdEditor) {
                    return this.editor.mdEditor.getSelection();
                }
            }
        } catch (e) {
            console.error("Error getting selected text:", e);
        }
        
        return '';
    }

    // Internal method to handle the actual link insertion
    _insertLinkDirectly(text, url) {
        if (!this.editor) return;
        
        try {
            if (this.currentMode === 'wysiwyg') {
                // For newer versions of ToastUI
                if (typeof this.editor.exec === 'function') {
                    this.editor.exec('addLink', {
                        linkText: text,
                        linkUrl: url
                    });
                } 
                // For older versions
                else if (this.editor.getCommand && this.editor.getCommand('AddLink')) {
                    this.editor.getCommand('AddLink').exec(this.editor, {
                        linkText: text,
                        linkUrl: url
                    });
                }
                // Last resort
                else {
                    const selection = window.getSelection();
                    const range = selection.getRangeAt(0);
                    range.deleteContents();
                    
                    const linkNode = document.createElement('a');
                    linkNode.href = url;
                    linkNode.textContent = text;
                    range.insertNode(linkNode);
                }
            } else {
                // In markdown mode
                if (this.editor.mdEditor) {
                    const cm = this.editor.mdEditor.getEditor();
                    cm.replaceSelection(`[${text}](${url})`);
                }
            }
        } catch (e) {
            console.error("Error inserting link:", e);
            alert("There was an error inserting the link. Please try again.");
        }
    }
    
    insertImage(url) {
        if (!this.editor) return;
        
        // In WYSIWYG mode, use editor's built-in command
        if (this.currentMode === 'wysiwyg') {
            this.editor.exec('addImage', {
                imageUrl: url,
                altText: 'image'
            });
        } else {
            // In markdown mode, insert the markdown image syntax
            const mdEditor = this.editor.mdEditor;
            if (mdEditor) {
                const cm = mdEditor.getEditor();
                cm.replaceSelection(`![image](${url})`);
            }
        }
    }

    // Add this method to handle document links
    addDocumentLinkHandler() {
        document.addEventListener('click', (e) => {
            // Check if click was on a link inside the editor
            let target = e.target;
            while (target && target !== document.body) {
                if (target.tagName === 'A' && target.closest('.toastui-editor-contents')) {
                    const href = target.getAttribute('href');
                    
                    // Check if this is a document link (doesn't start with http/https/# and has .md extension)
                    if (href && !href.startsWith('http://') && !href.startsWith('https://') && 
                        !href.startsWith('#') && href.endsWith('.md')) {
                        e.preventDefault();
                        
                        console.log("Loading document reference:", href);
                        
                        // Use fileManager to load the referenced document
                        if (window.fileManager) {
                            fileManager.loadFile(href);
                        }
                    }
                    break;
                }
                target = target.parentElement;
            }
        });
    }

    addDocReferenceButton() {
        if (!this.editor) return;

        try {
            // Find the toolbar element
            const toolbar = this.editorElement.querySelector('.toastui-editor-defaultUI-toolbar');
            if (!toolbar) {
                console.warn('Toolbar element not found');
                return;
            }
            
            // Create a new toolbar item group
            const buttonGroup = document.createElement('div');
            buttonGroup.className = 'toastui-editor-toolbar-group';
            buttonGroup.style.borderLeft = '1px solid #ebedf2';
            
            // Create the button
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'toastui-editor-toolbar-item';
            button.title = 'Insert Document Reference';
            button.innerHTML = '<i class="fas fa-file-alt"></i>';
            
            // Add click event
            button.addEventListener('click', () => {
                this.showLinkDialog();
            });
            
            // Add button to group
            buttonGroup.appendChild(button);
            
            // Find the right location to insert our button group
            // We want to insert it before the mode-switch button if possible
            const lastButtonGroup = toolbar.querySelector('.toastui-editor-toolbar-group:last-child');
            if (lastButtonGroup && lastButtonGroup.querySelector('.last')) {
                // Insert before the last group (mode switch)
                toolbar.insertBefore(buttonGroup, lastButtonGroup);
            } else {
                // Append to the end if we can't find the mode switch
                toolbar.appendChild(buttonGroup);
            }
            
            console.log("Document reference button added successfully");
        } catch (e) {
            console.error("Error adding document reference button:", e);
        }
    }

    refreshAvailableDocuments() {
        return fetch('/api/files')
        .then(response => response.json())
        .then(files => {
            // Filter for markdown files only
            this.availableDocuments = files.filter(file => file.type === 'file');
            console.log("Available documents loaded:", this.availableDocuments.length);
            return this.availableDocuments;
        })
        .catch(error => {
            console.error('Error loading documents:', error);
            return [];
        });
    }
    
    createNewDocument() {
        // Confirm with user if there are unsaved changes
        if (this.editor && this.hasUnsavedChanges()) {
            if (!confirm("You have unsaved changes. Continue without saving?")) {
                return;
            }
        }
        
        // If user confirms or there are no unsaved changes, prompt for new file name
        if (window.fileManager) {
            // Use the enhanced showNewFileModal
            window.fileManager.showNewFileModal();
            return;
        }
        
        // This is a fallback for if fileManager isn't available
        // Clear current document path
        if (window.fileManager) {
            window.fileManager.currentFilePath = null;
            window.fileManager.updateDocumentTitle(null);
        }
        
        // Clear editor content
        if (this.editor) {
            this.setContent('');
            
            // Reset _lastSavedContent for change detection
            this._lastSavedContent = '';
        }
        
        // Reset format options to defaults
        const defaultFormatOptions = {
            font: 'Arial, sans-serif',
            fontSize: '12pt',
            fontColor: '#333333'
        };
        
        this.applyFormatOptions(defaultFormatOptions);
        
        console.log("Created new unsaved document");
    }

    hasUnsavedChanges() {
        // If _lastSavedContent isn't initialized yet
        if (this._lastSavedContent === undefined) {
            // Get content
            const content = this.getContent();
            // Consider empty content as "saved"
            return content !== '';
        }
        
        // Otherwise, compare current content to last saved content
        return this.getContent() !== this._lastSavedContent;
    }
}

class EditorFooter {
    constructor(editor) {
        this.editor = editor;
        this.footerElement = null;
        this.stats = {
            wordCount: 0,
            line: 1,
            column: 1
        };
        
        this.initialize();
    }
    
    initialize() {
        // Create footer element
        this.footerElement = document.createElement('div');
        this.footerElement.className = 'editor-footer';
        
        // Set basic styles
        this.footerElement.style.display = 'flex';
        this.footerElement.style.justifyContent = 'space-between';
        this.footerElement.style.padding = '5px 15px';
        this.footerElement.style.backgroundColor = '#f0f0f0';
        this.footerElement.style.borderTop = '1px solid #ddd';
        this.footerElement.style.fontSize = '12px';
        this.footerElement.style.color = '#666';
        
        // Create stats elements
        const wordCountEl = document.createElement('span');
        wordCountEl.id = 'word-count';
        wordCountEl.innerText = 'Words: 0';
        
        const positionEl = document.createElement('span');
        positionEl.id = 'cursor-position';
        positionEl.innerText = 'Ln: 1, Col: 1';
        
        // Add elements to footer
        this.footerElement.appendChild(wordCountEl);
        this.footerElement.appendChild(positionEl);
        
        // Insert footer into the DOM
        const editorContainer = document.querySelector('.editor-container');
        if (editorContainer) {
            editorContainer.appendChild(this.footerElement);
        } else {
            console.error('Could not find editor container to append footer');
            return;
        }
        
        // Attach event listeners for cursor movement and text changes
        this.attachEventListeners();
        
        // Update stats initially
        this.updateStats();
    }
    
    attachEventListeners() {
        if (!this.editor.editor) {
            console.error('Editor instance not available');
            return;
        }
        
        const toastEditor = this.editor.editor;
        
        // Add change event listener
        toastEditor.on('change', () => {
            this.updateStats();
            this.updateCursorPosition()
        });
        
        // Setup event listeners based on editor mode
        const setupEvents = () => {
            if (toastEditor.isWysiwygMode()) {
                // For WYSIWYG mode
                const editorEl = document.querySelector('.toastui-editor-contents');
                if (editorEl) {
                    // Key events for typing
                    editorEl.addEventListener('keyup', () => {
                        // Add slight delay to ensure DOM updates first
                        setTimeout(() => this.updateCursorPosition(), 5);
                    });
                    editorEl.addEventListener('keydown', () => {
                        // Add slight delay to ensure DOM updates first
                        setTimeout(() => this.updateCursorPosition(), 5);
                    });
                    
                    // // Mouse events for clicking to position cursor
                    // editorEl.addEventListener('mouseup', () => {
                    //     // Add slight delay to ensure DOM updates first
                    //     setTimeout(() => this.updateCursorPosition(), 0);
                    // });
                    // editorEl.addEventListener('mousedown', () => {
                    //     // Add slight delay to ensure DOM updates first
                    //     setTimeout(() => this.updateCursorPosition(), 0);
                    // });
                    editorEl.addEventListener('click', () => {
                        // Add slight delay to ensure DOM updates first
                        setTimeout(() => this.updateCursorPosition(), 5);
                    });
                    
                    // Focus events
                    editorEl.addEventListener('focus', () => {
                        // Add slight delay to ensure DOM updates first
                        setTimeout(() => this.updateCursorPosition(), 5);
                    });
                    
                    // Input event for content changes
                    editorEl.addEventListener('input', () => {
                        // Add slight delay to ensure DOM updates first
                        setTimeout(() => this.updateCursorPosition(), 5);
                    });
                }
            } else {
                // For Markdown mode
                try {
                    if (toastEditor.mdEditor && toastEditor.mdEditor.getEditor) {
                        const cm = toastEditor.mdEditor.getEditor();
                        if (cm) {
                            cm.on('cursorActivity', () => {
                                this.updateCursorPosition();
                            });
                        }
                    }
                } catch (e) {
                    console.error('Error setting up markdown cursor tracking:', e);
                }
            }
        };
        
        // Initial setup
        setupEvents();
        
        // Handle mode changes
        toastEditor.off('changeMode'); // Remove any existing handlers
        toastEditor.on('changeMode', () => {
            setTimeout(() => {
                this.updateStats();
                setupEvents(); // Re-attach appropriate event handlers
            }, 100);
        });
        
        // Also listen for document-level selection changes
        document.addEventListener('selectionchange', () => {
            this.updateCursorPosition();
        });
        
        // Add a periodic update as a fallback
        if (this._updateInterval) {
            clearInterval(this._updateInterval);
        }
        this._updateInterval = setInterval(() => {
            this.updateStats();
        }, 2000);
    }
    
    updateStats() {
        this.updateWordCount();
    }
    
    updateWordCount() {
        let text = '';
        
        if (this.editor.editor) {
            // Get content from ToastUI Editor
            text = this.editor.editor.getMarkdown();
        }
        
        // Process the text to remove Markdown formatting
        
        // First, handle block-level elements
        
        // Remove blockquotes (including spaced nested blockquotes like "> > > text")
        text = text.replace(/^(>\s*)+/gm, '');
        
        // Remove headings (#, ##, etc.)
        text = text.replace(/^#+\s+/gm, '');
        
        // Remove list markers (-, *, +, 1., etc.)
        text = text.replace(/^[\s]*[-*+]\s+/gm, '');
        text = text.replace(/^[\s]*\d+\.\s+/gm, '');
        
        // Remove code block markers but keep content
        text = text.replace(/```[\s\S]*?```/g, function(match) {
            return match.replace(/```/g, '');
        });
        
        // Then, handle inline formatting
        
        // Remove bold/italic/links/etc.
        text = text.replace(/(\*\*|__)(.*?)\1/g, '$2'); // Bold
        text = text.replace(/(\*|_)(.*?)\1/g, '$2');    // Italic
        text = text.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1'); // Links
        text = text.replace(/!\[([^\]]+)\]\([^)]+\)/g, '$1'); // Images
        text = text.replace(/`([^`]+)`/g, '$1'); // Inline code
        
        // Handle strikethrough
        text = text.replace(/~~(.*?)~~/g, '$1');
        
        // Handle HTML tags (remove completely)
        text = text.replace(/<[^>]*>/g, '');
        
        // Count words - split by whitespace and filter out empty strings
        const wordCount = text.split(/\s+/).filter(word => word.length > 0).length;
        this.stats.wordCount = wordCount;
        
        // Update the display
        const wordCountEl = document.getElementById('word-count');
        if (wordCountEl) {
            wordCountEl.innerText = `Words: ${wordCount}`;
        }
    }
    
    updateCursorPosition() {
        // Default values
        let line = 1;
        let column = 1;

        this.stats.line = 1;
        this.stats.column = 1;
        
        if (!this.editor.editor) {
            return;
        }
        
        const toastEditor = this.editor.editor;
        
        try {
            if (toastEditor.isWysiwygMode()) {
                // WYSIWYG mode
                const editorEl = document.querySelector('div.ProseMirror.toastui-editor-contents');
                if (!editorEl) return;
                
                // Get all potential block elements that could contain text
                const blockElements = Array.from(editorEl.querySelectorAll('p, h1, h2, h3, h4, h5, h6, li, blockquote, pre, div, br'));
                
                // Find all text nodes organized by their block containers
                const textNodesByBlock = {};
                
                // Selection info
                const selection = window.getSelection();
                const hasSelection = selection && selection.rangeCount > 0;
                const range = hasSelection ? selection.getRangeAt(0) : null;
                const cursorNode = hasSelection ? range.startContainer : null;
                
                // Process each block element
                let blockCount = 0;
                let cursorBlock = -1;
                let cursorFoundInBlock = false;
                
                blockElements.forEach((block, index) => {
                    // Skip the main editor container
                    if (block === editorEl || block.classList.contains('toastui-editor-contents')) {
                        return;
                    }
                    
                    // Collect text nodes in this block
                    const textNodes = [];
                    const collectTextNodes = (node) => {
                        if (node.nodeType === Node.TEXT_NODE) {
                            textNodes.push(node);
                            
                            // Check if this is our cursor node
                            if (node === cursorNode) {
                                cursorBlock = blockCount;
                                cursorFoundInBlock = true;
                            }
                        } else if (node.nodeType === Node.ELEMENT_NODE) {
                            // If this is a BR, it affects line counting but isn't a text node
                            if (node.tagName === 'BR') {
                                textNodes.push({isBR: true, node: node});
                            }
                            
                            // Process children
                            Array.from(node.childNodes).forEach(collectTextNodes);
                        }
                    };
                    // Process this block
                    collectTextNodes(block);
                    
                    // Store if we found any text nodes
                    if (textNodes.length > 0) {
                        textNodesByBlock[blockCount] = textNodes;
                        blockCount++;
                    }
                });
                
                // Determine line number
                if (cursorBlock >= 0) {
                    // Found cursor in a specific block
                    line = cursorBlock + 1;
                    
                    // Check for BR elements before cursor in the same block
                    if (textNodesByBlock[cursorBlock]) {
                        const nodesInBlock = textNodesByBlock[cursorBlock];
                        let brCount = 0;
                        
                        for (const node of nodesInBlock) {
                            if (node === cursorNode) {
                                break;
                            }
                            
                            if (node.isBR) {
                                brCount++;
                            }
                        }
                        
                        line += brCount;
                    }
                } else {
                    // Cursor not found in any block
                    line = 1;
                }
                // Column calculation (same as before)
                column = hasSelection ? range.startOffset + 1 : 1;
            } else {
                // Markdown mode - use CodeMirror's built-in functionality
                if (toastEditor.mdEditor && toastEditor.mdEditor.getEditor) {
                    const cm = toastEditor.mdEditor.getEditor();
                    if (cm && cm.getCursor) {
                        const cursorPos = cm.getCursor();
                        line = cursorPos.line + 1; // CodeMirror lines are 0-based
                        column = cursorPos.ch + 1; // CodeMirror columns are 0-based
                    }
                }
            }
        } catch (e) {
            console.error('Error calculating cursor position:', e);
            // Default to line 1 if there's an error
            line = 1;
            column = 1;
        }
        
        // Ensure we never return 0 for line or column
        if (line < 1) line = 1;
        if (column < 1) column = 1;
        
        this.stats.line = line;
        this.stats.column = column;
        
        // Update the display
        const positionEl = document.getElementById('cursor-position');
        if (positionEl) {
            positionEl.innerText = `Ln: ${line}, Col: ${column}`;
        }
    }

    debugCursorPosition() {
        if (!this.editor.editor) return;
        
        const toastEditor = this.editor.editor;
        
        if (toastEditor.isWysiwygMode()) {
            const selection = window.getSelection();
            if (!selection || !selection.rangeCount) return;
            
            const range = selection.getRangeAt(0);
            const editorEl = document.querySelector('.toastui-editor-contents');
            
            console.group('Cursor Position Debug');
            console.log('Current Selection:', selection);
            console.log('Range:', range);
            console.log('Start Container:', range.startContainer);
            console.log('Start Offset:', range.startOffset);
            
            if (range.startContainer.nodeType === Node.TEXT_NODE) {
                console.log('Text Content:', range.startContainer.textContent);
                console.log('Text Before Cursor:', range.startContainer.textContent.substring(0, range.startOffset));
                console.log('Text After Cursor:', range.startContainer.textContent.substring(range.startOffset));
            }
            
            // Log DOM structure
            console.log('Editor DOM Structure:');
            const logNode = (node, depth = 0) => {
                const indent = ' '.repeat(depth * 2);
                const isCurrentNode = node === range.startContainer;
                
                if (node.nodeType === Node.TEXT_NODE) {
                    console.log(`${indent}TEXT${isCurrentNode ? ' (CURSOR HERE)' : ''}: "${node.textContent}"`);
                } else if (node.nodeType === Node.ELEMENT_NODE) {
                    console.log(`${indent}${node.tagName}${isCurrentNode ? ' (CURSOR HERE)' : ''}`);
                    Array.from(node.childNodes).forEach(child => logNode(child, depth + 1));
                }
            };
            
            logNode(editorEl);
            console.groupEnd();
        } else {
            // For markdown mode
            try {
                const cm = toastEditor.mdEditor.getEditor();
                if (cm) {
                    const pos = cm.getCursor();
                    const lineContent = cm.getLine(pos.line);
                    
                    console.group('Cursor Position Debug (Markdown)');
                    console.log('CodeMirror Cursor:', pos);
                    console.log('Line Content:', lineContent);
                    console.log('Before Cursor:', lineContent.substring(0, pos.ch));
                    console.log('After Cursor:', lineContent.substring(pos.ch));
                    console.groupEnd();
                }
            } catch (e) {
                console.error('Error debugging markdown cursor position:', e);
            }
        }
    }
}