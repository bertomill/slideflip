"""
Pydantic models for WebSocket message types
"""

from pydantic import BaseModel, Field
from typing import Dict, Any, Optional, List
from enum import Enum

class ProcessingStatus(str, Enum):
    """Processing status enumeration"""
    IDLE = "idle"
    STARTED = "started"
    ANALYZING = "analyzing"
    PROCESSING = "processing"
    COMPLETED = "completed"
    ERROR = "error"

class ClientMessage(BaseModel):
    """Base model for messages sent from client to server"""
    type: str = Field(..., description="Type of message")
    data: Dict[str, Any] = Field(default_factory=dict, description="Message data")

class ServerMessage(BaseModel):
    """Base model for messages sent from server to client"""
    type: str = Field(..., description="Type of message")
    data: Dict[str, Any] = Field(default_factory=dict, description="Message data")

class FileUploadMessage(BaseModel):
    """Model for file upload messages"""
    filename: str = Field(..., description="Name of the uploaded file")
    content: str = Field(..., description="Base64 encoded file content")
    file_type: str = Field(..., description="MIME type of the file")
    file_size: int = Field(..., description="Size of the file in bytes")
    client_id: Optional[str] = Field(None, description="Client identifier")

class SlideDescriptionMessage(BaseModel):
    """Model for slide description messages"""
    description: str = Field(..., description="User's description of the slide")
    client_id: Optional[str] = Field(None, description="Client identifier")

class SlideGenerationMessage(BaseModel):
    """Model for slide generation requests"""
    description: str = Field(..., description="User's description of the slide")
    theme: Optional[str] = Field("default", description="Selected theme")
    wants_research: Optional[bool] = Field(False, description="Whether to include research")
    client_id: Optional[str] = Field(None, description="Client identifier")

class ProcessingRequestMessage(BaseModel):
    """Model for slide processing requests"""
    client_id: str = Field(..., description="Client identifier")
    options: Optional[Dict[str, Any]] = Field(default_factory=dict, description="Processing options")

class FileInfo(BaseModel):
    """Model for file information"""
    filename: str
    file_path: str
    file_size: int
    file_type: str
    upload_time: str

class SlideData(BaseModel):
    """Model for slide data"""
    title: str
    content: str
    theme: str
    layout: str
    elements: List[Dict[str, Any]]

class ProcessingResult(BaseModel):
    """Model for processing results"""
    status: ProcessingStatus
    slide_data: Optional[SlideData] = None
    error_message: Optional[str] = None
    processing_time: float = 0.0

class ConnectionMessage(BaseModel):
    """Model for connection messages"""
    client_id: str
    message: str
    timestamp: str

class ErrorMessage(BaseModel):
    """Model for error messages"""
    error: str
    details: Optional[str] = None
    code: Optional[str] = None

class StatusMessage(BaseModel):
    """Model for status messages"""
    status: ProcessingStatus
    message: str
    progress: Optional[float] = None
    current_step: Optional[str] = None
    total_steps: Optional[int] = None 