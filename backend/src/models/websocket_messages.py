"""
Improved WebSocket message models with better type safety and structure
"""

from pydantic import BaseModel, Field, validator
from typing import Dict, Any, Optional, List, Union, Literal
from enum import Enum
import uuid
from datetime import datetime


class ProcessingStatus(str, Enum):
    """Processing status enumeration"""
    IDLE = "idle"
    UPLOADING = "uploading"
    PLANNING = "planning"
    RESEARCHING = "researching"
    GENERATING = "generating"
    COMPLETED = "completed"
    ERROR = "error"


class MessageType(str, Enum):
    """Standardized message types"""
    # Client -> Server
    FILE_UPLOAD = "file_upload"
    THEME_SELECTION = "theme_selection"
    CONTENT_PLANNING = "content_planning"
    SLIDE_GENERATION = "slide_generation"
    RESEARCH_REQUEST = "research_request"
    STATUS_REQUEST = "status_request"
    PING = "ping"
    
    # Server -> Client
    PROGRESS_UPDATE = "progress_update"
    SLIDE_COMPLETE = "slide_complete"
    CONTENT_PLAN_RESPONSE = "content_plan_response"
    ERROR_RESPONSE = "error_response"
    STATUS_RESPONSE = "status_response"
    PONG = "pong"
    ACKNOWLEDGE = "acknowledge"
    SESSION_INITIALIZED = "session_initialized"


class BaseWebSocketMessage(BaseModel):
    """Base WebSocket message with request tracking"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    type: MessageType = Field(..., description="Message type")
    timestamp: datetime = Field(default_factory=datetime.now)
    client_id: str = Field(..., description="Client identifier")
    request_id: Optional[str] = Field(None, description="Original request ID for responses")

    class Config:
        use_enum_values = True
        json_encoders = {
            datetime: lambda dt: dt.isoformat()
        }


# Client Message Types
class ClientMessage(BaseWebSocketMessage):
    """Base model for messages sent from client to server"""
    pass


class FileUploadData(BaseModel):
    """File upload data payload"""
    filename: str = Field(..., description="Name of the uploaded file")
    content: str = Field(..., description="Base64 encoded file content")
    file_type: str = Field(..., description="MIME type of the file")
    file_size: int = Field(..., gt=0, le=52428800, description="File size in bytes (max 50MB)")
    
    @validator('filename')
    def validate_filename(cls, v):
        if not v.strip():
            raise ValueError('Filename cannot be empty')
        return v.strip()
    
    @validator('file_type')
    def validate_file_type(cls, v):
        allowed_types = [
            'application/pdf',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'text/plain',
            'text/markdown'
        ]
        if v not in allowed_types:
            raise ValueError(f'Unsupported file type: {v}')
        return v


class FileUploadMessage(ClientMessage):
    """File upload message"""
    type: Literal[MessageType.FILE_UPLOAD] = MessageType.FILE_UPLOAD
    data: FileUploadData


class ThemeSelectionData(BaseModel):
    """Theme selection data payload"""
    theme_id: str = Field(..., description="Selected theme ID")
    theme_name: str = Field(..., description="Theme name")
    color_palette: List[str] = Field(..., min_items=3, max_items=10, description="Theme color palette")
    slide_count: int = Field(default=1, ge=1, le=20, description="Number of slides to generate")
    
    @validator('theme_id')
    def validate_theme_id(cls, v):
        if not v.strip():
            raise ValueError('Theme ID cannot be empty')
        return v.strip()
    
    @validator('color_palette')
    def validate_colors(cls, v):
        import re
        hex_pattern = re.compile(r'^#[0-9A-Fa-f]{6}$')
        for color in v:
            if not hex_pattern.match(color):
                raise ValueError(f'Invalid color format: {color}')
        return v


class ThemeSelectionMessage(ClientMessage):
    """Theme selection message"""
    type: Literal[MessageType.THEME_SELECTION] = MessageType.THEME_SELECTION
    data: ThemeSelectionData


class ContentPlanningData(BaseModel):
    """Content planning data payload"""
    content_outline: Optional[str] = Field(None, description="User-provided content outline")
    include_research: bool = Field(False, description="Whether to include web research")
    research_topics: List[str] = Field(default_factory=list, description="Specific research topics")


class ContentPlanningMessage(ClientMessage):
    """Content planning message"""
    type: Literal[MessageType.CONTENT_PLANNING] = MessageType.CONTENT_PLANNING
    data: ContentPlanningData


class SlideGenerationData(BaseModel):
    """Slide generation data payload"""
    content_plan: Dict[str, Any] = Field(..., description="Approved content plan")
    theme_config: Dict[str, Any] = Field(..., description="Theme configuration")
    generation_options: Dict[str, Any] = Field(default_factory=dict, description="Generation options")


class SlideGenerationMessage(ClientMessage):
    """Slide generation message"""
    type: Literal[MessageType.SLIDE_GENERATION] = MessageType.SLIDE_GENERATION
    data: SlideGenerationData


class ResearchRequestData(BaseModel):
    """Research request data payload"""
    query: str = Field(..., description="Research query")
    max_results: int = Field(default=5, ge=1, le=20)
    include_images: bool = Field(default=True)
    time_range: str = Field(default="month", pattern="^(day|week|month|year|all)$")


class ResearchRequestMessage(ClientMessage):
    """Research request message"""
    type: Literal[MessageType.RESEARCH_REQUEST] = MessageType.RESEARCH_REQUEST
    data: ResearchRequestData


class StatusRequestMessage(ClientMessage):
    """Status request message"""
    type: Literal[MessageType.STATUS_REQUEST] = MessageType.STATUS_REQUEST
    data: Dict[str, Any] = Field(default_factory=dict)


class PingMessage(ClientMessage):
    """Ping message for connection health"""
    type: Literal[MessageType.PING] = MessageType.PING
    data: Dict[str, Any] = Field(default_factory=dict)


# Server Message Types
class ServerMessage(BaseWebSocketMessage):
    """Base model for messages sent from server to client"""
    status: ProcessingStatus = Field(ProcessingStatus.IDLE, description="Current processing status")


class ProgressUpdateData(BaseModel):
    """Progress update data payload"""
    step: str = Field(..., description="Current step name")
    progress: int = Field(..., ge=0, le=100, description="Progress percentage")
    message: str = Field(..., description="Progress message")
    step_data: Dict[str, Any] = Field(default_factory=dict, description="Step-specific data")


class ProgressUpdateMessage(ServerMessage):
    """Progress update message"""
    type: Literal[MessageType.PROGRESS_UPDATE] = MessageType.PROGRESS_UPDATE
    data: ProgressUpdateData


class SlideCompleteData(BaseModel):
    """Slide generation complete data payload"""
    slide_html: str = Field(..., description="Generated slide HTML")
    slide_name: str = Field(..., description="Generated slide name")
    metadata: Dict[str, Any] = Field(default_factory=dict, description="Slide metadata")
    generation_time: float = Field(..., description="Time taken to generate slide")


class SlideCompleteMessage(ServerMessage):
    """Slide generation complete message"""
    type: Literal[MessageType.SLIDE_COMPLETE] = MessageType.SLIDE_COMPLETE
    status: Literal[ProcessingStatus.COMPLETED] = ProcessingStatus.COMPLETED
    data: SlideCompleteData


class ContentPlanResponseData(BaseModel):
    """Content plan response data payload"""
    content_plan: str = Field(..., description="Generated content plan")
    suggestions: List[str] = Field(default_factory=list, description="Content suggestions")
    estimated_slide_count: int = Field(1, description="Estimated number of slides")


class ContentPlanResponseMessage(ServerMessage):
    """Content plan response message"""
    type: Literal[MessageType.CONTENT_PLAN_RESPONSE] = MessageType.CONTENT_PLAN_RESPONSE
    data: ContentPlanResponseData


class ErrorResponseData(BaseModel):
    """Error response data payload"""
    error_code: str = Field(..., description="Error code")
    error_message: str = Field(..., description="Human-readable error message")
    details: Optional[str] = Field(None, description="Detailed error information")
    retry_possible: bool = Field(False, description="Whether the operation can be retried")


class ErrorResponseMessage(ServerMessage):
    """Error response message"""
    type: Literal[MessageType.ERROR_RESPONSE] = MessageType.ERROR_RESPONSE
    status: Literal[ProcessingStatus.ERROR] = ProcessingStatus.ERROR
    data: ErrorResponseData


class StatusResponseData(BaseModel):
    """Status response data payload"""
    current_step: str = Field(..., description="Current processing step")
    overall_progress: int = Field(..., ge=0, le=100, description="Overall progress percentage")
    session_start_time: str = Field(..., description="Session start timestamp")
    last_activity: str = Field(..., description="Last activity timestamp")
    step_details: Dict[str, Any] = Field(default_factory=dict, description="Step-specific details")


class StatusResponseMessage(ServerMessage):
    """Status response message"""
    type: Literal[MessageType.STATUS_RESPONSE] = MessageType.STATUS_RESPONSE
    data: StatusResponseData


class AcknowledgeData(BaseModel):
    """Acknowledge data payload"""
    acknowledged_message_id: str = Field(..., description="ID of acknowledged message")
    acknowledged_type: MessageType = Field(..., description="Type of acknowledged message")
    processing_started: bool = Field(..., description="Whether processing has started")


class AcknowledgeMessage(ServerMessage):
    """Acknowledge message"""
    type: Literal[MessageType.ACKNOWLEDGE] = MessageType.ACKNOWLEDGE
    data: AcknowledgeData


class SessionInitializedData(BaseModel):
    """Session initialized data payload"""
    session_id: str = Field(..., description="Session identifier")
    available_steps: List[str] = Field(..., description="Available processing steps")
    current_step: str = Field(..., description="Current step")
    message: str = Field(..., description="Welcome message")


class SessionInitializedMessage(ServerMessage):
    """Session initialized message"""
    type: Literal[MessageType.SESSION_INITIALIZED] = MessageType.SESSION_INITIALIZED
    data: SessionInitializedData


class PongMessage(ServerMessage):
    """Pong response message"""
    type: Literal[MessageType.PONG] = MessageType.PONG
    data: Dict[str, Any] = Field(default_factory=dict)


# Message Union Types for Type Hints
ClientMessageUnion = Union[
    FileUploadMessage,
    ThemeSelectionMessage,
    ContentPlanningMessage,
    SlideGenerationMessage,
    ResearchRequestMessage,
    StatusRequestMessage,
    PingMessage
]

ServerMessageUnion = Union[
    ProgressUpdateMessage,
    SlideCompleteMessage,
    ContentPlanResponseMessage,
    ErrorResponseMessage,
    StatusResponseMessage,
    AcknowledgeMessage,
    SessionInitializedMessage,
    PongMessage
]

WebSocketMessageUnion = Union[ClientMessageUnion, ServerMessageUnion]