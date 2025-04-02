# auth.py - Simple user authentication module
import json
import os
from functools import wraps
from flask import request, jsonify

# Path to the users file
USERS_FILE = 'users.json'

def load_users():
    """Load users from the JSON file."""
    if not os.path.exists(USERS_FILE):
        # Create with default admin user if doesn't exist
        default_users = []
        save_users(default_users)
        return default_users
    
    try:
        with open(USERS_FILE, 'r') as f:
            return json.load(f)
    except Exception as e:
        print(f"Error loading users: {e}")
        return []

def save_users(users):
    """Save users to the JSON file."""
    try:
        with open(USERS_FILE, 'w') as f:
            json.dump(users, f, indent=2)
        return True
    except Exception as e:
        print(f"Error saving users: {e}")
        return False

def authenticate(username, password):
    """Check if username and password match any user."""
    users = load_users()
    # Do not authenticate when there is no users supplied:
    if len(users) == 0:
        return True

    for user in users:
        if user.get("username") == username and user.get("password") == password:
            return True
    
    return False

def add_user(username, password):
    """Add a new user."""
    users = load_users()
    
    # Check if user already exists
    for user in users:
        if user.get("username") == username:
            return False
    
    # Add the new user
    users.append({"username": username, "password": password})
    return save_users(users)

def delete_user(username):
    """Delete a user."""
    users = load_users()
    
    # Filter out the user to delete
    new_users = [user for user in users if user.get("username") != username]
    
    if len(new_users) < len(users):
        return save_users(new_users)
    
    return False

def update_user_password(username, new_password):
    """Update a user's password."""
    users = load_users()
    
    for user in users:
        if user.get("username") == username:
            user["password"] = new_password
            return save_users(users)
    
    return False

def get_users():
    """Get a list of all usernames."""
    users = load_users()
    return [user.get("username") for user in users]

def requires_auth(f):
    """Decorator for routes that require authentication."""
    @wraps(f)
    def decorated(*args, **kwargs):
        # Get auth from request
        auth = request.headers.get('Authorization')
        
        # If no users are configured, auth is not required
        users = load_users()
        if not users:
            return f(*args, **kwargs)
        
        # Check if auth header exists and is in correct format
        if not auth or not auth.startswith('Basic '):
            return jsonify({'error': 'Authentication required'}), 401
        
        # Extract credentials
        try:
            import base64
            credentials = base64.b64decode(auth[6:]).decode('utf-8')
            username, password = credentials.split(':', 1)
        except Exception:
            return jsonify({'error': 'Invalid authentication format'}), 401
        
        # Check credentials
        if not authenticate(username, password):
            return jsonify({'error': 'Invalid username or password'}), 401
        
        # Authentication successful
        return f(*args, **kwargs)
    
    return decorated