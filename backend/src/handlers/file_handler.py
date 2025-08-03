"""
File handler for processing file-related operations
"""

import logging
from typing import List, Dict, Optional
from pathlib import Path

from src.services.file_service import FileService
from src.models.message_models import FileInfo

logger = logging.getLogger(__name__)

class FileHandler:
    """Handler for file-related operations"""
    
    def __init__(self):
        self.file_service = FileService()
    
    async def process_file_upload(self, filename: str, content: str, file_type: str, client_id: str) -> Dict:
        """Process a file upload request"""
        try:
            logger.info(f"Processing file upload: {filename} for client {client_id}")
            
            # Save the file
            file_path = await self.file_service.save_uploaded_file(
                filename, content, file_type, client_id
            )
            
            # Get file info
            file_info = await self.file_service.get_file_info(str(file_path))
            
            return {
                "success": True,
                "file_path": str(file_path),
                "file_info": file_info,
                "message": f"File {filename} uploaded successfully"
            }
            
        except Exception as e:
            logger.error(f"Error processing file upload: {e}")
            return {
                "success": False,
                "error": str(e),
                "message": f"Failed to upload file {filename}"
            }
    
    async def get_client_files(self, client_id: str) -> List[FileInfo]:
        """Get all files for a client"""
        try:
            return await self.file_service.get_client_files(client_id)
        except Exception as e:
            logger.error(f"Error getting files for client {client_id}: {e}")
            return []
    
    async def extract_file_content(self, file_path: str) -> Optional[str]:
        """Extract text content from a file"""
        try:
            return await self.file_service.extract_text_from_file(file_path)
        except Exception as e:
            logger.error(f"Error extracting content from {file_path}: {e}")
            return None
    
    async def delete_client_files(self, client_id: str) -> bool:
        """Delete all files for a client"""
        try:
            return await self.file_service.delete_client_files(client_id)
        except Exception as e:
            logger.error(f"Error deleting files for client {client_id}: {e}")
            return False
    
    async def validate_file(self, filename: str, content: str, file_type: str) -> Dict:
        """Validate a file before processing"""
        try:
            # Check file size
            import base64
            file_content = base64.b64decode(content)
            if len(file_content) > self.file_service.settings.MAX_FILE_SIZE:
                return {
                    "valid": False,
                    "error": f"File size exceeds maximum allowed size of {self.file_service.settings.MAX_FILE_SIZE} bytes"
                }
            
            # Check file type
            if file_type not in self.file_service.settings.ALLOWED_FILE_TYPES:
                return {
                    "valid": False,
                    "error": f"File type {file_type} is not allowed"
                }
            
            # Check filename
            if not filename or len(filename) > 255:
                return {
                    "valid": False,
                    "error": "Invalid filename"
                }
            
            return {
                "valid": True,
                "message": "File validation passed"
            }
            
        except Exception as e:
            logger.error(f"Error validating file: {e}")
            return {
                "valid": False,
                "error": f"File validation failed: {str(e)}"
            }
    
    async def get_storage_info(self) -> Dict:
        """Get storage information"""
        try:
            stats = self.file_service.get_storage_stats()
            return {
                "success": True,
                "stats": stats
            }
        except Exception as e:
            logger.error(f"Error getting storage info: {e}")
            return {
                "success": False,
                "error": str(e)
            }
    
    async def cleanup_old_files(self, max_age_hours: int = 24) -> Dict:
        """Clean up old temporary files"""
        try:
            deleted_count = await self.file_service.cleanup_temp_files(max_age_hours)
            return {
                "success": True,
                "deleted_count": deleted_count,
                "message": f"Cleaned up {deleted_count} old files"
            }
        except Exception as e:
            logger.error(f"Error cleaning up old files: {e}")
            return {
                "success": False,
                "error": str(e)
            } 