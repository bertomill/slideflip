# Logging Optimization

This document describes the improvements made to reduce excessive logging output and provide better logging management.

## Problem

The original logging system was producing too many log messages, particularly:
- Multiple service initializations
- Repeated template loading messages
- Excessive INFO level logging from service modules
- Noisy startup sequences

## Solution

### 1. Service Registry

Created a centralized service registry (`src/core/service_registry.py`) to:
- Prevent multiple initializations of the same services
- Implement singleton patterns for expensive services
- Provide centralized service management

### 2. Improved Logging Configuration

Created `src/core/logging_config.py` with:
- Environment-based logging configuration
- Module-specific log level management
- Granular control over what gets logged

### 3. Module-Specific Log Levels

Set appropriate log levels for different modules:
- **Core modules**: INFO level for important operations
- **Service modules**: WARNING level to reduce noise
- **Agent modules**: WARNING level to reduce noise
- **Prompt management**: WARNING level to reduce template loading noise
- **External libraries**: WARNING level to reduce noise

### 4. Singleton Pattern Implementation

Updated key services to use singleton patterns:
- `SimplePromptManager` - prevents multiple initializations
- Service registry integration for core services

## Configuration

### Environment Variables

```bash
# Main log level
LOG_LEVEL=INFO  # DEBUG, INFO, WARNING, ERROR, CRITICAL

# Log format
LOG_FORMAT=structured  # structured or simple

# Environment
ENVIRONMENT=development  # development, staging, production

# Module-specific overrides
LOG_LEVEL_SRC_SERVICES_LLM_SERVICE=DEBUG
LOG_LEVEL_SRC_AGENTS_CONTENT_CREATOR_AGENT=INFO
```

### Module Log Levels

| Module | Default Level | Purpose |
|--------|---------------|---------|
| `src.core.initialization` | INFO | Important system initialization |
| `src.services.*` | WARNING | Service operations (reduce noise) |
| `src.agents.*` | WARNING | Agent operations (reduce noise) |
| `src.core.prompt_manager` | WARNING | Template loading (reduce noise) |
| `uvicorn` | WARNING | Web server (reduce noise) |
| `fastapi` | WARNING | Framework (reduce noise) |

## Usage

### Basic Logging

```python
from src.core.logger import get_logger

logger = get_logger("my_module")
logger.info("Important message")
logger.debug("Debug info (only visible in DEBUG mode)")
logger.warning("Warning message")
```

### Service Registration

```python
from src.core.service_registry import get_or_create_service

# Get or create service (singleton)
file_service = get_or_create_service("file_service", FileService)
```

### Testing

Run the test script to verify logging configuration:

```bash
uv run test_logging.py
```

## Benefits

1. **Reduced Noise**: Eliminated excessive INFO level logging
2. **Better Control**: Module-specific log level management
3. **Environment Aware**: Different configurations for dev/staging/prod
4. **Performance**: Prevented multiple service initializations
5. **Maintainability**: Centralized logging configuration

## Migration

Existing code continues to work, but logging output is now much cleaner. To enable verbose logging for specific modules:

```bash
export LOG_LEVEL_SRC_SERVICES_LLM_SERVICE=DEBUG
export LOG_LEVEL_SRC_AGENTS_CONTENT_CREATOR_AGENT=INFO
```

## Future Improvements

- Add log rotation and retention policies
- Implement structured logging for production environments
- Add log aggregation and monitoring integration
- Create log level hot-reloading capability
