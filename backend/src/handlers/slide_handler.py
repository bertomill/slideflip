"""
Slide handler for processing slide-related operations
"""

import logging
from typing import List, Dict, Optional
from datetime import datetime

from src.services.slide_service import SlideService
from src.services.file_service import FileService
from src.models.message_models import FileInfo, SlideData, ProcessingResult, ProcessingStatus

logger = logging.getLogger(__name__)

class SlideHandler:
    """Handler for slide-related operations"""
    
    def __init__(self):
        self.slide_service = SlideService()
        self.file_service = FileService()
    
    async def process_slide_description(self, description: str, client_id: str) -> Dict:
        """Process a slide description"""
        try:
            logger.info(f"Processing slide description for client {client_id}")
            
            # Validate description
            if not description or len(description.strip()) == 0:
                return {
                    "success": False,
                    "error": "Description cannot be empty"
                }
            
            if len(description) > 1000:
                return {
                    "success": False,
                    "error": "Description is too long (max 1000 characters)"
                }
            
            # Store the description
            success = await self.slide_service.store_slide_description(client_id, description)
            
            if success:
                return {
                    "success": True,
                    "message": "Slide description stored successfully",
                    "description_length": len(description)
                }
            else:
                return {
                    "success": False,
                    "error": "Failed to store slide description"
                }
                
        except Exception as e:
            logger.error(f"Error processing slide description: {e}")
            return {
                "success": False,
                "error": str(e)
            }
    
    async def process_slide_generation(self, client_id: str, options: Optional[Dict] = None) -> Dict:
        """Process slide generation request"""
        try:
            logger.info(f"Processing slide generation for client {client_id}")
            
            # Get client files
            files = await self.file_service.get_client_files(client_id)
            if not files:
                return {
                    "success": False,
                    "error": "No files found for processing"
                }
            
            # Get slide description
            description = await self.slide_service.get_slide_description(client_id)
            if not description:
                return {
                    "success": False,
                    "error": "No slide description found"
                }
            
            # Generate slide
            result = await self.slide_service.generate_slide(files, description)
            
            if "error" in result:
                return {
                    "success": False,
                    "error": result["error"]
                }
            
            return {
                "success": True,
                "result": result,
                "files_processed": len(files),
                "processing_time": result.get("processing_time", 0)
            }
            
        except Exception as e:
            logger.error(f"Error processing slide generation: {e}")
            return {
                "success": False,
                "error": str(e)
            }
    
    async def get_slide_data(self, client_id: str) -> Dict:
        """Get slide data for a client"""
        try:
            files = await self.file_service.get_client_files(client_id)
            description = await self.slide_service.get_slide_description(client_id)
            processing_result = await self.slide_service.get_processing_result(client_id)
            
            return {
                "success": True,
                "data": {
                    "files": [file.dict() for file in files],
                    "description": description,
                    "processing_result": processing_result.dict() if processing_result else None
                }
            }
            
        except Exception as e:
            logger.error(f"Error getting slide data for client {client_id}: {e}")
            return {
                "success": False,
                "error": str(e)
            }
    
    async def clear_client_data(self, client_id: str) -> Dict:
        """Clear all data for a client"""
        try:
            success = await self.slide_service.clear_client_data(client_id)
            
            if success:
                return {
                    "success": True,
                    "message": f"Cleared all data for client {client_id}"
                }
            else:
                return {
                    "success": False,
                    "error": "Failed to clear client data"
                }
                
        except Exception as e:
            logger.error(f"Error clearing client data: {e}")
            return {
                "success": False,
                "error": str(e)
            }
    
    async def validate_slide_request(self, client_id: str) -> Dict:
        """Validate slide generation request"""
        try:
            # Check if client has files
            files = await self.file_service.get_client_files(client_id)
            if not files:
                return {
                    "valid": False,
                    "error": "No files uploaded"
                }
            
            # Check if client has description
            description = await self.slide_service.get_slide_description(client_id)
            if not description:
                return {
                    "valid": False,
                    "error": "No slide description provided"
                }
            
            # Check file types
            allowed_types = self.file_service.settings.ALLOWED_FILE_TYPES
            for file_info in files:
                if file_info.file_type not in allowed_types:
                    return {
                        "valid": False,
                        "error": f"File type {file_info.file_type} is not supported"
                    }
            
            return {
                "valid": True,
                "message": "Slide generation request is valid",
                "file_count": len(files),
                "description_length": len(description)
            }
            
        except Exception as e:
            logger.error(f"Error validating slide request: {e}")
            return {
                "valid": False,
                "error": str(e)
            }
    
    async def get_processing_status(self, client_id: str) -> Dict:
        """Get processing status for a client"""
        try:
            processing_result = await self.slide_service.get_processing_result(client_id)
            
            if processing_result:
                return {
                    "success": True,
                    "status": processing_result.status,
                    "processing_time": processing_result.processing_time,
                    "has_error": processing_result.error_message is not None,
                    "error_message": processing_result.error_message
                }
            else:
                return {
                    "success": True,
                    "status": ProcessingStatus.IDLE,
                    "processing_time": 0,
                    "has_error": False,
                    "error_message": None
                }
                
        except Exception as e:
            logger.error(f"Error getting processing status: {e}")
            return {
                "success": False,
                "error": str(e)
            }
    
    async def get_service_stats(self) -> Dict:
        """Get slide service statistics"""
        try:
            stats = self.slide_service.get_service_stats()
            return {
                "success": True,
                "stats": stats
            }
        except Exception as e:
            logger.error(f"Error getting service stats: {e}")
            return {
                "success": False,
                "error": str(e)
            } 