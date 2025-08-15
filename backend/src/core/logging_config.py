"""
Logging Configuration

Centralized logging configuration with environment-based control
and module-specific log level management.
"""

import os
from typing import Dict, Any

# Default logging configuration
DEFAULT_LOG_LEVEL = "INFO"
DEFAULT_LOG_FORMAT = "structured"  # "structured" or "simple"

# Module-specific log levels
MODULE_LOG_LEVELS = {
    # Core modules - INFO level for important operations
    "src.core.initialization": "INFO",
    "src.core.logger": "INFO",
    "main": "INFO",
    
    # Service modules - WARNING level to reduce noise
    "src.services": "WARNING",
    "src.services.llm_service": "WARNING",
    "src.services.ai_service": "WARNING",
    "src.services.file_service": "WARNING",
    "src.services.slide_service": "WARNING",
    
    # Agent modules - WARNING level to reduce noise
    "src.agents": "WARNING",
    "src.agents.content_creator_agent": "WARNING",
    
    # Prompt management - WARNING level to reduce template loading noise
    "src.core.prompt_manager": "WARNING",
    "src.core.simple_prompt_manager": "WARNING",
    
    # Monitoring - WARNING level to reduce frequent updates
    "src.core.monitoring": "WARNING",
    
    # WebSocket - WARNING level to reduce connection noise
    "src.core.websocket_manager": "WARNING",
    "src.core.improved_websocket_manager": "WARNING",
    
    # External libraries - WARNING level to reduce noise
    "uvicorn": "WARNING",
    "uvicorn.access": "WARNING",
    "fastapi": "WARNING",
    "httpx": "WARNING",
    "openai": "WARNING",
}

# Environment variable overrides
def get_log_level() -> str:
    """Get the main log level from environment or default"""
    return os.getenv("LOG_LEVEL", DEFAULT_LOG_LEVEL)

def get_log_format() -> str:
    """Get the log format from environment or default"""
    return os.getenv("LOG_FORMAT", DEFAULT_LOG_FORMAT)

def get_module_log_level(module_name: str) -> str:
    """Get the log level for a specific module"""
    # Check environment variable first
    env_key = f"LOG_LEVEL_{module_name.upper().replace('.', '_')}"
    env_level = os.getenv(env_key)
    if env_level:
        return env_level
    
    # Check module-specific configuration
    for module_pattern, level in MODULE_LOG_LEVELS.items():
        if module_name.startswith(module_pattern):
            return level
    
    # Return default level
    return get_log_level()

def is_verbose_logging() -> bool:
    """Check if verbose logging is enabled"""
    return get_log_level().upper() in ["DEBUG", "VERBOSE"]

def should_log_module(module_name: str, level: str) -> bool:
    """Check if a module should log at the given level"""
    module_level = get_module_log_level(module_name)
    level_priority = {
        "DEBUG": 0,
        "INFO": 1,
        "WARNING": 2,
        "ERROR": 3,
        "CRITICAL": 4
    }
    
    module_priority = level_priority.get(module_level.upper(), 1)
    level_priority_num = level_priority.get(level.upper(), 1)
    
    return level_priority_num >= module_priority

# Logging configuration for different environments
def get_environment_config() -> Dict[str, Any]:
    """Get logging configuration based on environment"""
    env = os.getenv("ENVIRONMENT", "development").lower()
    
    if env == "production":
        return {
            "level": "WARNING",
            "format": "structured",
            "enable_console": True,
            "enable_file": True,
            "file_level": "INFO"
        }
    elif env == "staging":
        return {
            "level": "INFO",
            "format": "structured",
            "enable_console": True,
            "enable_file": True,
            "file_level": "DEBUG"
        }
    else:  # development
        return {
            "level": "INFO",
            "format": "simple",  # Use simple format for development
            "enable_console": True,
            "enable_file": False,  # Don't create log files in development
            "file_level": "DEBUG"
        }
