"""
Prompt Management System

Centralized system for managing YAML-based prompt templates with variable substitution,
monitoring hooks, and validation. Supports Jinja2 templating for dynamic content generation.
"""

import yaml
import json
import logging
from pathlib import Path
from typing import Dict, Any, Optional, List, Union
from datetime import datetime
from jinja2 import Template, Environment, BaseLoader
import asyncio
from dataclasses import dataclass, field

logger = logging.getLogger(__name__)


@dataclass
class PromptMetrics:
    """Metrics for prompt usage monitoring"""
    prompt_name: str
    execution_count: int = 0
    total_tokens: int = 0
    total_latency: float = 0.0
    success_count: int = 0
    error_count: int = 0
    last_used: Optional[datetime] = None
    average_latency: float = 0.0
    success_rate: float = 0.0


@dataclass
class PromptExecution:
    """Single prompt execution record"""
    prompt_name: str
    timestamp: datetime
    variables: Dict[str, Any]
    tokens_used: Optional[int] = None
    latency: Optional[float] = None
    success: bool = True
    error: Optional[str] = None
    model_config: Optional[Dict[str, Any]] = None


class PromptTemplate:
    """Represents a loaded prompt template with validation and rendering capabilities"""

    def __init__(self, template_data: Dict[str, Any], template_path: str):
        self.template_path = template_path
        self.name = template_data.get('name', '')
        self.description = template_data.get('description', '')
        self.version = template_data.get('version', '1.0')
        self.model_config = template_data.get('model_config', {})
        self.variables = template_data.get('variables', [])
        self.monitoring = template_data.get('monitoring', {})

        # Create Jinja2 templates
        self.system_template = Template(template_data.get('system_prompt', ''))
        self.user_template = Template(
            template_data.get('user_prompt_template', ''))

        # Validate required variables
        self.required_variables = [
            var['name'] for var in self.variables if var.get('required', False)
        ]

    def validate_variables(self, variables: Dict[str, Any]) -> List[str]:
        """Validate that all required variables are provided"""
        missing = []
        for required_var in self.required_variables:
            if required_var not in variables:
                missing.append(required_var)
        return missing

    def render(self, variables: Dict[str, Any]) -> Dict[str, str]:
        """Render the template with provided variables"""
        # Validate variables first
        missing = self.validate_variables(variables)
        if missing:
            raise ValueError(f"Missing required variables: {missing}")

        # Add default values for optional variables
        render_vars = variables.copy()
        for var_config in self.variables:
            var_name = var_config['name']
            if var_name not in render_vars and 'default' in var_config:
                render_vars[var_name] = var_config['default']

        try:
            system_prompt = self.system_template.render(**render_vars).strip()
            user_prompt = self.user_template.render(**render_vars).strip()

            # Add debug logging for template rendering
            logger.debug(f"Template '{self.name}' rendered successfully")
            logger.debug(f"Variables provided: {list(render_vars.keys())}")
            logger.debug(f"System prompt length: {len(system_prompt)}")
            logger.debug(f"User prompt length: {len(user_prompt)}")

            return {
                'system_prompt': system_prompt,
                'user_prompt': user_prompt,
                'model_config': self.model_config
            }
        except Exception as e:
            logger.error(f"Error rendering template {self.name}: {e}")
            logger.error(f"Variables provided: {render_vars}")
            logger.error(f"Template path: {self.template_path}")
            raise ValueError(f"Template rendering failed: {e}")


class PromptManager:
    """
    Centralized prompt management system with YAML template loading,
    variable substitution, and monitoring capabilities.
    """

    def __init__(self, prompts_dir: str = None):
        self.prompts_dir = Path(prompts_dir) if prompts_dir else Path(
            __file__).parent.parent / "prompts"
        self.templates: Dict[str, PromptTemplate] = {}
        self.metrics: Dict[str, PromptMetrics] = {}
        self.execution_history: List[PromptExecution] = []
        self.jinja_env = Environment(loader=BaseLoader())

        # Load all templates on initialization
        self._load_all_templates()

    def _load_all_templates(self):
        """Load all YAML template files from the prompts directory"""
        if not self.prompts_dir.exists():
            logger.warning(f"Prompts directory not found: {self.prompts_dir}")
            return

        yaml_files = list(self.prompts_dir.rglob("*.yaml")) + \
            list(self.prompts_dir.rglob("*.yml"))

        for yaml_file in yaml_files:
            try:
                self._load_template(yaml_file)
            except Exception as e:
                logger.error(f"Failed to load template {yaml_file}: {e}")

    def _load_template(self, template_path: Path):
        """Load a single YAML template file"""
        try:
            with open(template_path, 'r', encoding='utf-8') as f:
                template_data = yaml.safe_load(f)

            if not template_data:
                logger.error(f"Empty template file: {template_path}")
                return

            template_name = template_data.get('name')
            if not template_name:
                logger.error(f"Template missing name: {template_path}")
                return

            # Validate template structure
            if 'system_prompt' not in template_data or 'user_prompt_template' not in template_data:
                logger.error(
                    f"Template missing required fields: {template_path}")
                return

            # Create template object
            template = PromptTemplate(template_data, str(template_path))

            # Test template rendering with dummy variables to catch syntax errors
            try:
                dummy_vars = {var['name']: f"test_{var['name']}" for var in template_data.get(
                    'variables', [])}
                template.render(dummy_vars)
                logger.debug(f"Template validation passed: {template_name}")
            except Exception as validation_error:
                logger.error(
                    f"Template validation failed for {template_name}: {validation_error}")
                logger.error(f"Template path: {template_path}")
                return

            self.templates[template_name] = template

            # Initialize metrics
            self.metrics[template_name] = PromptMetrics(
                prompt_name=template_name)

            logger.info(f"Loaded template: {template_name}")

        except Exception as e:
            logger.error(f"Failed to load template {template_path}: {e}")
            import traceback
            logger.error(f"Traceback: {traceback.format_exc()}")

    def reload_templates(self):
        """Reload all templates from disk"""
        logger.info("Reloading all prompt templates")
        self.templates.clear()
        self._load_all_templates()

    def get_template(self, template_name: str) -> Optional[PromptTemplate]:
        """Get a template by name"""
        return self.templates.get(template_name)

    def list_templates(self) -> List[Dict[str, Any]]:
        """List all available templates with their metadata"""
        return [
            {
                'name': template.name,
                'description': template.description,
                'version': template.version,
                'variables': template.variables,
                'model_config': template.model_config,
                'path': template.template_path
            }
            for template in self.templates.values()
        ]

    async def render_prompt(
        self,
        template_name: str,
        variables: Dict[str, Any],
        track_metrics: bool = True
    ) -> Dict[str, Any]:
        """
        Render a prompt template with variables and optional metrics tracking

        Args:
            template_name: Name of the template to render
            variables: Variables to substitute in the template
            track_metrics: Whether to track execution metrics

        Returns:
            Dict containing rendered prompts and metadata
        """
        start_time = datetime.now()

        try:
            template = self.get_template(template_name)
            if not template:
                raise ValueError(f"Template '{template_name}' not found")

            # Render the template
            rendered = template.render(variables)

            # Create execution record
            latency = (datetime.now() - start_time).total_seconds()
            execution = PromptExecution(
                prompt_name=template_name,
                timestamp=start_time,
                variables=variables,
                latency=latency,
                success=True,
                model_config=template.model_config
            )

            if track_metrics:
                self._record_execution(execution)

                # Also track in monitoring service if available
                try:
                    from src.core.monitoring import get_monitoring_service
                    monitoring_service = get_monitoring_service()
                    await monitoring_service.track_prompt_usage(
                        template_name=template_name,
                        latency=latency,
                        success=True
                    )
                except ImportError:
                    pass  # Monitoring service not available

            return {
                'system_prompt': rendered['system_prompt'],
                'user_prompt': rendered['user_prompt'],
                'model_config': rendered['model_config'],
                'template_name': template_name,
                'execution_id': id(execution),
                'timestamp': start_time.isoformat()
            }

        except Exception as e:
            # Record failed execution
            execution = PromptExecution(
                prompt_name=template_name,
                timestamp=start_time,
                variables=variables,
                latency=(datetime.now() - start_time).total_seconds(),
                success=False,
                error=str(e)
            )

            if track_metrics:
                self._record_execution(execution)

            logger.error(f"Failed to render prompt '{template_name}': {e}")
            raise

    def _record_execution(self, execution: PromptExecution):
        """Record prompt execution for metrics tracking"""
        self.execution_history.append(execution)

        # Update metrics
        metrics = self.metrics.get(execution.prompt_name)
        if metrics:
            metrics.execution_count += 1
            metrics.last_used = execution.timestamp

            if execution.latency:
                metrics.total_latency += execution.latency
                metrics.average_latency = metrics.total_latency / metrics.execution_count

            if execution.tokens_used:
                metrics.total_tokens += execution.tokens_used

            if execution.success:
                metrics.success_count += 1
            else:
                metrics.error_count += 1

            metrics.success_rate = metrics.success_count / metrics.execution_count

    def update_execution_metrics(
        self,
        execution_id: int,
        tokens_used: int = None,
        success: bool = None
    ):
        """Update execution metrics after LLM call completion"""
        # Find execution by ID
        execution = None
        for exec_record in reversed(self.execution_history):
            if id(exec_record) == execution_id:
                execution = exec_record
                break

        if execution:
            if tokens_used is not None:
                execution.tokens_used = tokens_used
                metrics = self.metrics.get(execution.prompt_name)
                if metrics:
                    metrics.total_tokens += tokens_used

            if success is not None:
                execution.success = success

    def get_metrics(self, template_name: str = None) -> Union[PromptMetrics, Dict[str, PromptMetrics]]:
        """Get metrics for a specific template or all templates"""
        if template_name:
            return self.metrics.get(template_name)
        return self.metrics.copy()

    def get_execution_history(
        self,
        template_name: str = None,
        limit: int = 100
    ) -> List[PromptExecution]:
        """Get execution history with optional filtering"""
        history = self.execution_history

        if template_name:
            history = [
                exec for exec in history if exec.prompt_name == template_name]

        return history[-limit:] if limit else history

    def export_metrics(self) -> Dict[str, Any]:
        """Export metrics and execution history for analysis"""
        return {
            'metrics': {
                name: {
                    'prompt_name': metrics.prompt_name,
                    'execution_count': metrics.execution_count,
                    'total_tokens': metrics.total_tokens,
                    'average_latency': metrics.average_latency,
                    'success_rate': metrics.success_rate,
                    'last_used': metrics.last_used.isoformat() if metrics.last_used else None
                }
                for name, metrics in self.metrics.items()
            },
            'execution_summary': {
                'total_executions': len(self.execution_history),
                'successful_executions': sum(1 for exec in self.execution_history if exec.success),
                'failed_executions': sum(1 for exec in self.execution_history if not exec.success),
                'total_tokens': sum(exec.tokens_used or 0 for exec in self.execution_history),
                'average_latency': sum(exec.latency or 0 for exec in self.execution_history) / max(len(self.execution_history), 1)
            }
        }


# Global prompt manager instance
_prompt_manager: Optional[PromptManager] = None


def get_prompt_manager() -> PromptManager:
    """Get the global prompt manager instance"""
    global _prompt_manager
    if _prompt_manager is None:
        _prompt_manager = PromptManager()
    return _prompt_manager


def initialize_prompt_manager(prompts_dir: str = None) -> PromptManager:
    """Initialize the global prompt manager with custom directory"""
    global _prompt_manager
    _prompt_manager = PromptManager(prompts_dir)
    return _prompt_manager
