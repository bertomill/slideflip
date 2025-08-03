"""
Helper utility functions for the SlideFlip Backend
"""

import hashlib
import uuid
import base64
import json
import logging
from typing import Dict, Any, Optional
from datetime import datetime
import mimetypes
import os

logger = logging.getLogger(__name__)

def generate_client_id() -> str:
    """Generate a unique client ID"""
    return str(uuid.uuid4())

def generate_file_hash(content: bytes) -> str:
    """Generate SHA-256 hash for file content"""
    return hashlib.sha256(content).hexdigest()

def encode_file_content(content: bytes) -> str:
    """Encode file content to base64 string"""
    return base64.b64encode(content).decode('utf-8')

def decode_file_content(encoded_content: str) -> bytes:
    """Decode base64 string to file content"""
    return base64.b64decode(encoded_content)

def sanitize_filename(filename: str) -> str:
    """Sanitize filename for safe storage"""
    # Remove or replace unsafe characters
    unsafe_chars = ['<', '>', ':', '"', '|', '?', '*', '\\', '/']
    safe_filename = filename
    for char in unsafe_chars:
        safe_filename = safe_filename.replace(char, '_')
    
    # Limit length
    if len(safe_filename) > 100:
        name, ext = os.path.splitext(safe_filename)
        safe_filename = name[:100-len(ext)] + ext
    
    return safe_filename

def get_file_extension(filename: str) -> str:
    """Get file extension from filename"""
    return os.path.splitext(filename)[1].lower()

def get_mime_type(filename: str) -> str:
    """Get MIME type from filename"""
    return mimetypes.guess_type(filename)[0] or "application/octet-stream"

def format_file_size(size_bytes: int) -> str:
    """Format file size in human readable format"""
    if size_bytes == 0:
        return "0B"
    
    size_names = ["B", "KB", "MB", "GB"]
    i = 0
    while size_bytes >= 1024 and i < len(size_names) - 1:
        size_bytes /= 1024.0
        i += 1
    
    return f"{size_bytes:.1f}{size_names[i]}"

def validate_file_type(filename: str, allowed_types: list) -> bool:
    """Validate if file type is allowed"""
    mime_type = get_mime_type(filename)
    return mime_type in allowed_types

def create_timestamp() -> str:
    """Create ISO formatted timestamp"""
    return datetime.now().isoformat()

def parse_timestamp(timestamp: str) -> datetime:
    """Parse ISO formatted timestamp"""
    return datetime.fromisoformat(timestamp)

def calculate_processing_time(start_time: datetime, end_time: datetime) -> float:
    """Calculate processing time in seconds"""
    return (end_time - start_time).total_seconds()

def safe_json_dumps(obj: Any) -> str:
    """Safely serialize object to JSON"""
    try:
        return json.dumps(obj, default=str)
    except Exception as e:
        logger.error(f"Error serializing object to JSON: {e}")
        return json.dumps({"error": "Serialization failed"})

def safe_json_loads(json_str: str) -> Any:
    """Safely deserialize JSON string"""
    try:
        return json.loads(json_str)
    except Exception as e:
        logger.error(f"Error deserializing JSON: {e}")
        return None

def truncate_text(text: str, max_length: int = 100) -> str:
    """Truncate text to specified length"""
    if len(text) <= max_length:
        return text
    return text[:max_length-3] + "..."

def extract_keywords(text: str, max_keywords: int = 10) -> list:
    """Extract keywords from text (simple implementation)"""
    # Simple keyword extraction - could be enhanced with NLP
    words = text.lower().split()
    # Remove common stop words
    stop_words = {'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by'}
    keywords = [word for word in words if word not in stop_words and len(word) > 3]
    
    # Count frequency
    from collections import Counter
    word_counts = Counter(keywords)
    
    # Return top keywords
    return [word for word, count in word_counts.most_common(max_keywords)]

def create_unique_filename(original_filename: str) -> str:
    """Create unique filename with timestamp and hash"""
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    file_hash = hashlib.md5(original_filename.encode()).hexdigest()[:8]
    safe_name = sanitize_filename(original_filename)
    
    name, ext = os.path.splitext(safe_name)
    return f"{timestamp}_{file_hash}_{name}{ext}"

def ensure_directory_exists(directory_path: str) -> bool:
    """Ensure directory exists, create if it doesn't"""
    try:
        os.makedirs(directory_path, exist_ok=True)
        return True
    except Exception as e:
        logger.error(f"Error creating directory {directory_path}: {e}")
        return False

def get_directory_size(directory_path: str) -> int:
    """Get total size of directory in bytes"""
    total_size = 0
    try:
        for dirpath, dirnames, filenames in os.walk(directory_path):
            for filename in filenames:
                filepath = os.path.join(dirpath, filename)
                if os.path.exists(filepath):
                    total_size += os.path.getsize(filepath)
    except Exception as e:
        logger.error(f"Error calculating directory size: {e}")
    
    return total_size 