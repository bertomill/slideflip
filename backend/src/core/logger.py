"""
Enhanced logging configuration for Slideo backend
Provides structured logging with different levels and contexts
"""

import logging
import sys
import json
from datetime import datetime
from typing import Any, Dict, Optional
from contextlib import contextmanager
import traceback
from pathlib import Path


class StructuredFormatter(logging.Formatter):
    """Custom formatter that outputs structured JSON logs"""

    def format(self, record: logging.LogRecord) -> str:
        # Base log structure
        log_data = {
            'timestamp': datetime.utcnow().isoformat() + 'Z',
            'level': record.levelname,
            'logger': record.name,
            'message': record.getMessage(),
            'module': record.module,
            'function': record.funcName,
            'line': record.lineno
        }

        # Add extra fields if they exist
        if hasattr(record, 'client_id'):
            log_data['client_id'] = record.client_id
        if hasattr(record, 'session_id'):
            log_data['session_id'] = record.session_id
        if hasattr(record, 'request_id'):
            log_data['request_id'] = record.request_id
        if hasattr(record, 'step'):
            log_data['step'] = record.step
        if hasattr(record, 'duration'):
            log_data['duration'] = record.duration
        if hasattr(record, 'extra_data'):
            log_data.update(record.extra_data)

        # Add exception info if present
        if record.exc_info:
            log_data['exception'] = {
                'type': record.exc_info[0].__name__,
                'message': str(record.exc_info[1]),
                'traceback': traceback.format_exception(*record.exc_info)
            }

        return json.dumps(log_data, default=str)


class SlideoLogger:
    """Enhanced logger for Slideo application with context management"""

    def __init__(self, name: str):
        self.logger = logging.getLogger(name)
        self._context: Dict[str, Any] = {}

    def with_context(self, **kwargs) -> 'SlideoLogger':
        """Create a new logger instance with additional context"""
        new_logger = SlideoLogger(self.logger.name)
        new_logger.logger = self.logger
        new_logger._context = {**self._context, **kwargs}
        return new_logger

    def _log(self, level: int, msg: str, **kwargs):
        """Internal logging method that adds context"""
        extra = {**self._context, **kwargs}
        self.logger.log(level, msg, extra=extra)

    def debug(self, msg: str, **kwargs):
        """Debug level logging"""
        self._log(logging.DEBUG, msg, **kwargs)

    def info(self, msg: str, **kwargs):
        """Info level logging"""
        self._log(logging.INFO, msg, **kwargs)

    def warning(self, msg: str, **kwargs):
        """Warning level logging"""
        self._log(logging.WARNING, msg, **kwargs)

    def error(self, msg: str, **kwargs):
        """Error level logging"""
        self._log(logging.ERROR, msg, **kwargs)

    def critical(self, msg: str, **kwargs):
        """Critical level logging"""
        self._log(logging.CRITICAL, msg, **kwargs)

    def exception(self, msg: str, **kwargs):
        """Log exception with traceback"""
        kwargs['exc_info'] = True
        self._log(logging.ERROR, msg, **kwargs)

    @contextmanager
    def timer(self, operation: str, **context):
        """Context manager to time operations"""
        start_time = datetime.now()
        timer_logger = self.with_context(operation=operation, **context)
        timer_logger.info(f"Starting {operation}")

        try:
            yield timer_logger
            duration = (datetime.now() - start_time).total_seconds()
            timer_logger.info(f"Completed {operation}", duration=duration)
        except Exception as e:
            duration = (datetime.now() - start_time).total_seconds()
            timer_logger.error(
                f"Failed {operation}: {str(e)}", duration=duration)
            raise


def setup_logging(
    level: str = "INFO",
    log_file: Optional[str] = None,
    enable_console: bool = True,
    structured: bool = True
):
    """
    Setup logging configuration for the application

    Args:
        level: Logging level (DEBUG, INFO, WARNING, ERROR, CRITICAL)
        log_file: Optional file path for file logging
        enable_console: Whether to enable console logging
        structured: Whether to use structured JSON logging
    """
    # Clear any existing handlers
    root_logger = logging.getLogger()
    root_logger.handlers.clear()

    # Set the logging level
    numeric_level = getattr(logging, level.upper(), logging.INFO)
    root_logger.setLevel(numeric_level)

    # Choose formatter
    if structured:
        formatter = StructuredFormatter()
    else:
        formatter = logging.Formatter(
            '%(asctime)s - %(name)s - %(levelname)s - %(message)s'
        )

    # Console handler
    if enable_console:
        console_handler = logging.StreamHandler(sys.stdout)
        console_handler.setFormatter(formatter)
        root_logger.addHandler(console_handler)

    # File handler
    if log_file:
        # Ensure log directory exists
        Path(log_file).parent.mkdir(parents=True, exist_ok=True)
        file_handler = logging.FileHandler(log_file)
        file_handler.setFormatter(formatter)
        root_logger.addHandler(file_handler)

    # Set specific logger levels
    logging.getLogger("uvicorn").setLevel(logging.INFO)
    logging.getLogger("uvicorn.access").setLevel(logging.WARNING)
    logging.getLogger("fastapi").setLevel(logging.INFO)


def get_logger(name: str) -> SlideoLogger:
    """Get a Slideo logger instance"""
    return SlideoLogger(name)

# WebSocket specific logging utilities


class WebSocketLogger:
    """Specialized logger for WebSocket operations"""

    def __init__(self, base_logger: SlideoLogger):
        self.logger = base_logger

    def log_connection(self, client_id: str, event: str, **details):
        """Log WebSocket connection events"""
        self.logger.with_context(
            client_id=client_id,
            event_type="connection",
            **details
        ).info(f"WebSocket {event}")

    def log_message(self, client_id: str, message_type: str, message_id: str, direction: str, **details):
        """Log WebSocket message events"""
        self.logger.with_context(
            client_id=client_id,
            message_type=message_type,
            message_id=message_id,
            direction=direction,
            event_type="message",
            **details
        ).info(f"WebSocket message {direction}: {message_type}")

    def log_error(self, client_id: str, error: str, **details):
        """Log WebSocket errors"""
        self.logger.with_context(
            client_id=client_id,
            event_type="error",
            **details
        ).error(f"WebSocket error: {error}")

    def log_processing(self, client_id: str, step: str, progress: int = 0, **details):
        """Log processing steps with progress"""
        self.logger.with_context(
            client_id=client_id,
            step=step,
            progress=progress,
            event_type="processing",
            **details
        ).info(f"Processing {step} - {progress}% complete")

# Service-specific loggers


def get_websocket_logger() -> WebSocketLogger:
    """Get WebSocket specialized logger"""
    base_logger = get_logger("websocket")
    return WebSocketLogger(base_logger)


def get_service_logger(service_name: str) -> SlideoLogger:
    """Get service-specific logger"""
    return get_logger(f"service.{service_name}")


def get_workflow_logger(workflow_name: str) -> SlideoLogger:
    """Get workflow-specific logger"""
    return get_logger(f"workflow.{workflow_name}")
