"""
LangGraph Slide Generation Workflow

Comprehensive workflow for slide generation that orchestrates content planning,
research integration, file processing, and HTML generation with proper state management.
"""

from typing import TypedDict, List, Dict, Any, Optional, Callable
import asyncio
import logging
from datetime import datetime
import json

try:
    from langgraph.graph import StateGraph, END
    from langgraph.prebuilt import ToolExecutor
    LANGGRAPH_AVAILABLE = True
except ImportError:
    LANGGRAPH_AVAILABLE = False
    # Fallback for when LangGraph is not available

    class StateGraph:
        def __init__(self, state_type):
            self.state_type = state_type
            self.nodes = {}
            self.edges = []

        def add_node(self, name, func):
            self.nodes[name] = func

        def add_conditional_edges(self, source, condition, mapping):
            self.edges.append(("conditional", source, condition, mapping))

        def add_edge(self, source, target):
            self.edges.append(("direct", source, target))

        async def ainvoke(self, state):
            # Simple sequential execution for fallback
            current_state = state
            for node_name in ["content_planner", "file_processor", "research_integrator", "slide_generator"]:
                if node_name in self.nodes:
                    current_state = await self.nodes[node_name](current_state)
            return current_state

    END = "END"

from src.core.prompt_manager import get_prompt_manager
from src.core.monitoring import get_monitoring_service
from src.services.llm_service import LLMService
from src.services.file_service import FileService

logger = logging.getLogger(__name__)


class SlideGenerationState(TypedDict):
    """State for the slide generation workflow"""
    # Input parameters
    client_id: str
    description: str
    theme: str
    color_palette: Optional[List[str]]
    user_feedback: Optional[str]

    # File processing
    uploaded_files: Optional[List[Dict[str, Any]]]
    processed_files: Optional[List[Dict[str, Any]]]
    file_content_summary: Optional[str]

    # Research data
    research_data: Optional[str]
    research_enabled: bool

    # Content planning
    content_plan: Optional[Dict[str, Any]]
    content_plan_json: Optional[str]

    # Generation results
    slide_html: Optional[str]
    generation_metadata: Optional[Dict[str, Any]]

    # Workflow state
    current_step: str
    completed_steps: List[str]
    errors: List[str]
    warnings: List[str]

    # Progress tracking
    progress_callback: Optional[Callable]
    start_time: datetime
    step_timings: Dict[str, float]

    # Quality metrics
    quality_score: Optional[float]
    validation_results: Optional[Dict[str, Any]]


class SlideGenerationWorkflow:
    """
    Comprehensive slide generation workflow using LangGraph for orchestration.
    Handles content planning, file processing, research integration, and HTML generation.
    """

    def __init__(self, websocket_manager=None, file_service: FileService = None):
        self.websocket_manager = websocket_manager
        self.file_service = file_service or FileService()
        self.llm_service = LLMService()
        self.prompt_manager = get_prompt_manager()
        self.monitoring_service = get_monitoring_service()
        self.workflow = self._create_workflow()

    def _create_workflow(self):
        """Create the LangGraph workflow for slide generation"""
        if LANGGRAPH_AVAILABLE:
            workflow = StateGraph(SlideGenerationState)

            # Add nodes for each step
            workflow.add_node("content_planner", self._plan_content)
            workflow.add_node("file_processor", self._process_files)
            workflow.add_node("research_integrator", self._integrate_research)
            workflow.add_node("slide_generator", self._generate_slide)
            workflow.add_node("quality_validator", self._validate_quality)

            # Add conditional routing
            workflow.add_conditional_edges(
                "__start__",
                self._route_initial,
                {
                    "content_planning": "content_planner",
                    "file_processing": "file_processor",
                    "research_integration": "research_integrator",
                    "slide_generation": "slide_generator"
                }
            )

            workflow.add_conditional_edges(
                "content_planner",
                self._route_after_planning,
                {
                    "file_processing": "file_processor",
                    "research_integration": "research_integrator",
                    "slide_generation": "slide_generator"
                }
            )

            workflow.add_conditional_edges(
                "file_processor",
                self._route_after_files,
                {
                    "research_integration": "research_integrator",
                    "slide_generation": "slide_generator"
                }
            )

            workflow.add_conditional_edges(
                "research_integrator",
                self._route_after_research,
                {
                    "slide_generation": "slide_generator"
                }
            )

            workflow.add_edge("slide_generator", "quality_validator")
            workflow.add_edge("quality_validator", "__end__")

            return workflow.compile()
        else:
            # Return our fallback implementation
            return StateGraph(SlideGenerationState)

    async def generate_slide(
        self,
        client_id: str,
        description: str,
        theme: str = "Professional",
        color_palette: Optional[List[str]] = None,
        user_feedback: Optional[str] = None,
        research_data: Optional[str] = None,
        research_enabled: bool = False,
        progress_callback: Optional[Callable] = None
    ) -> Dict[str, Any]:
        """
        Main entry point for slide generation workflow

        Args:
            client_id: Unique identifier for the client
            description: User's description of the slide content
            theme: Visual theme for the slide
            color_palette: Optional color palette
            user_feedback: Additional user requirements
            research_data: Pre-gathered research data
            research_enabled: Whether to enable research integration
            progress_callback: Optional callback for progress updates

        Returns:
            Dict containing the generated slide and metadata
        """
        start_time = datetime.now()

        # Initialize workflow state
        initial_state = SlideGenerationState(
            client_id=client_id,
            description=description,
            theme=theme,
            color_palette=color_palette,
            user_feedback=user_feedback,
            research_data=research_data,
            research_enabled=research_enabled,
            uploaded_files=None,
            processed_files=None,
            file_content_summary=None,
            content_plan=None,
            content_plan_json=None,
            slide_html=None,
            generation_metadata=None,
            current_step="initialization",
            completed_steps=[],
            errors=[],
            warnings=[],
            progress_callback=progress_callback,
            start_time=start_time,
            step_timings={},
            quality_score=None,
            validation_results=None
        )

        # Create monitoring context
        execution_id = f"slide_gen_{client_id}_{int(start_time.timestamp())}"

        try:
            # Start monitoring
            await self.monitoring_service.start_workflow_execution(
                "slide_generation",
                execution_id,
                {"client_id": client_id, "theme": theme,
                    "has_research": bool(research_data)}
            )

            # Load uploaded files if available
            if self.file_service:
                uploaded_files = await self._load_client_files(client_id)
                initial_state["uploaded_files"] = uploaded_files

            # Send initial progress update
            await self._update_progress(initial_state, "Initializing slide generation workflow...", 5)

            # Execute the workflow
            logger.info(
                f"Starting slide generation workflow for client {client_id}")
            final_state = await self.workflow.ainvoke(initial_state)

            # Calculate total execution time
            total_time = (datetime.now() - start_time).total_seconds()

            # Prepare response
            response = {
                "success": len(final_state["errors"]) == 0,
                "slide_html": final_state.get("slide_html"),
                "content_plan": final_state.get("content_plan"),
                "generation_metadata": {
                    "client_id": client_id,
                    "theme": theme,
                    "total_execution_time": total_time,
                    "completed_steps": final_state["completed_steps"],
                    "step_timings": final_state["step_timings"],
                    "quality_score": final_state.get("quality_score"),
                    "files_processed": len(final_state.get("processed_files", [])),
                    "research_integrated": bool(final_state.get("research_data")),
                    "warnings": final_state["warnings"]
                }
            }

            # End monitoring
            success = len(final_state["errors"]) == 0
            await self.monitoring_service.end_workflow_execution(
                "slide_generation",
                execution_id,
                success=success,
                error=final_state["errors"][0] if final_state["errors"] else None,
                step_timings=final_state["step_timings"]
            )

            if final_state["errors"]:
                response["errors"] = final_state["errors"]
                logger.error(
                    f"Slide generation completed with errors: {final_state['errors']}")
            else:
                logger.info(
                    f"Slide generation completed successfully in {total_time:.2f}s")

            return response

        except Exception as e:
            # End monitoring with error
            await self.monitoring_service.end_workflow_execution(
                "slide_generation",
                execution_id,
                success=False,
                error=str(e)
            )

            logger.error(f"Slide generation workflow failed: {e}")
            return {
                "success": False,
                "error": str(e),
                "generation_metadata": {
                    "client_id": client_id,
                    "total_execution_time": (datetime.now() - start_time).total_seconds(),
                    "failed_at": initial_state.get("current_step", "initialization")
                }
            }

    async def _route_initial(self, state: SlideGenerationState) -> str:
        """Route to the appropriate initial step based on available data"""
        if state.get("uploaded_files") and len(state["uploaded_files"]) > 0:
            return "file_processing"
        elif state.get("research_enabled") and not state.get("research_data"):
            return "research_integration"
        else:
            return "content_planning"

    async def _route_after_planning(self, state: SlideGenerationState) -> str:
        """Route after content planning step"""
        if state.get("uploaded_files") and len(state["uploaded_files"]) > 0:
            return "file_processing"
        elif state.get("research_enabled") and not state.get("research_data"):
            return "research_integration"
        else:
            return "slide_generation"

    async def _route_after_files(self, state: SlideGenerationState) -> str:
        """Route after file processing step"""
        if state.get("research_enabled") and not state.get("research_data"):
            return "research_integration"
        else:
            return "slide_generation"

    async def _route_after_research(self, state: SlideGenerationState) -> str:
        """Route after research integration step"""
        return "slide_generation"

    async def _plan_content(self, state: SlideGenerationState) -> SlideGenerationState:
        """Content planning step using structured prompts"""
        step_start = datetime.now()
        state["current_step"] = "content_planning"

        try:
            await self._update_progress(state, "Planning slide content structure...", 20)

            # Prepare variables for content planning template
            template_variables = {
                "description": state["description"],
                "theme": state["theme"],
                "research_data": state.get("research_data"),
                "uploaded_files": state.get("processed_files", []),
                "user_feedback": state.get("user_feedback")
            }

            # Render content planning prompt
            prompt_data = await self.prompt_manager.render_prompt(
                "content_planning",
                template_variables
            )

            # Generate content plan using LLM
            if self.llm_service.is_available():
                response = await self.llm_service.generate_completion(
                    system_prompt=prompt_data["system_prompt"],
                    user_prompt=prompt_data["user_prompt"],
                    **prompt_data["model_config"]
                )

                # Parse JSON response
                try:
                    content_plan = json.loads(response)
                    state["content_plan"] = content_plan
                    state["content_plan_json"] = response
                    logger.info("Content plan generated successfully")
                except json.JSONDecodeError as e:
                    logger.warning(f"Failed to parse content plan JSON: {e}")
                    state["warnings"].append(
                        f"Content plan parsing failed: {e}")
                    # Use raw response as fallback
                    state["content_plan_json"] = response
            else:
                state["warnings"].append(
                    "LLM service not available, skipping content planning")

            state["completed_steps"].append("content_planning")

        except Exception as e:
            logger.error(f"Content planning failed: {e}")
            state["errors"].append(f"Content planning error: {e}")

        finally:
            state["step_timings"]["content_planning"] = (
                datetime.now() - step_start).total_seconds()

        return state

    async def _process_files(self, state: SlideGenerationState) -> SlideGenerationState:
        """File processing step to extract and summarize content"""
        step_start = datetime.now()
        state["current_step"] = "file_processing"

        try:
            await self._update_progress(state, "Processing uploaded files...", 40)

            uploaded_files = state.get("uploaded_files", [])
            if not uploaded_files:
                state["completed_steps"].append("file_processing")
                return state

            processed_files = []
            content_parts = []

            for file_info in uploaded_files:
                try:
                    # Extract content from file
                    content = await self.file_service.extract_content_from_file(file_info.get("file_path", ""))

                    if content:
                        processed_file = {
                            "filename": file_info.get("filename", "unknown"),
                            # Limit content length
                            "content": content.get("text", "")[:2000],
                            "images": content.get("images", []),
                            "metadata": content.get("metadata", {})
                        }
                        processed_files.append(processed_file)

                        # Add to content summary
                        content_parts.append(
                            f"File: {processed_file['filename']}\nContent: {processed_file['content'][:500]}...")

                except Exception as e:
                    logger.warning(f"Failed to process file {file_info}: {e}")
                    state["warnings"].append(f"File processing warning: {e}")

            state["processed_files"] = processed_files
            state["file_content_summary"] = "\n\n".join(content_parts)

            logger.info(f"Processed {len(processed_files)} files successfully")
            state["completed_steps"].append("file_processing")

        except Exception as e:
            logger.error(f"File processing failed: {e}")
            state["errors"].append(f"File processing error: {e}")

        finally:
            state["step_timings"]["file_processing"] = (
                datetime.now() - step_start).total_seconds()

        return state

    async def _integrate_research(self, state: SlideGenerationState) -> SlideGenerationState:
        """Research integration step (placeholder for future research agent integration)"""
        step_start = datetime.now()
        state["current_step"] = "research_integration"

        try:
            await self._update_progress(state, "Integrating research data...", 60)

            # If research data is already provided, use it
            if state.get("research_data"):
                logger.info("Using provided research data")
            elif state.get("research_enabled"):
                # Future: Integrate with research agents
                logger.info(
                    "Research integration enabled but no research agents available yet")
                state["warnings"].append(
                    "Research integration requested but not yet implemented")

            state["completed_steps"].append("research_integration")

        except Exception as e:
            logger.error(f"Research integration failed: {e}")
            state["errors"].append(f"Research integration error: {e}")

        finally:
            state["step_timings"]["research_integration"] = (
                datetime.now() - step_start).total_seconds()

        return state

    async def _generate_slide(self, state: SlideGenerationState) -> SlideGenerationState:
        """Main slide generation step using structured prompts"""
        step_start = datetime.now()
        state["current_step"] = "slide_generation"

        try:
            await self._update_progress(state, "Generating slide HTML...", 80)

            # Prepare variables for slide generation template
            template_variables = {
                "description": state["description"],
                "theme": state["theme"],
                "color_palette": state.get("color_palette"),
                "content_plan": state.get("content_plan_json"),
                "research_data": state.get("research_data"),
                "user_feedback": state.get("user_feedback"),
                "uploaded_files": state.get("processed_files", [])
            }

            # Render slide generation prompt
            prompt_data = await self.prompt_manager.render_prompt(
                "slide_html_generation",
                template_variables
            )

            # Generate slide HTML using LLM
            if self.llm_service.is_available():
                slide_html = await self.llm_service.generate_completion(
                    system_prompt=prompt_data["system_prompt"],
                    user_prompt=prompt_data["user_prompt"],
                    **prompt_data["model_config"]
                )

                # Clean up the HTML response
                slide_html = self._clean_html_response(slide_html)
                state["slide_html"] = slide_html

                logger.info("Slide HTML generated successfully")
            else:
                raise Exception(
                    "LLM service not available for slide generation")

            state["completed_steps"].append("slide_generation")

        except Exception as e:
            logger.error(f"Slide generation failed: {e}")
            state["errors"].append(f"Slide generation error: {e}")

        finally:
            state["step_timings"]["slide_generation"] = (
                datetime.now() - step_start).total_seconds()

        return state

    async def _validate_quality(self, state: SlideGenerationState) -> SlideGenerationState:
        """Quality validation step"""
        step_start = datetime.now()
        state["current_step"] = "quality_validation"

        try:
            await self._update_progress(state, "Validating slide quality...", 95)

            # Basic HTML validation
            slide_html = state.get("slide_html", "")
            quality_score = 0.0
            validation_results = {
                "has_html": bool(slide_html and "<html>" in slide_html),
                "has_css": bool(slide_html and "<style>" in slide_html),
                "has_content": bool(slide_html and len(slide_html.strip()) > 100),
                "has_scoped_styles": bool(slide_html and ".slide-main" in slide_html),
                "estimated_length": len(slide_html) if slide_html else 0
            }

            # Calculate quality score
            if validation_results["has_html"]:
                quality_score += 0.3
            if validation_results["has_css"]:
                quality_score += 0.2
            if validation_results["has_content"]:
                quality_score += 0.3
            if validation_results["has_scoped_styles"]:
                quality_score += 0.2

            state["quality_score"] = quality_score
            state["validation_results"] = validation_results

            logger.info(
                f"Quality validation completed with score: {quality_score:.2f}")
            state["completed_steps"].append("quality_validation")

        except Exception as e:
            logger.error(f"Quality validation failed: {e}")
            state["errors"].append(f"Quality validation error: {e}")

        finally:
            state["step_timings"]["quality_validation"] = (
                datetime.now() - step_start).total_seconds()

        return state

    async def _load_client_files(self, client_id: str) -> List[Dict[str, Any]]:
        """Load uploaded files for a client"""
        try:
            if self.file_service:
                files = await self.file_service.get_client_files(client_id)
                return [file.model_dump() if hasattr(file, 'model_dump') else file for file in files]
        except Exception as e:
            logger.warning(f"Failed to load client files: {e}")
        return []

    def _clean_html_response(self, html_content: str) -> str:
        """Clean up HTML response from LLM"""
        if not html_content:
            return ""

        # Remove markdown code blocks
        if html_content.startswith("```html"):
            html_content = html_content[7:]
        if html_content.startswith("```"):
            html_content = html_content[3:]
        if html_content.endswith("```"):
            html_content = html_content[:-3]

        return html_content.strip()

    async def _update_progress(self, state: SlideGenerationState, message: str, progress: int):
        """Send progress update if callback is available"""
        callback = state.get("progress_callback")
        if callback:
            try:
                await callback({
                    "step": state["current_step"],
                    "message": message,
                    "progress": progress,
                    "client_id": state["client_id"]
                })
            except Exception as e:
                logger.warning(f"Progress callback failed: {e}")


# Global workflow instance
_slide_workflow: Optional[SlideGenerationWorkflow] = None


def get_slide_workflow(websocket_manager=None, file_service=None) -> SlideGenerationWorkflow:
    """Get the global slide generation workflow instance"""
    global _slide_workflow
    if _slide_workflow is None:
        _slide_workflow = SlideGenerationWorkflow(
            websocket_manager, file_service)
    return _slide_workflow
