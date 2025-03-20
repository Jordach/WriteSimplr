# config.py - Configuration settings
import os

class Config:
    # Base directory for the application
    BASE_DIR = os.path.abspath(os.path.dirname(__file__))
    
    # Directory for user content
    WORK_DIR = os.path.join(BASE_DIR, 'work')
    
    # Default format options for new documents
    DEFAULT_FORMAT_OPTIONS = {
        'font': 'Arial, sans-serif',
        'fontSize': '16px',
        'fontColor': '#333333'
    }
    
    # Maximum file size for uploads (5MB)
    MAX_CONTENT_LENGTH = 50 * 1024 * 1024