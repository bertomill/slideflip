"""
Service Orchestrator

Manages the proper flow between all backend services with clear separation of concerns.
This orchestrator ensures services interact in a meaningful, purposeful way.
"""

import logging
from typing import Dict, Any, Optional, List, Callable
from datetime import datetime
import asyncio

from src.services.file_service import FileService
from src.services.llm_service import LLMService
from src.services.ai_service import AIService
from src.agents.content_creator_agent import ContentCreatorAgent
from src.agents.web_research_agent import WebResearchAgent
from src.services.slide_service import SlideService
from src.services.theme_service import ThemeService
from src.core.config import Settings

logger = logging.getLogger(__name__)


class ServiceOrchestrator:
    """
    Orchestrates the flow between all backend services
    
    Flow Architecture:
    1. File Processing: FileService handles uploads and content extraction
    2. Content Planning: LLMService or ContentCreatorAgent creates content plans
    3. Research Enhancement: WebResearchAgent (optional) enhances content with external data
    4. Content Generation: ContentCreatorAgent generates detailed slide content using LangGraph
    5. Theme Application: ThemeService applies styling and visual design
    6. Slide Generation: SlideService creates final HTML/PowerPoint output
    """
    
    def __init__(self):
        self.settings = Settings()
        
        # Initialize services in dependency order
        self.file_service = FileService()
        self.llm_service = LLMService()
        self.ai_service = AIService()
        self.content_creator_agent = ContentCreatorAgent()
        self.web_research_agent = None  # Initialize on demand
        self.slide_service = SlideService()
        self.theme_service = ThemeService()
        
        logger.info("ServiceOrchestrator initialized with all services")
    
    def _init_web_research_agent(self):
        """Initialize web research agent on demand"""
        if self.web_research_agent is None:
            try:
                self.web_research_agent = WebResearchAgent()
                logger.info("WebResearchAgent initialized")
            except Exception as e:
                logger.warning(f"WebResearchAgent initialization failed: {e}")
                self.web_research_agent = None
        return self.web_research_agent
    
    async def process_complete_workflow(
        self,
        client_id: str,
        user_description: str,
        theme_selection: Dict[str, Any],
        options: Dict[str, Any] = None,
        progress_callback: Optional[Callable] = None
    ) -> Dict[str, Any]:
        """
        Execute the complete slide generation workflow
        
        Args:
            client_id: Unique client identifier
            user_description: User's description of desired presentation
            theme_selection: Selected theme and styling options
            options: Additional options (research_enabled, content_style, etc.)
            progress_callback: Optional callback for progress updates
        
        Returns:
            Dict containing the complete workflow results
        """
        start_time = datetime.now()
        options = options or {}
        
        try:
            logger.info(f"🚀 Starting complete workflow for client {client_id}")
            
            # Step 1: Process uploaded files
            if progress_callback:
                await progress_callback("Processing uploaded files...", 10)
            
            uploaded_files = await self._process_uploaded_files(client_id)
            if not uploaded_files:
                raise ValueError("No uploaded files found for processing")
            
            # Step 2: Create content plan
            if progress_callback:
                await progress_callback("Creating content plan...", 25)
            
            research_data = None
            if options.get("research_enabled", False):
                research_data = await self._perform_research(user_description, uploaded_files)
            
            content_plan = await self._create_content_plan(
                user_description=user_description,
                uploaded_files=uploaded_files,
                research_data=research_data,
                options=options
            )
            
            # Step 3: Generate detailed content using ContentCreatorAgent
            if progress_callback:
                await progress_callback("Generating detailed content...", 50)
            
            detailed_content = await self._generate_detailed_content(
                content_plan=content_plan,
                uploaded_files=uploaded_files,
                user_description=user_description,
                research_data=research_data,
                options=options
            )
            
            # Step 4: Apply theme and styling
            if progress_callback:
                await progress_callback("Applying theme and styling...", 70)
            
            styled_content = await self._apply_theme_and_styling(
                content=detailed_content,
                theme_selection=theme_selection
            )
            
            # Step 5: Generate final slides
            if progress_callback:
                await progress_callback("Generating final slides...", 90)
            
            final_slides = await self._generate_final_slides(
                content=styled_content,
                theme_selection=theme_selection,
                client_id=client_id
            )
            
            if progress_callback:
                await progress_callback("Workflow completed!", 100)
            
            # Compile results
            workflow_result = {
                "success": True,
                "client_id": client_id,
                "content_plan": content_plan,
                "detailed_content": detailed_content,
                "final_slides": final_slides,
                "metadata": {
                    "processing_time": (datetime.now() - start_time).total_seconds(),
                    "uploaded_files_count": len(uploaded_files),
                    "research_enabled": options.get("research_enabled", False),
                    "theme_applied": theme_selection.get("theme_name", "default"),
                    "workflow_steps": [
                        "file_processing",
                        "content_planning", 
                        "research_enhancement" if research_data else None,
                        "content_generation",
                        "theme_application",
                        "slide_generation"
                    ]
                }
            }
            
            logger.info(f"✅ Complete workflow finished in {workflow_result['metadata']['processing_time']:.2f}s")
            return workflow_result
            
        except Exception as e:
            logger.error(f"Error in complete workflow: {e}")
            return {
                "success": False,
                "error": str(e),
                "client_id": client_id,
                "processing_time": (datetime.now() - start_time).total_seconds()
            }
    
    async def _process_uploaded_files(self, client_id: str) -> List[Dict[str, Any]]:
        """Process uploaded files and extract content"""
        try:
            logger.info(f"📁 Processing uploaded files for client {client_id}")
            
            # Get client files
            client_files = await self.file_service.get_client_files(client_id)
            if not client_files:
                return []
            
            processed_files = []
            for file_info in client_files:
                try:
                    # Extract content from file
                    content_info = await self.file_service.extract_content_from_file(file_info.file_path)
                    if content_info and content_info.get('text'):
                        processed_files.append({
                            "filename": file_info.filename,
                            "content": content_info['text'],
                            "file_type": file_info.file_type,
                            "file_path": file_info.file_path,
                            "metadata": content_info.get('metadata', {})
                        })
                        logger.info(f"✅ Processed {file_info.filename}: {len(content_info['text'])} characters")
                except Exception as e:
                    logger.warning(f"Failed to process {file_info.filename}: {e}")
            
            return processed_files
            
        except Exception as e:
            logger.error(f"Error processing uploaded files: {e}")
            return []
    
    async def _perform_research(self, user_description: str, uploaded_files: List[Dict]) -> Optional[str]:
        """Perform web research to enhance content"""
        try:
            logger.info("🔍 Performing web research")
            
            research_agent = self._init_web_research_agent()
            if not research_agent:
                logger.warning("WebResearchAgent not available")
                return None
            
            # Extract key topics for research
            content_text = " ".join([f["content"] for f in uploaded_files])
            research_query = f"{user_description} {content_text[:200]}"
            
            research_result = await research_agent.search_and_compile(
                query=research_query,
                max_results=5
            )
            
            if research_result.get("success"):
                logger.info("✅ Research completed successfully")
                return research_result.get("compiled_report", "")
            else:
                logger.warning("Research failed or returned no results")
                return None
                
        except Exception as e:
            logger.error(f"Error in research: {e}")
            return None
    
    async def _create_content_plan(
        self,
        user_description: str,
        uploaded_files: List[Dict],
        research_data: Optional[str],
        options: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Create content plan using appropriate service"""
        try:
            logger.info("📝 Creating content plan")
            
            # Choose service based on options
            use_ai_agent = options.get("use_ai_agent", False)
            
            if use_ai_agent:
                # Use AI service for enhanced planning
                content_plan = await self.ai_service.generate_content_plan(
                    description=user_description,
                    research_data=research_data,
                    uploaded_files=uploaded_files,
                    theme_info=None  # Theme not used for content planning
                )
            else:
                # Use LLM service for standard planning
                content_plan = await self.llm_service.generate_content_plan(
                    description=user_description,
                    research_data=research_data,
                    uploaded_files=uploaded_files
                )
            
            logger.info("✅ Content plan created")
            return content_plan
            
        except Exception as e:
            logger.error(f"Error creating content plan: {e}")
            # Return basic fallback plan
            return {
                "content_plan": f"Basic content plan for: {user_description}",
                "slide_count": 3,
                "status": "fallback",
                "error": str(e)
            }
    
    async def _generate_detailed_content(
        self,
        content_plan: Dict[str, Any],
        uploaded_files: List[Dict],
        user_description: str,
        research_data: Optional[str],
        options: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Generate detailed content using ContentCreatorAgent with LangGraph"""
        try:
            logger.info("🤖 Generating detailed content with ContentCreatorAgent")
            
            # Combine uploaded content
            uploaded_content = "\n\n".join([
                f"--- {f['filename']} ---\n{f['content']}" 
                for f in uploaded_files
            ])
            
            # Use ContentCreatorAgent with LangGraph workflow
            detailed_content = await self.content_creator_agent.create_content(
                uploaded_content=uploaded_content,
                user_description=user_description,
                theme_info=None,  # Theme not used for content generation
                research_data=research_data,
                use_ai_agent=options.get("use_ai_agent", True),
                content_style=options.get("content_style", "professional")
            )
            
            logger.info("✅ Detailed content generated")
            return detailed_content
            
        except Exception as e:
            logger.error(f"Error generating detailed content: {e}")
            return {
                "error": str(e),
                "fallback_content": content_plan,
                "generation_mode": "error_fallback"
            }
    
    async def _apply_theme_and_styling(
        self,
        content: Dict[str, Any],
        theme_selection: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Apply theme and styling to content"""
        try:
            logger.info("🎨 Applying theme and styling")
            
            # Get theme configuration
            theme_config = await self.theme_service.get_theme_config(
                theme_selection.get("theme_name", "professional")
            )
            
            # Apply styling to content
            styled_content = {
                **content,
                "theme_config": theme_config,
                "color_palette": theme_selection.get("color_palette", []),
                "styling_applied": True
            }
            
            logger.info("✅ Theme and styling applied")
            return styled_content
            
        except Exception as e:
            logger.error(f"Error applying theme: {e}")
            # Return content with basic theme
            return {
                **content,
                "theme_config": {"name": "basic", "colors": ["#333", "#fff"]},
                "styling_applied": False,
                "styling_error": str(e)
            }
    
    async def _generate_final_slides(
        self,
        content: Dict[str, Any],
        theme_selection: Dict[str, Any],
        client_id: str
    ) -> Dict[str, Any]:
        """Generate final slide output"""
        try:
            logger.info("📊 Generating final slides")
            
            # Generate HTML slides
            slide_result = await self.slide_service.generate_slide(
                client_id=client_id,
                content=content,
                theme=theme_selection.get("theme_name", "professional"),
                output_format="html"
            )
            
            # Optionally generate PowerPoint
            try:
                ppt_result = await self.slide_service.generate_slide(
                    client_id=client_id,
                    content=content,
                    theme=theme_selection.get("theme_name", "professional"),
                    output_format="pptx"
                )
                slide_result["pptx_path"] = ppt_result.get("file_path")
            except Exception as e:
                logger.warning(f"PowerPoint generation failed: {e}")
                slide_result["pptx_error"] = str(e)
            
            logger.info("✅ Final slides generated")
            return slide_result
            
        except Exception as e:
            logger.error(f"Error generating final slides: {e}")
            return {
                "error": str(e),
                "html_content": "<html><body><h1>Slide generation failed</h1></body></html>"
            }
    
    async def get_service_status(self) -> Dict[str, Any]:
        """Get status of all services"""
        return {
            "orchestrator_status": "active",
            "services": {
                "file_service": {"available": True, "description": "Handles file uploads and content extraction"},
                "llm_service": {"available": self.llm_service.is_available(), "description": "Basic LLM operations and content planning"},
                "ai_service": {"available": self.ai_service.is_available(), "description": "Enhanced AI operations and content planning"},
                "content_creator_agent": {"available": bool(self.content_creator_agent.workflow), "description": "LangGraph-based content generation with agentic behavior"},
                "web_research_agent": {"available": bool(self._init_web_research_agent()), "description": "Web research and external data integration"},
                "slide_service": {"available": True, "description": "Final slide generation (HTML/PowerPoint)"},
                "theme_service": {"available": True, "description": "Theme and styling application"}
            },
            "workflow_capabilities": [
                "File processing and content extraction",
                "Intelligent content planning",
                "Optional web research integration", 
                "LangGraph-based content generation",
                "Theme and styling application",
                "Multi-format slide output (HTML/PowerPoint)"
            ]
        }
    
    async def clear_client_data(self, client_id: str) -> Dict[str, bool]:
        """Clear data for a specific client across all services"""
        results = {}
        
        try:
            results["file_service"] = await self.file_service.clear_client_data(client_id)
        except Exception as e:
            logger.error(f"Error clearing file service data: {e}")
            results["file_service"] = False
            
        try:
            results["ai_service"] = await self.ai_service.clear_client_data(client_id)
        except Exception as e:
            logger.error(f"Error clearing AI service data: {e}")
            results["ai_service"] = False
        
        try:
            results["slide_service"] = await self.slide_service.clear_client_data(client_id)
        except Exception as e:
            logger.error(f"Error clearing slide service data: {e}")
            results["slide_service"] = False
        
        logger.info(f"Client data cleared for {client_id}: {results}")
        return results


# Global orchestrator instance
_orchestrator = None

def get_service_orchestrator() -> ServiceOrchestrator:
    """Get the global service orchestrator instance"""
    global _orchestrator
    if _orchestrator is None:
        _orchestrator = ServiceOrchestrator()
    return _orchestrator