"""
System Initialization

Handles initialization of core services including prompt management,
monitoring, and workflow systems.
"""

import logging
from pathlib import Path
from typing import Optional

logger = logging.getLogger(__name__)


def initialize_core_services(
    prompts_dir: Optional[str] = None,
    monitoring_log_file: Optional[str] = None,
    monitoring_retention_days: int = 7
) -> dict:
    """
    Initialize all core services for the AI system

    Args:
        prompts_dir: Directory containing prompt templates
        monitoring_log_file: File for monitoring logs
        monitoring_retention_days: Days to retain monitoring data

    Returns:
        Dict with initialization status and service references
    """
    initialization_status = {
        "prompt_manager": False,
        "monitoring_service": False,
        "errors": []
    }

    try:
        # Initialize prompt manager
        from src.core.prompt_manager import initialize_prompt_manager

        if prompts_dir:
            prompt_manager = initialize_prompt_manager(prompts_dir)
        else:
            # Use default directory
            default_prompts_dir = Path(__file__).parent.parent / "prompts"
            prompt_manager = initialize_prompt_manager(
                str(default_prompts_dir))

        template_count = len(prompt_manager.templates)
        logger.info(
            f"Prompt manager initialized with {template_count} templates")
        initialization_status["prompt_manager"] = True
        initialization_status["template_count"] = template_count

    except Exception as e:
        error_msg = f"Failed to initialize prompt manager: {e}"
        logger.error(error_msg)
        initialization_status["errors"].append(error_msg)

    try:
        # Initialize monitoring service
        from src.core.monitoring import initialize_monitoring

        monitoring_service = initialize_monitoring(
            log_file=monitoring_log_file,
            retention_days=monitoring_retention_days
        )

        logger.info("Monitoring service initialized successfully")
        initialization_status["monitoring_service"] = True

    except Exception as e:
        error_msg = f"Failed to initialize monitoring service: {e}"
        logger.error(error_msg)
        initialization_status["errors"].append(error_msg)

    # Log overall initialization status
    if initialization_status["prompt_manager"] and initialization_status["monitoring_service"]:
        logger.info("All core services initialized successfully")
        initialization_status["status"] = "success"
    elif initialization_status["errors"]:
        logger.warning(
            f"Core services initialized with errors: {initialization_status['errors']}")
        initialization_status["status"] = "partial"
    else:
        logger.error("Failed to initialize core services")
        initialization_status["status"] = "failed"

    return initialization_status


def validate_system_requirements() -> dict:
    """
    Validate that all required dependencies and configurations are available

    Returns:
        Dict with validation results
    """
    validation_results = {
        "langgraph_available": False,
        "openai_available": False,
        "jinja2_available": False,
        "yaml_available": False,
        "prompts_directory": False,
        "errors": [],
        "warnings": []
    }

    # Check LangGraph availability
    try:
        import langgraph
        validation_results["langgraph_available"] = True
        # LangGraph doesn't have __version__ in some versions, so get version safely
        version = getattr(langgraph, '__version__', 'unknown')
        logger.info(f"LangGraph available: {version}")
    except ImportError:
        validation_results["warnings"].append(
            "LangGraph not available - using fallback implementation")
    except AttributeError:
        validation_results["langgraph_available"] = True
        logger.info("LangGraph available: version unknown")

    # Check OpenAI availability
    try:
        import openai
        validation_results["openai_available"] = True
        logger.info(f"OpenAI SDK available: {openai.__version__}")
    except ImportError:
        validation_results["errors"].append("OpenAI SDK not available")

    # Check Jinja2 availability
    try:
        import jinja2
        validation_results["jinja2_available"] = True
        logger.info(f"Jinja2 available: {jinja2.__version__}")
    except ImportError:
        validation_results["errors"].append(
            "Jinja2 not available - required for prompt templates")

    # Check YAML availability
    try:
        import yaml
        validation_results["yaml_available"] = True
        logger.info(f"PyYAML available: {yaml.__version__}")
    except ImportError:
        validation_results["errors"].append(
            "PyYAML not available - required for prompt templates")

    # Check prompts directory
    prompts_dir = Path(__file__).parent.parent / "prompts"
    if prompts_dir.exists():
        validation_results["prompts_directory"] = True
        yaml_files = list(prompts_dir.rglob("*.yaml")) + \
            list(prompts_dir.rglob("*.yml"))
        validation_results["prompt_files_found"] = len(yaml_files)
        logger.info(f"Found {len(yaml_files)} prompt template files")
    else:
        validation_results["errors"].append(
            f"Prompts directory not found: {prompts_dir}")

    # Determine overall status
    if validation_results["errors"]:
        validation_results["status"] = "failed"
        logger.error(
            f"System validation failed: {validation_results['errors']}")
    elif validation_results["warnings"]:
        validation_results["status"] = "warning"
        logger.warning(
            f"System validation completed with warnings: {validation_results['warnings']}")
    else:
        validation_results["status"] = "passed"
        logger.info("System validation passed successfully")

    return validation_results


def get_system_info() -> dict:
    """
    Get comprehensive system information for debugging and monitoring

    Returns:
        Dict with system information
    """
    system_info = {
        "python_version": None,
        "installed_packages": {},
        "environment_variables": {},
        "file_system": {},
        "services_status": {}
    }

    try:
        import sys
        system_info["python_version"] = sys.version

        # Get installed packages (key ones)
        packages_to_check = [
            "fastapi", "uvicorn", "openai", "langgraph", "langchain",
            "jinja2", "pyyaml", "pydantic", "asyncio"
        ]

        for package in packages_to_check:
            try:
                module = __import__(package)
                version = getattr(module, "__version__", "unknown")
                system_info["installed_packages"][package] = version
            except ImportError:
                system_info["installed_packages"][package] = "not_installed"

        # Check environment variables (non-sensitive ones)
        import os
        env_vars_to_check = ["OPENAI_API_KEY",
                             "TAVILY_API_KEY", "FIRECRAWL_API_KEY"]
        for env_var in env_vars_to_check:
            value = os.getenv(env_var)
            system_info["environment_variables"][env_var] = "set" if value else "not_set"

        # Check file system
        prompts_dir = Path(__file__).parent.parent / "prompts"
        system_info["file_system"] = {
            "prompts_directory_exists": prompts_dir.exists(),
            "prompts_directory_path": str(prompts_dir),
            "current_working_directory": str(Path.cwd())
        }

        # Check services status
        try:
            from src.core.prompt_manager import get_prompt_manager
            prompt_manager = get_prompt_manager()
            system_info["services_status"]["prompt_manager"] = {
                "available": True,
                "template_count": len(prompt_manager.templates)
            }
        except Exception as e:
            system_info["services_status"]["prompt_manager"] = {
                "available": False,
                "error": str(e)
            }

        try:
            from src.core.monitoring import get_monitoring_service
            monitoring_service = get_monitoring_service()
            system_info["services_status"]["monitoring_service"] = {
                "available": True,
                "active_workflows": len(monitoring_service.active_executions)
            }
        except Exception as e:
            system_info["services_status"]["monitoring_service"] = {
                "available": False,
                "error": str(e)
            }

    except Exception as e:
        logger.error(f"Error gathering system info: {e}")
        system_info["error"] = str(e)

    return system_info
