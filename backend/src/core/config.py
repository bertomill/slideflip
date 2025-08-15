"""
Configuration settings for the SlideFlip Backend

IMPORTANT FOR FRONTEND DEVELOPERS:
- Server runs on HOST:PORT (default: 0.0.0.0:8000)
- WebSocket connections use WEBSOCKET_PING_INTERVAL/TIMEOUT settings
- File uploads are limited by MAX_FILE_SIZE (50MB) and ALLOWED_FILE_TYPES
- Processing operations timeout after MAX_PROCESSING_TIME (5 minutes)
- Environment variables are read from `.env.local` (if present) and then `.env`
"""

import os
from pathlib import Path
from typing import Optional
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    """Application settings"""
    # Load from .env.local first (developer overrides), then .env
    # Paths are relative to backend working directory
    model_config = SettingsConfigDict(
        env_file=(".env.local", ".env"),
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore"  # Ignore extra fields not defined in this model
    )
    
    # Server settings - Frontend should connect to these endpoints
    HOST: str = "0.0.0.0"  # Backend server host
    PORT: int = 8000       # Backend server port - use this for API calls
    DEBUG: bool = True     # Development mode flag
    
    # File storage settings - Important for upload component integration
    UPLOAD_DIR: str = "uploads"                    # Directory for uploaded files
    KNOWLEDGE_GRAPH_BASE_DIR:str = "kg"           # Knowledge graph storage
    TEMP_DIR: str = "temp"                        # Temporary processing files
    OUTPUT_DIR: str = "output"                    # Generated slide outputs
    MAX_FILE_SIZE: int = 50 * 1024 * 1024         # 50MB limit - enforce in frontend
    ALLOWED_FILE_TYPES: list = [                  # Supported file types for upload validation
        "application/pdf",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "text/plain",
        "text/markdown",
        "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        "text/html",
        "application/xhtml+xml"
    ]
    
    # WebSocket settings - Use these for real-time progress updates
    WEBSOCKET_PING_INTERVAL: int = 30  # Ping every 30 seconds to keep connection alive
    WEBSOCKET_PING_TIMEOUT: int = 10   # Timeout after 10 seconds if no pong response

    # Database settings
    DATABASE_URL: Optional[str] = None
    
    # External APIs
    TAVILY_API_KEY: Optional[str] = None
    
    # Frontend URLs (for CORS/integration)
    NEXT_PUBLIC_BACKEND_URL: Optional[str] = None
    NEXT_PUBLIC_BACKEND_WS_URL: Optional[str] = None
    
    # LDAP settings (optional features)
    LDAP_URL: Optional[str] = None
    LDAP_BASE_DN: Optional[str] = None
    LDAP_BIND_DN: Optional[str] = None
    LDAP_BIND_PASSWORD: Optional[str] = None
    LDAP_USER_SEARCH_BASE: Optional[str] = None
    LDAP_USER_SEARCH_FILTER: Optional[str] = None
    LDAP_GROUP_SEARCH_BASE: Optional[str] = None
    LDAP_GROUP_SEARCH_FILTER: Optional[str] = None
    
    # Processing settings - Important for progress indicators and timeouts
    MAX_PROCESSING_TIME: int = 300     # 5 minutes - show timeout warning to users
    CONCURRENT_PROCESSES: int = 4      # Backend can handle 4 simultaneous requests
    MAX_THREADS: int = 4               # Threading limit for parallel operations
    
    # Logging settings - For debugging integration issues
    LOG_LEVEL: str = "INFO"
    LOG_FORMAT: str = "%(asctime)s - %(name)s - %(levelname)s - %(message)s"
    
    # Security settings - Required for authentication if implemented
    SECRET_KEY: str = "your-secret-key-here"      # JWT secret - change in production
    ALGORITHM: str = "HS256"                      # JWT algorithm
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30         # Token expiry time
    
    # Anthropic settings - Required for AI-powered slide generation
    ANTHROPIC_API_KEY: Optional[str] = None       # Set this in .env.local or .env