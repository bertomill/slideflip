"""
Monitoring and Observability System

Centralized monitoring for AI workflows, prompt usage, and system performance.
Provides hooks for logging, metrics collection, and future integration with
monitoring platforms like Prometheus, DataDog, or custom analytics.
"""

import logging
import json
import time
from datetime import datetime, timedelta
from typing import Dict, Any, Optional, List, Callable
from dataclasses import dataclass, field
from pathlib import Path
import asyncio
from collections import defaultdict, deque

logger = logging.getLogger(__name__)


@dataclass
class WorkflowMetrics:
    """Metrics for workflow execution"""
    workflow_name: str
    execution_count: int = 0
    success_count: int = 0
    failure_count: int = 0
    total_duration: float = 0.0
    average_duration: float = 0.0
    last_execution: Optional[datetime] = None
    error_types: Dict[str, int] = field(default_factory=dict)
    step_metrics: Dict[str, Dict[str, float]] = field(default_factory=dict)


@dataclass
class PromptMetrics:
    """Metrics for prompt usage"""
    template_name: str
    usage_count: int = 0
    total_tokens: int = 0
    total_cost: float = 0.0
    average_latency: float = 0.0
    success_rate: float = 0.0
    last_used: Optional[datetime] = None
    error_count: int = 0


@dataclass
class SystemMetrics:
    """Overall system performance metrics"""
    total_requests: int = 0
    active_workflows: int = 0
    memory_usage: float = 0.0
    cpu_usage: float = 0.0
    uptime: float = 0.0
    error_rate: float = 0.0


class MonitoringService:
    """
    Centralized monitoring service for AI workflows and system performance.
    Provides real-time metrics, logging, and observability hooks.
    """

    def __init__(self, log_file: str = None, metrics_retention_days: int = 7):
        self.log_file = Path(log_file) if log_file else Path(
            "logs/monitoring.log")
        self.metrics_retention_days = metrics_retention_days

        # Metrics storage
        self.workflow_metrics: Dict[str, WorkflowMetrics] = {}
        self.prompt_metrics: Dict[str, PromptMetrics] = {}
        self.system_metrics = SystemMetrics()

        # Event logging
        self.event_log: deque = deque(maxlen=10000)  # Keep last 10k events
        self.error_log: deque = deque(maxlen=1000)   # Keep last 1k errors

        # Performance tracking
        self.active_executions: Dict[str, datetime] = {}
        self.performance_history: Dict[str, List[float]] = defaultdict(list)

        # Hooks for external monitoring systems
        self.monitoring_hooks: List[Callable] = []

        # Start time for uptime calculation
        self.start_time = datetime.now()

        # Ensure log directory exists
        self.log_file.parent.mkdir(parents=True, exist_ok=True)

        logger.info("MonitoringService initialized")

    def add_monitoring_hook(self, hook: Callable[[Dict[str, Any]], None]):
        """Add a custom monitoring hook for external systems"""
        self.monitoring_hooks.append(hook)
        logger.info(f"Added monitoring hook: {hook.__name__}")

    async def start_workflow_execution(self, workflow_name: str, execution_id: str, metadata: Dict[str, Any] = None):
        """Start tracking a workflow execution"""
        start_time = datetime.now()

        # Initialize workflow metrics if not exists
        if workflow_name not in self.workflow_metrics:
            self.workflow_metrics[workflow_name] = WorkflowMetrics(
                workflow_name=workflow_name)

        # Track active execution
        self.active_executions[execution_id] = start_time

        # Log event
        event = {
            "type": "workflow_start",
            "workflow_name": workflow_name,
            "execution_id": execution_id,
            "timestamp": start_time.isoformat(),
            "metadata": metadata or {}
        }

        self.event_log.append(event)
        await self._call_monitoring_hooks(event)

        logger.info(
            f"Started workflow execution: {workflow_name} ({execution_id})")

    async def end_workflow_execution(
        self,
        workflow_name: str,
        execution_id: str,
        success: bool = True,
        error: str = None,
        step_timings: Dict[str, float] = None
    ):
        """End tracking a workflow execution"""
        end_time = datetime.now()

        # Calculate duration
        start_time = self.active_executions.pop(execution_id, end_time)
        duration = (end_time - start_time).total_seconds()

        # Update workflow metrics
        metrics = self.workflow_metrics.get(workflow_name)
        if metrics:
            metrics.execution_count += 1
            metrics.total_duration += duration
            metrics.average_duration = metrics.total_duration / metrics.execution_count
            metrics.last_execution = end_time

            if success:
                metrics.success_count += 1
            else:
                metrics.failure_count += 1
                if error:
                    error_type = type(error).__name__ if isinstance(
                        error, Exception) else "unknown"
                    metrics.error_types[error_type] = metrics.error_types.get(
                        error_type, 0) + 1

            # Update step metrics
            if step_timings:
                for step_name, step_duration in step_timings.items():
                    if step_name not in metrics.step_metrics:
                        metrics.step_metrics[step_name] = {
                            "total": 0.0, "count": 0, "average": 0.0}

                    step_metric = metrics.step_metrics[step_name]
                    step_metric["total"] += step_duration
                    step_metric["count"] += 1
                    step_metric["average"] = step_metric["total"] / \
                        step_metric["count"]

        # Update performance history
        self.performance_history[workflow_name].append(duration)
        if len(self.performance_history[workflow_name]) > 100:
            self.performance_history[workflow_name] = self.performance_history[workflow_name][-100:]

        # Log event
        event = {
            "type": "workflow_end",
            "workflow_name": workflow_name,
            "execution_id": execution_id,
            "timestamp": end_time.isoformat(),
            "duration": duration,
            "success": success,
            "error": error,
            "step_timings": step_timings or {}
        }

        self.event_log.append(event)

        if not success and error:
            self.error_log.append(event)

        await self._call_monitoring_hooks(event)

        status = "completed" if success else "failed"
        logger.info(
            f"Workflow execution {status}: {workflow_name} ({execution_id}) in {duration:.2f}s")

    async def track_prompt_usage(
        self,
        template_name: str,
        tokens_used: int = 0,
        latency: float = 0.0,
        cost: float = 0.0,
        success: bool = True
    ):
        """Track prompt template usage metrics"""
        # Initialize prompt metrics if not exists
        if template_name not in self.prompt_metrics:
            self.prompt_metrics[template_name] = PromptMetrics(
                template_name=template_name)

        metrics = self.prompt_metrics[template_name]
        metrics.usage_count += 1
        metrics.total_tokens += tokens_used
        metrics.total_cost += cost
        metrics.last_used = datetime.now()

        if not success:
            metrics.error_count += 1

        # Calculate success rate
        metrics.success_rate = (metrics.usage_count -
                                metrics.error_count) / metrics.usage_count

        # Update average latency
        if latency > 0:
            total_latency = metrics.average_latency * \
                (metrics.usage_count - 1) + latency
            metrics.average_latency = total_latency / metrics.usage_count

        # Log event
        event = {
            "type": "prompt_usage",
            "template_name": template_name,
            "timestamp": datetime.now().isoformat(),
            "tokens_used": tokens_used,
            "latency": latency,
            "cost": cost,
            "success": success
        }

        self.event_log.append(event)
        await self._call_monitoring_hooks(event)

        logger.debug(
            f"Tracked prompt usage: {template_name} ({tokens_used} tokens, {latency:.2f}s)")

    def get_workflow_metrics(self, workflow_name: str = None) -> Dict[str, Any]:
        """Get workflow performance metrics"""
        if workflow_name:
            metrics = self.workflow_metrics.get(workflow_name)
            return metrics.__dict__ if metrics else {}

        return {name: metrics.__dict__ for name, metrics in self.workflow_metrics.items()}

    def get_prompt_metrics(self, template_name: str = None) -> Dict[str, Any]:
        """Get prompt usage metrics"""
        if template_name:
            metrics = self.prompt_metrics.get(template_name)
            return metrics.__dict__ if metrics else {}

        return {name: metrics.__dict__ for name, metrics in self.prompt_metrics.items()}

    def get_system_metrics(self) -> Dict[str, Any]:
        """Get overall system metrics"""
        # Update uptime
        self.system_metrics.uptime = (
            datetime.now() - self.start_time).total_seconds()

        # Update active workflows
        self.system_metrics.active_workflows = len(self.active_executions)

        # Calculate error rate
        total_executions = sum(
            m.execution_count for m in self.workflow_metrics.values())
        total_failures = sum(
            m.failure_count for m in self.workflow_metrics.values())
        self.system_metrics.error_rate = total_failures / \
            max(total_executions, 1)

        return self.system_metrics.__dict__

    def get_performance_summary(self) -> Dict[str, Any]:
        """Get comprehensive performance summary"""
        return {
            "system_metrics": self.get_system_metrics(),
            "workflow_metrics": self.get_workflow_metrics(),
            "prompt_metrics": self.get_prompt_metrics(),
            "recent_events": list(self.event_log)[-50:],  # Last 50 events
            "recent_errors": list(self.error_log)[-20:],  # Last 20 errors
            "performance_trends": {
                name: {
                    "recent_average": sum(durations[-10:]) / min(len(durations), 10),
                    "trend": "improving" if len(durations) > 5 and
                    sum(durations[-5:]) / 5 < sum(durations[-10:-5]) / 5 else "stable"
                }
                for name, durations in self.performance_history.items() if durations
            }
        }

    async def export_metrics(self, format: str = "json", file_path: str = None) -> str:
        """Export metrics to file or return as string"""
        metrics_data = self.get_performance_summary()

        if format.lower() == "json":
            metrics_json = json.dumps(metrics_data, indent=2, default=str)

            if file_path:
                with open(file_path, 'w') as f:
                    f.write(metrics_json)
                logger.info(f"Metrics exported to {file_path}")

            return metrics_json

        # Add other formats (CSV, YAML) as needed
        raise ValueError(f"Unsupported export format: {format}")

    async def cleanup_old_data(self):
        """Clean up old metrics data based on retention policy"""
        cutoff_date = datetime.now() - timedelta(days=self.metrics_retention_days)

        # Clean up old events
        self.event_log = deque(
            [event for event in self.event_log
             if datetime.fromisoformat(event["timestamp"]) > cutoff_date],
            maxlen=self.event_log.maxlen
        )

        # Clean up old errors
        self.error_log = deque(
            [error for error in self.error_log
             if datetime.fromisoformat(error["timestamp"]) > cutoff_date],
            maxlen=self.error_log.maxlen
        )

        logger.info(
            f"Cleaned up monitoring data older than {self.metrics_retention_days} days")

    async def _call_monitoring_hooks(self, event: Dict[str, Any]):
        """Call all registered monitoring hooks"""
        for hook in self.monitoring_hooks:
            try:
                if asyncio.iscoroutinefunction(hook):
                    await hook(event)
                else:
                    hook(event)
            except Exception as e:
                logger.error(f"Error in monitoring hook {hook.__name__}: {e}")

    def create_workflow_context(self, workflow_name: str, execution_id: str = None):
        """Create a context manager for workflow monitoring"""
        if execution_id is None:
            execution_id = f"{workflow_name}_{int(time.time() * 1000)}"

        return WorkflowContext(self, workflow_name, execution_id)


class WorkflowContext:
    """Context manager for automatic workflow monitoring"""

    def __init__(self, monitoring_service: MonitoringService, workflow_name: str, execution_id: str):
        self.monitoring_service = monitoring_service
        self.workflow_name = workflow_name
        self.execution_id = execution_id
        self.start_time = None
        self.step_timings = {}
        self.current_step = None
        self.current_step_start = None

    async def __aenter__(self):
        await self.monitoring_service.start_workflow_execution(
            self.workflow_name,
            self.execution_id
        )
        self.start_time = datetime.now()
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        success = exc_type is None
        error = str(exc_val) if exc_val else None

        # End current step if active
        if self.current_step and self.current_step_start:
            step_duration = (datetime.now() -
                             self.current_step_start).total_seconds()
            self.step_timings[self.current_step] = step_duration

        await self.monitoring_service.end_workflow_execution(
            self.workflow_name,
            self.execution_id,
            success=success,
            error=error,
            step_timings=self.step_timings
        )

    def start_step(self, step_name: str):
        """Start timing a workflow step"""
        # End previous step
        if self.current_step and self.current_step_start:
            step_duration = (datetime.now() -
                             self.current_step_start).total_seconds()
            self.step_timings[self.current_step] = step_duration

        # Start new step
        self.current_step = step_name
        self.current_step_start = datetime.now()

    def end_step(self):
        """End timing the current workflow step"""
        if self.current_step and self.current_step_start:
            step_duration = (datetime.now() -
                             self.current_step_start).total_seconds()
            self.step_timings[self.current_step] = step_duration
            self.current_step = None
            self.current_step_start = None


# Global monitoring service instance
_monitoring_service: Optional[MonitoringService] = None


def get_monitoring_service() -> MonitoringService:
    """Get the global monitoring service instance"""
    global _monitoring_service
    if _monitoring_service is None:
        _monitoring_service = MonitoringService()
    return _monitoring_service


def initialize_monitoring(log_file: str = None, retention_days: int = 7) -> MonitoringService:
    """Initialize the global monitoring service"""
    global _monitoring_service
    _monitoring_service = MonitoringService(log_file, retention_days)
    return _monitoring_service
