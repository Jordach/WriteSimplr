/**
 * Settings module for WriteSimplr
 * Handles user authentication and settings management
 */
 class SettingsManager {
    constructor() {
        this.currentUsername = '';
        this.isAuthenticated = false;
        this.authRequired = false;
        
        // Settings modal elements
        this.settingsModal = null;
        this.settingsButton = null;
        
        // Initialize UI elements
        this.init();
        
        // Load saved credentials from local storage
        this.loadStoredCredentials();
        
        // Check authentication status
        this.checkAuthStatus();
    }
    
    init() {
        // Create settings button in the sidebar header
        this.createSettingsButton();
        
        // Create settings modal
        this.createSettingsModal();
        
        // Check for auth error events to show login form
        document.addEventListener('auth-error', () => {
            if (!this.isAuthenticated && this.authRequired) {
                this.showLoginModal();
            }
        });
    }
    
    createSettingsButton() {
        const sidebarHeader = document.querySelector('.sidebar-header');
        
        if (sidebarHeader) {
            // Create settings button
            const settingsButton = document.createElement('button');
            settingsButton.id = 'settings-btn';
            settingsButton.title = 'Settings';
            settingsButton.innerHTML = '<i class="fas fa-cog"></i>';
            
            // Add event listener
            settingsButton.addEventListener('click', () => {
                this.showSettingsModal();
            });
            
            // Append to sidebar header
            sidebarHeader.appendChild(settingsButton);
            
            // Store reference
            this.settingsButton = settingsButton;
        }
    }
    
    createSettingsModal() {
        // Check if modal container exists
        let modalContainer = document.getElementById('settings-modal');
        
        if (!modalContainer) {
            // Create the modal container
            modalContainer = document.createElement('div');
            modalContainer.id = 'settings-modal';
            modalContainer.className = 'modal';
            
            // Create modal content
            modalContainer.innerHTML = `
                <div class="modal-content" style="max-width: 500px;">
                    <span class="close">&times;</span>
                    <h2 id="settings-modal-title">Settings</h2>
                    <div id="settings-modal-content"></div>
                </div>
            `;
            
            // Append to body
            document.body.appendChild(modalContainer);
            
            // Add close button event
            modalContainer.querySelector('.close').addEventListener('click', () => {
                this.closeSettingsModal();
            });
            
            // Close when clicking outside
            modalContainer.addEventListener('click', (e) => {
                if (e.target === modalContainer) {
                    this.closeSettingsModal();
                }
            });
        }
        
        // Store reference
        this.settingsModal = modalContainer;
    }
    
    showSettingsModal() {
        // Update the modal content
        const modalContent = document.getElementById('settings-modal-content');
        
        modalContent.innerHTML = `
            <div class="settings-tabs">
                <div class="settings-tab-header">
                    <button class="tab-btn active" data-tab="auth">Authentication</button>
                </div>
                
                <div class="settings-tab-content">
                    <!-- Authentication tab -->
                    <div class="tab-panel active" id="auth-panel">
                        ${this.renderAuthPanel()}
                    </div>
                </div>
            </div>
        `;
        
        // Add event listeners for tabs
        const tabButtons = modalContent.querySelectorAll('.tab-btn');
        tabButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                // Remove active class from all buttons and panels
                tabButtons.forEach(b => b.classList.remove('active'));
                modalContent.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
                
                // Add active class to clicked button and corresponding panel
                btn.classList.add('active');
                const panelId = `${btn.dataset.tab}-panel`;
                document.getElementById(panelId).classList.add('active');
            });
        });
        
        // Add event listeners for auth panel buttons
        this.attachAuthPanelEvents();
        
        // Show the modal
        this.settingsModal.style.display = 'block';
    }
    
    renderAuthPanel() {
        if (this.isAuthenticated) {
            // User is authenticated, show management panel
            return `
                <div class="auth-info">
                    <p style="text-align: center;">You are currently logged in as <strong>${this.currentUsername}</strong>.</p>
                    <button id="logout-btn" class="settings-btn">Log Out</button>
                </div>
            `;
        } else {
            // User is not authenticated, show login form
            if (this.authRequired) {
                return `
                    <div class="auth-info">
                        <p style="text-align: center;">Authentication is required to make changes.</p>
                    </div>
                    
                    <div class="auth-login">
                        <h3>Log In</h3>
                        <div style="margin-bottom: 10px;">
                            <label for="username">Username:</label>
                            <input type="text" id="username" style="width: 100%; padding: 8px; box-sizing: border-box;">
                        </div>
                        <div style="margin-bottom: 15px;">
                            <label for="password">Password:</label>
                            <input type="password" id="password" style="width: 100%; padding: 8px; box-sizing: border-box;">
                        </div>
                        <div style="display: flex; gap: 10px;">
                            <button id="login-btn" class="settings-btn">Log In</button>
                            <div style="flex-grow: 1;"></div>
                            <label style="display: flex; align-items: center;">
                                <input type="checkbox" id="remember-me" style="margin-right: 5px;">
                                Remember me
                            </label>
                        </div>
                        <div id="login-error" style="color: red; margin-top: 10px; display: none;"></div>
                    </div>
                `;
            } else {
                return `
                    <div class="auth-info">
                        <p style="text-align: center;">Authentication is not currently required.</p>
                    </div>
                `;
            }
        }
    }
    
    attachAuthPanelEvents() {
        if (this.isAuthenticated) {
            // Logout button
            document.getElementById('logout-btn')?.addEventListener('click', () => {
                this.logout();
            });
        } else {
            // Login button
            document.getElementById('login-btn')?.addEventListener('click', () => {
                this.login();
            });
            
            // Allow pressing Enter to login
            document.getElementById('password')?.addEventListener('keyup', (e) => {
                if (e.key === 'Enter') {
                    this.login();
                }
            });
        }
    }
    
    closeSettingsModal() {
        if (this.settingsModal) {
            this.settingsModal.style.display = 'none';
        }
    }
    
    showLoginModal() {
        // Update the modal content with just the login form
        this.settingsModal.querySelector('#settings-modal-title').textContent = 'Login Required';
        
        const modalContent = document.getElementById('settings-modal-content');
        modalContent.innerHTML = `
            <div class="auth-login">
                <p>Authentication is required to perform this operation.</p>
                <div style="margin-bottom: 10px;">
                    <label for="username">Username:</label>
                    <input type="text" id="username" style="width: 100%; padding: 8px; box-sizing: border-box;">
                </div>
                <div style="margin-bottom: 15px;">
                    <label for="password">Password:</label>
                    <input type="password" id="password" style="width: 100%; padding: 8px; box-sizing: border-box;">
                </div>
                <div style="display: flex; gap: 10px;">
                    <button id="login-btn" class="settings-btn">Log In</button>
                    <div style="flex-grow: 1;"></div>
                    <label style="display: flex; align-items: center;">
                        <input type="checkbox" id="remember-me" style="margin-right: 5px;">
                        Remember me
                    </label>
                </div>
                <div id="login-error" style="color: red; margin-top: 10px; display: none;"></div>
            </div>
        `;
        
        // Login button event
        document.getElementById('login-btn')?.addEventListener('click', () => {
            this.login();
        });
        
        // Allow pressing Enter to login
        document.getElementById('password')?.addEventListener('keyup', (e) => {
            if (e.key === 'Enter') {
                this.login();
            }
        });
        
        // Show the modal
        this.settingsModal.style.display = 'block';
        
        // Focus username field
        setTimeout(() => {
            document.getElementById('username')?.focus();
        }, 100);
    }
    
    login() {
        const username = document.getElementById('username')?.value || '';
        const password = document.getElementById('password')?.value || '';
        const rememberMe = document.getElementById('remember-me')?.checked || false;
        
        if (!username || !password) {
            this.showLoginError('Please enter both username and password.');
            return;
        }
        
        // Create auth header
        const authHeader = this.createAuthHeader(username, password);
        
        // Test credentials
        fetch('/api/auth/check', {
            method: 'GET',
            headers: {
                'Authorization': authHeader
            }
        })
        .then(response => response.json())
        .then(data => {
            if (data.validCredentials) {
                // Save the credentials if remember me is checked
                if (rememberMe) {
                    this.storeCredentials(username, password);
                }
                
                // Update state
                this.isAuthenticated = true;
                this.currentUsername = username;
                this.authRequired = data.authRequired;
                
                // Set global auth header for future requests
                this.setGlobalAuthHeader(authHeader);
                
                // Close modal and reload settings if needed
                this.closeSettingsModal();
                
                // Retry the last operation if there was one
                if (window._lastAuthFailedOperation) {
                    const operation = window._lastAuthFailedOperation;
                    window._lastAuthFailedOperation = null;
                    operation();
                }
            } else {
                this.showLoginError('Invalid username or password.');
            }
        })
        .catch(error => {
            console.error('Authentication error:', error);
            this.showLoginError('Error during authentication. Please try again.');
        });
    }
    
    logout() {
        // Clear saved credentials
        this.clearStoredCredentials();
        
        // Update state
        this.isAuthenticated = false;
        this.currentUsername = '';
        
        // Remove global auth header
        this.removeGlobalAuthHeader();
        
        // Reload settings modal
        this.showSettingsModal();
    }
    
    showLoginError(message) {
        const errorElement = document.getElementById('login-error');
        if (errorElement) {
            errorElement.textContent = message;
            errorElement.style.display = 'block';
        }
    }
    
    createAuthHeader(username, password) {
        return 'Basic ' + btoa(`${username}:${password}`);
    }
    
    setGlobalAuthHeader(authHeader) {
        window.authHeader = authHeader;
    }
    
    removeGlobalAuthHeader() {
        window.authHeader = null;
    }
    
    storeCredentials(username, password) {
        try {
            localStorage.setItem('writeSimplr_username', username);
            // Simple encoding for password - NOT SECURE for production
            localStorage.setItem('writeSimplr_password', btoa(password));
            localStorage.setItem('writeSimplr_hasAuth', 'true');
        } catch (e) {
            console.error('Error storing credentials:', e);
        }
    }
    
    clearStoredCredentials() {
        try {
            localStorage.removeItem('writeSimplr_username');
            localStorage.removeItem('writeSimplr_password');
            localStorage.removeItem('writeSimplr_hasAuth');
        } catch (e) {
            console.error('Error clearing credentials:', e);
        }
    }
    
    loadStoredCredentials() {
        try {
            const hasAuth = localStorage.getItem('writeSimplr_hasAuth') === 'true';
            
            if (hasAuth) {
                const username = localStorage.getItem('writeSimplr_username');
                const password = atob(localStorage.getItem('writeSimplr_password') || '');
                
                if (username && password) {
                    const authHeader = this.createAuthHeader(username, password);
                    this.setGlobalAuthHeader(authHeader);
                    this.currentUsername = username;
                    
                    // We'll validate these credentials in checkAuthStatus
                    return true;
                }
            }
        } catch (e) {
            console.error('Error loading credentials:', e);
        }
        
        return false;
    }
    
    checkAuthStatus() {
        // Check if authentication is required and if stored credentials are valid
        fetch('/api/auth/check')
            .then(response => response.json())
            .then(data => {
                this.authRequired = data.authRequired;
                
                // If we have stored credentials, check if they're valid
                if (window.authHeader) {
                    fetch('/api/auth/check', {
                        headers: {
                            'Authorization': window.authHeader
                        }
                    })
                    .then(response => response.json())
                    .then(authData => {
                        this.isAuthenticated = authData.validCredentials;
                        
                        // If credentials are invalid, clear them
                        if (!this.isAuthenticated) {
                            this.clearStoredCredentials();
                            this.removeGlobalAuthHeader();
                        }
                    })
                    .catch(error => {
                        console.error('Error checking stored credentials:', error);
                        this.isAuthenticated = false;
                    });
                }
            })
            .catch(error => {
                console.error('Error checking auth status:', error);
                this.authRequired = false;
                this.isAuthenticated = false;
            });
    }
    
    showChangePasswordModal(username) {
        // Create a modal for changing password
        const modalHtml = `
            <div id="password-modal" class="modal" style="display: block; z-index: 1001;">
                <div class="modal-content" style="max-width: 400px;">
                    <span class="close">&times;</span>
                    <h2>Change Password for ${username}</h2>
                    <div>
                        <div style="margin-bottom: 15px;">
                            <label for="new-password">New Password:</label>
                            <input type="password" id="new-password" style="width: 100%; padding: 8px; box-sizing: border-box;">
                        </div>
                        <div style="margin-bottom: 15px;">
                            <label for="confirm-password">Confirm Password:</label>
                            <input type="password" id="confirm-password" style="width: 100%; padding: 8px; box-sizing: border-box;">
                        </div>
                        <div id="password-error" style="color: red; margin-bottom: 10px; display: none;"></div>
                        <div style="display: flex; justify-content: flex-end;">
                            <button id="cancel-password-btn" style="margin-right: 10px;">Cancel</button>
                            <button id="save-password-btn">Save</button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        // Append to body
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = modalHtml;
        document.body.appendChild(tempDiv.firstElementChild);
        
        // Get elements
        const passwordModal = document.getElementById('password-modal');
        const closeBtn = passwordModal.querySelector('.close');
        const cancelBtn = document.getElementById('cancel-password-btn');
        const saveBtn = document.getElementById('save-password-btn');
        
        // Close function
        const closeModal = () => {
            document.body.removeChild(passwordModal);
        };
        
        // Add event listeners
        closeBtn.addEventListener('click', closeModal);
        cancelBtn.addEventListener('click', closeModal);
        
        // Save function
        saveBtn.addEventListener('click', () => {
            const newPassword = document.getElementById('new-password').value;
            const confirmPassword = document.getElementById('confirm-password').value;
            
            // Validate passwords
            if (!newPassword) {
                this.showPasswordError('Please enter a new password.');
                return;
            }
            
            if (newPassword !== confirmPassword) {
                this.showPasswordError('Passwords do not match.');
                return;
            }
            
            // Update password
            fetch(`/api/auth/users/${username}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': window.authHeader
                },
                body: JSON.stringify({ password: newPassword })
            })
            .then(response => {
                if (!response.ok) {
                    throw new Error('Failed to update password');
                }
                return response.json();
            })
            .then(data => {
                if (data.success) {
                    // Close modal
                    closeModal();
                    
                    // Show success message
                    alert(`Password for ${username} has been updated.`);
                } else {
                    this.showPasswordError(data.error || 'Failed to update password.');
                }
            })
            .catch(error => {
                console.error('Error updating password:', error);
                this.showPasswordError(error.message);
            });
        });
        
        // Focus new password field
        setTimeout(() => {
            document.getElementById('new-password').focus();
        }, 100);
    }
    
    showPasswordError(message) {
        const errorElement = document.getElementById('password-error');
        if (errorElement) {
            errorElement.textContent = message;
            errorElement.style.display = 'block';
        }
    }
    
    // addUser() {
    //     const username = document.getElementById('new-username').value;
    //     const password = document.getElementById('new-password').value;
        
    //     if (!username || !password) {
    //         alert('Please enter both username and password.');
    //         return;
    //     }
        
    //     // Create user
    //     fetch('/api/auth/users', {
    //         method: 'POST',
    //         headers: {
    //             'Content-Type': 'application/json',
    //             'Authorization': window.authHeader
    //         },
    //         body: JSON.stringify({ username, password })
    //     })
    //     .then(response => {
    //         if (!response.ok) {
    //             throw new Error('Failed to create user');
    //         }
    //         return response.json();
    //     })
    //     .then(data => {
    //         if (data.success) {
    //             // Clear form
    //             document.getElementById('new-username').value = '';
    //             document.getElementById('new-password').value = '';
                
    //             // Reload user list
    //             this.loadUserList();
                
    //             // Show success message
    //             alert(`User ${username} has been created.`);
    //         } else {
    //             alert(data.error || 'Failed to create user.');
    //         }
    //     })
    //     .catch(error => {
    //         console.error('Error creating user:', error);
    //         alert(`Error creating user: ${error.message}`);
    //     });
    // }
    
    // deleteUser(username) {
    //     // Confirm deletion
    //     if (!confirm(`Are you sure you want to delete user ${username}?`)) {
    //         return;
    //     }
        
    //     // Delete user
    //     fetch(`/api/auth/users/${username}`, {
    //         method: 'DELETE',
    //         headers: {
    //             'Authorization': window.authHeader
    //         }
    //     })
    //     .then(response => {
    //         if (!response.ok) {
    //             throw new Error('Failed to delete user');
    //         }
    //         return response.json();
    //     })
    //     .then(data => {
    //         if (data.success) {
    //             // Reload user list
    //             this.loadUserList();
                
    //             // Show success message
    //             alert(`User ${username} has been deleted.`);
    //         } else {
    //             alert(data.error || 'Failed to delete user.');
    //         }
    //     })
    //     .catch(error => {
    //         console.error('Error deleting user:', error);
    //         alert(`Error deleting user: ${error.message}`);
    //     });
    // }
}