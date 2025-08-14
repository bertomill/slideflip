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
    data: Dict[str, Any] = Field(
        default_factory=dict, description="Message data")


class ServerMessage(BaseModel):
    """Base model for messages sent from server to client"""
    type: str = Field(..., description="Type of message")
    data: Dict[str, Any] = Field(
        default_factory=dict, description="Message data")


class FileUploadMessage(BaseModel):
    """Model for file upload messages"""
    filename: str = Field(..., description="Name of the uploaded file")
    content: str = Field(..., description="Base64 encoded file content")
    file_type: str = Field(..., description="MIME type of the file")
    file_size: int = Field(..., description="Size of the file in bytes")
    client_id: Optional[str] = Field(None, description="Client identifier")


class SlideDescriptionMessage(BaseModel):
    """Model for slide description messages"""
    description: str = Field(...,
                             description="User's description of the slide")
    client_id: Optional[str] = Field(None, description="Client identifier")


class ThemeMessage(BaseModel):
    """Model for theme selection messages"""
    theme_id: str = Field(..., description="Selected theme ID")
    theme_name: str = Field(..., description="Theme name")
    theme_description: str = Field(..., description="Theme description")
    color_palette: List[str] = Field(..., description="Theme color palette")
    preview_text: str = Field(..., description="Theme preview text")
    slide_count: int = Field(
        default=1, description="Number of slides to generate")
    client_id: Optional[str] = Field(None, description="Client identifier")


class SlideGenerationMessage(BaseModel):
    """Model for slide generation requests"""
    description: str = Field(...,
                             description="User's description of the slide")
    theme: Optional[str] = Field("default", description="Selected theme")
    theme_details: Optional[Dict[str, Any]] = Field(
        None, description="Detailed theme information")
    wants_research: Optional[bool] = Field(
        False, description="Whether to include research")
    client_id: Optional[str] = Field(None, description="Client identifier")


class ResearchRequestMessage(BaseModel):
    """Model for research request messages"""
    description: str = Field(..., description="User's slide description")
    research_options: Dict[str,
                           Any] = Field(..., description="Complete ResearchOptions object")
    wants_research: bool = Field(..., description="User's research preference")
    client_id: Optional[str] = Field(None, description="Client identifier")


class ContentPlanningMessage(BaseModel):
    """Model for content planning messages"""
    description: str = Field(..., description="User's slide description")
    research_data: Optional[str] = Field(
        None, description="Research results from Step 3")
    theme: str = Field(..., description="Selected theme from Step 2")
    parsed_documents: Optional[List[Dict[str, Any]]] = Field(
        None, description="Array of parsed document content")
    client_id: Optional[str] = Field(None, description="Client identifier")


class ContentPlanResponseMessage(BaseModel):
    """Model for content plan response messages"""
    content_plan: str = Field(..., description="Generated content plan")
    suggestions: List[str] = Field(
        default_factory=list, description="Content suggestions")
    estimated_slide_count: int = Field(
        1, description="Estimated number of slides")
    client_id: Optional[str] = Field(None, description="Client identifier")


class ProgressUpdateMessage(BaseModel):
    """Model for progress update messages"""
    step: str = Field(..., description="Current step name")
    progress: int = Field(..., description="Progress percentage (0-100)")
    message: str = Field(..., description="Progress message")
    timestamp: str = Field(..., description="Timestamp of the update")
    client_id: Optional[str] = Field(None, description="Client identifier")


class ProcessingRequestMessage(BaseModel):
    """Model for slide processing requests"""
    client_id: str = Field(..., description="Client identifier")
    options: Optional[Dict[str, Any]] = Field(
        default_factory=dict, description="Processing options")


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

# Knowledge Graph related message models


class KGStatusMessage(BaseModel):
    """Model for knowledge graph status request messages"""
    client_id: Optional[str] = Field(None, description="Client identifier")


class KGStatusResponseMessage(BaseModel):
    """Model for knowledge graph status response messages"""
    processing_status: Dict[str,
                            Any] = Field(..., description="Current processing status")
    graph_statistics: Dict[str,
                           Any] = Field(..., description="Graph statistics and metadata")


class ForceClusteringMessage(BaseModel):
    """Model for force clustering request messages"""
    client_id: Optional[str] = Field(None, description="Client identifier")


class ForceClusteringResponseMessage(BaseModel):
    """Model for force clustering response messages"""
    message: str = Field(..., description="Response message")
    timestamp: str = Field(..., description="Timestamp of the operation")


class ClearKGMessage(BaseModel):
    """Model for knowledge graph clear request messages"""
    client_id: Optional[str] = Field(None, description="Client identifier")


class ClearKGResponseMessage(BaseModel):
    """Model for knowledge graph clear response messages"""
    message: str = Field(..., description="Response message")
    timestamp: str = Field(..., description="Timestamp of the operation")


class StatusMessage(BaseModel):
    """Model for status messages"""
    status: ProcessingStatus
    message: str
    progress: Optional[float] = None
    current_step: Optional[str] = None
    total_steps: Optional[int] = None

# Phase 1: Agentic Research message models


class AgentConfig(BaseModel):
    """Configuration for individual research agents"""
    enabled: bool = True
    priority: int = Field(default=1, ge=1, le=5)
    timeout: int = Field(default=30, ge=10, le=120)
    max_retries: int = Field(default=3, ge=1, le=5)
    specific_config: Dict[str, Any] = Field(default_factory=dict)


class EnhancedResearchOptions(BaseModel):
    """Enhanced research options with agent selection"""
    # Existing options
    maxResults: int = Field(default=5, ge=1, le=20)
    includeImages: bool = True
    includeAnswer: str = Field(
        default="advanced", pattern="^(basic|advanced)$")
    timeRange: str = Field(
        default="month", pattern="^(day|week|month|year|all)$")
    excludeSocial: bool = True

    # New agentic options
    enabled_agents: Dict[str, AgentConfig] = Field(default_factory=dict)
    research_depth: str = Field(
        default="standard", pattern="^(quick|standard|comprehensive)$")
    focus_areas: List[str] = Field(default_factory=list)
    presentation_style: str = Field(
        default="executive", pattern="^(executive|technical|educational)$")
    quality_threshold: float = Field(default=0.7, ge=0.0, le=1.0)


class AgentProgressMessage(BaseModel):
    """Progress update from individual agents"""
    workflow_id: str
    agent_name: str
    status: str  # starting, processing, completed, error
    progress: int  # 0-100
    message: str
    confidence_score: Optional[float] = None
    partial_results: Optional[Dict[str, Any]] = None
    timestamp: str


class ResearchWorkflowStatusMessage(BaseModel):
    """Complete research workflow status"""
    workflow_id: str
    overall_progress: int
    current_agent: str
    enabled_agents: List[str]
    agent_statuses: Dict[str, str]
    estimated_completion: int  # seconds
    quality_metrics: Optional[Dict[str, float]] = None


class AgenticResearchRequestMessage(BaseModel):
    """Model for agentic research request messages"""
    query: str = Field(..., description="Primary research query")
    description: str = Field(..., description="Detailed research context")
    options: EnhancedResearchOptions = Field(...,
                                             description="Enhanced research options")
    client_id: str = Field(..., description="Client identifier")

# Phase 2: Enhanced session management message models


class SessionInitializedMessage(BaseModel):
    """Model for session initialization confirmation"""
    session_id: str = Field(..., description="Client session identifier")
    current_step: str = Field(..., description="Current step name")
    overall_progress: int = Field(...,
                                  description="Overall progress percentage")
    available_steps: List[str] = Field(...,
                                       description="List of available steps")
    message: str = Field(..., description="Session initialization message")


class SessionStatusMessage(BaseModel):
    """Model for session status request"""
    client_id: Optional[str] = Field(None, description="Client identifier")


class SessionStatusResponseMessage(BaseModel):
    """Model for session status response"""
    session_id: str = Field(..., description="Client session identifier")
    current_step: str = Field(..., description="Current step name")
    overall_progress: int = Field(...,
                                  description="Overall progress percentage")
    step_details: Dict[str,
                       Any] = Field(..., description="Detailed step information")
    session_start_time: Optional[str] = Field(
        None, description="Session start timestamp")
    last_activity: Optional[str] = Field(
        None, description="Last activity timestamp")
    message: str = Field(..., description="Status message")


class EnhancedProgressUpdateMessage(BaseModel):
    """Model for enhanced progress updates with step data"""
    step: str = Field(..., description="Current step name")
    progress: int = Field(..., description="Progress percentage (0-100)")
    message: str = Field(..., description="Progress message")
    timestamp: str = Field(..., description="Timestamp of the update")
    overall_progress: int = Field(...,
                                  description="Overall progress percentage")
    current_step: str = Field(..., description="Current step name")
    step_data: Dict[str, Any] = Field(
        default_factory=dict, description="Step-specific data")
    client_id: Optional[str] = Field(None, description="Client identifier")
