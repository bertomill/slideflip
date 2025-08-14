"""
Monitoring API Router

Provides endpoints for accessing system metrics, workflow performance,
and prompt usage statistics for monitoring and observability.
"""

from fastapi import APIRouter, HTTPException, Query
from typing import Optional, Dict, Any
import logging
from src.core.monitoring import get_monitoring_service
from src.core.prompt_manager import get_prompt_manager

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/monitoring", tags=["monitoring"])


@router.get("/health")
async def health_check():
    """Basic health check endpoint"""
    return {
        "status": "healthy",
        "service": "slideflip-backend",
        "monitoring": "active"
    }


@router.get("/metrics/system")
async def get_system_metrics():
    """Get overall system performance metrics"""
    try:
        monitoring_service = get_monitoring_service()
        return monitoring_service.get_system_metrics()
    except Exception as e:
        logger.error(f"Error retrieving system metrics: {e}")
        raise HTTPException(
            status_code=500, detail="Failed to retrieve system metrics")


@router.get("/metrics/workflows")
async def get_workflow_metrics(workflow_name: Optional[str] = Query(None)):
    """Get workflow performance metrics"""
    try:
        monitoring_service = get_monitoring_service()
        return monitoring_service.get_workflow_metrics(workflow_name)
    except Exception as e:
        logger.error(f"Error retrieving workflow metrics: {e}")
        raise HTTPException(
            status_code=500, detail="Failed to retrieve workflow metrics")


@router.get("/metrics/prompts")
async def get_prompt_metrics(template_name: Optional[str] = Query(None)):
    """Get prompt usage metrics"""
    try:
        monitoring_service = get_monitoring_service()
        return monitoring_service.get_prompt_metrics(template_name)
    except Exception as e:
        logger.error(f"Error retrieving prompt metrics: {e}")
        raise HTTPException(
            status_code=500, detail="Failed to retrieve prompt metrics")


@router.get("/metrics/summary")
async def get_performance_summary():
    """Get comprehensive performance summary"""
    try:
        monitoring_service = get_monitoring_service()
        return monitoring_service.get_performance_summary()
    except Exception as e:
        logger.error(f"Error retrieving performance summary: {e}")
        raise HTTPException(
            status_code=500, detail="Failed to retrieve performance summary")


@router.get("/templates")
async def get_prompt_templates():
    """Get list of available prompt templates"""
    try:
        prompt_manager = get_prompt_manager()
        return {
            "templates": prompt_manager.list_templates(),
            "total_count": len(prompt_manager.templates)
        }
    except Exception as e:
        logger.error(f"Error retrieving prompt templates: {e}")
        raise HTTPException(
            status_code=500, detail="Failed to retrieve prompt templates")


@router.post("/templates/reload")
async def reload_prompt_templates():
    """Reload prompt templates from disk"""
    try:
        prompt_manager = get_prompt_manager()
        prompt_manager.reload_templates()
        return {
            "status": "success",
            "message": "Prompt templates reloaded successfully",
            "template_count": len(prompt_manager.templates)
        }
    except Exception as e:
        logger.error(f"Error reloading prompt templates: {e}")
        raise HTTPException(
            status_code=500, detail="Failed to reload prompt templates")


@router.post("/metrics/export")
async def export_metrics(format: str = "json"):
    """Export metrics data"""
    try:
        monitoring_service = get_monitoring_service()
        metrics_data = await monitoring_service.export_metrics(format=format)

        return {
            "status": "success",
            "format": format,
            "data": metrics_data
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error exporting metrics: {e}")
        raise HTTPException(status_code=500, detail="Failed to export metrics")


@router.post("/cleanup")
async def cleanup_old_data():
    """Clean up old monitoring data"""
    try:
        monitoring_service = get_monitoring_service()
        await monitoring_service.cleanup_old_data()
        return {
            "status": "success",
            "message": "Old monitoring data cleaned up successfully"
        }
    except Exception as e:
        logger.error(f"Error cleaning up monitoring data: {e}")
        raise HTTPException(
            status_code=500, detail="Failed to clean up monitoring data")


@router.get("/debug/active-executions")
async def get_active_executions():
    """Get currently active workflow executions (for debugging)"""
    try:
        monitoring_service = get_monitoring_service()
        return {
            "active_executions": list(monitoring_service.active_executions.keys()),
            "count": len(monitoring_service.active_executions)
        }
    except Exception as e:
        logger.error(f"Error retrieving active executions: {e}")
        raise HTTPException(
            status_code=500, detail="Failed to retrieve active executions")
