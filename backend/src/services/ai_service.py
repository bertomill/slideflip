"""
AI Service for OpenAI integration and AI-powered operations
Rewritten with proper content planning and content-focused generation
"""

import logging
import asyncio
from typing import Dict, Any, Optional, List, Callable
from src.core.config import Settings
from src.core.prompt_manager import get_prompt_manager
from src.services.file_service import FileService
from src.services.llm_service import LLMService

logger = logging.getLogger(__name__)


class AIService:
    """
    Enhanced AI service with proper content planning and content-focused generation.
    Provides scalable, monitored AI operations with clear separation of concerns.
    """

    def __init__(self, websocket_manager=None):
        self.settings = Settings()
        self.prompt_manager = get_prompt_manager()
        self.file_service = FileService()
        self.llm_service = LLMService()
        self.websocket_manager = websocket_manager
        logger.info(
            "AIService initialized with content-focused generation support")

    def is_available(self) -> bool:
        """Check if AI service is available"""
        # Check if prompt templates are loaded
        templates_available = len(self.prompt_manager.templates) > 0

        # Check if LLM service is available
        llm_available = self.llm_service.is_available()

        return templates_available and llm_available

    async def generate_content_plan(
        self,
        description: str,
        research_data: Optional[str] = None,
        theme: str = "default",
        uploaded_files: Optional[List[Dict]] = None,
        theme_info: Optional[Dict] = None
    ) -> Dict[str, Any]:
        """
        Generate content plan using AI
        Content plan is based ONLY on uploaded files and user description
        Theme is used only for styling suggestions, not content generation

        Args:
            description: User's slide description
            research_data: Optional research data
            theme: Theme name (used only for styling suggestions)
            uploaded_files: List of uploaded files with content
            theme_info: Theme information (used only for styling suggestions)

        Returns:
            Dict containing content plan and metadata
        """
        if not self.is_available():
            raise Exception(
                "AI service not available - missing templates or LLM service")

        try:
            logger.info("Generating content plan using structured prompts...")

            # Use LLM service for content planning
            content_plan = await self.llm_service.generate_content_plan(
                description=description,
                research_data=research_data,
                theme=theme,
                uploaded_files=uploaded_files,
                theme_info=theme_info  # For styling suggestions only
            )

            if not content_plan:
                raise Exception("Failed to generate content plan")

            # Validate content plan structure
            if "error" in content_plan:
                raise Exception(
                    f"Content plan generation failed: {content_plan['error']}")

            # Extract key information for response
            result = {
                "content_plan": content_plan,
                "suggestions": content_plan.get("key_messages", []),
                "estimated_slide_count": len(content_plan.get("main_sections", [])),
                "status": "success"
            }

            logger.info(
                f"Content plan generated successfully with {result['estimated_slide_count']} sections")
            return result

        except Exception as e:
            logger.error(f"Error generating content plan: {e}")
            raise

    async def generate_slide_html(
        self,
        client_id: str,
        description: str,
        theme: str = "Professional",
        research_data: Optional[str] = None,
        content_plan: Optional[str] = None,
        user_feedback: Optional[str] = None,
        color_palette: Optional[List[str]] = None,
        research_enabled: bool = False,
        progress_callback: Optional[Callable] = None
    ) -> Dict[str, Any]:
        """
        Generate slide HTML using the comprehensive AI workflow
        Content generation is based on uploaded files and user description
        Theme is used only for styling, not content

        Args:
            client_id: Unique identifier for the client
            description: User's slide description
            theme: Selected theme name
            research_data: Research results from research agents
            content_plan: AI-generated content plan
            user_feedback: User's additional requirements
            color_palette: Theme color palette
            research_enabled: Whether to enable research integration
            progress_callback: Optional callback for progress updates

        Returns:
            Dict containing generated HTML and metadata
        """
        if not self.is_available():
            raise Exception(
                "AI service not available - missing templates or LLM service")

        try:
            logger.info(f"Starting slide generation for client {client_id}")

            # Get uploaded files content for the client
            uploaded_files = await self._get_client_uploaded_files(client_id)
            if not uploaded_files:
                raise Exception("No uploaded files found for slide generation")

            if progress_callback:
                await progress_callback("Analyzing uploaded content...", 20)

            # Combine content from all uploaded files
            combined_content = self._combine_file_content(uploaded_files)
            if not combined_content.strip():
                raise Exception(
                    "No usable content extracted from uploaded files")

            if progress_callback:
                await progress_callback("Generating slide layout...", 40)

            # Generate slide layout using AI (content-based, not theme-based)
            layout = await self.llm_service.generate_slide_layout(
                content=combined_content,
                description=description,
                theme="default",  # Don't pass theme to content generation
                has_images=False,
                theme_info=None  # Don't pass theme info to content generation
            )

            if progress_callback:
                await progress_callback("Generating slide content...", 60)

            # Generate slide content using AI (content-based, not theme-based)
            content = await self.llm_service.generate_slide_content(
                content=combined_content,
                description=description,
                layout=layout,
                theme_info=None  # Don't pass theme info to content generation
            )

            if progress_callback:
                await progress_callback("Generating HTML preview...", 80)

            # Generate HTML using AI with theme styling applied separately
            html_content = await self.llm_service.generate_slide_html(
                layout=layout,
                content=content,
                theme=theme,
                wants_research=research_enabled,
                theme_info={
                    "color_palette": color_palette} if color_palette else None
            )

            if progress_callback:
                await progress_callback("Slide generation completed!", 100)

            result = {
                "html_content": html_content,
                "content_plan": content_plan,
                "generation_metadata": {
                    "layout_sections": len(layout.get("sections", [])),
                    "content_sections": len([k for k in content.keys() if k.startswith("section_")]),
                    "theme_applied": theme,
                    "research_enabled": research_enabled
                },
                "success": True
            }

            logger.info("Slide generation completed successfully")
            return result

        except Exception as e:
            logger.error(f"Error in slide generation: {e}")
            return {
                "success": False,
                "errors": [str(e)],
                "html_content": None
            }

    async def refine_content_plan(
        self,
        content_plan: str,
        user_feedback: str,
        original_description: str = ""
    ) -> Dict[str, Any]:
        """
        Refine content plan based on user feedback
        Content refinement is based on uploaded files and user feedback
        Theme is used only for styling suggestions

        Args:
            content_plan: Current content plan
            user_feedback: User's feedback for refinement
            original_description: Original user description

        Returns:
            Dict containing refined content plan
        """
        if not self.is_available():
            raise Exception(
                "AI service not available - missing templates or LLM service")

        try:
            logger.info("Refining content plan based on user feedback...")

            # Create refinement prompt
            refinement_prompt = f"""
            REFINE CONTENT PLAN:
            
            Current Content Plan:
            {content_plan}
            
            User Feedback:
            {user_feedback}
            
            Original Description:
            {original_description}
            
            TASK: Refine the content plan based on user feedback while maintaining focus on the uploaded content and user's original description. Do not use theme information to generate content - only use it for styling suggestions.
            
            Return the refined content plan in the same JSON format.
            """

            # Use LLM service for refinement
            response = await self.llm_service.client.chat.completions.create(
                model="gpt-4",
                messages=[
                    {"role": "system", "content": "You are an expert content planner. Refine content plans based on user feedback while maintaining focus on uploaded content."},
                    {"role": "user", "content": refinement_prompt}
                ],
                max_tokens=2000,
                temperature=0.7
            )

            refined_plan_text = response.choices[0].message.content.strip()

            # Clean up markdown code blocks if present
            if refined_plan_text.startswith("```json"):
                refined_plan_text = refined_plan_text[7:]
            elif refined_plan_text.startswith("```"):
                refined_plan_text = refined_plan_text[3:]
            if refined_plan_text.endswith("```"):
                refined_plan_text = refined_plan_text[:-3]

            # Parse refined plan
            try:
                refined_plan = json.loads(refined_plan_text.strip())
                logger.info("Content plan refined successfully")
                return refined_plan
            except json.JSONDecodeError as e:
                logger.warning(f"Failed to parse refined content plan: {e}")
                # Return original plan if parsing fails
                return {"error": "Failed to parse refined plan", "original_plan": content_plan}

        except Exception as e:
            logger.error(f"Error refining content plan: {e}")
            raise

    async def _get_client_uploaded_files(self, client_id: str) -> List[Dict]:
        """Get uploaded files content for a client"""
        try:
            # Get client files from file service
            client_files = await self.file_service.get_client_files(client_id)
            if not client_files:
                return []

            # Extract content from each file
            uploaded_files = []
            for file_info in client_files:
                try:
                    content_info = await self.file_service.extract_content_from_file(file_info.file_path)
                    content = content_info.get(
                        'text', '') if content_info else ''
                    if content:
                        uploaded_files.append({
                            "filename": file_info.filename,
                            "content": content,
                            "file_type": file_info.file_type,
                            "file_path": file_info.file_path
                        })
                except Exception as e:
                    logger.warning(
                        f"Failed to extract content from {file_info.filename}: {e}")

            return uploaded_files

        except Exception as e:
            logger.error(f"Error getting client uploaded files: {e}")
            return []

    def _combine_file_content(self, uploaded_files: List[Dict]) -> str:
        """Combine content from all uploaded files"""
        try:
            combined_content = []
            for file_info in uploaded_files:
                filename = file_info.get("filename", "unknown")
                content = file_info.get("content", "")
                if content:
                    combined_content.append(f"--- {filename} ---\n{content}\n")

            return "\n".join(combined_content)

        except Exception as e:
            logger.error(f"Error combining file content: {e}")
            return ""

    async def generate_research_insights(
        self,
        content: str,
        description: str,
        research_queries: Optional[List[str]] = None
    ) -> Dict[str, Any]:
        """
        Generate research insights based on content and description
        Research is focused on content analysis, not theme information

        Args:
            content: Content from uploaded files
            description: User's description
            research_queries: Optional specific research queries

        Returns:
            Dict containing research insights
        """
        if not self.is_available():
            raise Exception(
                "AI service not available - missing templates or LLM service")

        try:
            logger.info("Generating research insights...")

            # Create research prompt
            research_prompt = f"""
            RESEARCH ANALYSIS:
            
            Content to Analyze:
            {content[:2000]}...
            
            User Description:
            {description}
            
            TASK: Analyze the content and provide research insights that would enhance the presentation. Focus on:
            1. Key themes and patterns in the content
            2. Potential research areas that would complement the content
            3. Data points or statistics that could strengthen the presentation
            4. Related topics for further exploration
            
            Do not use theme information to generate research insights - focus only on content analysis.
            
            Return insights in a structured format.
            """

            # Use LLM service for research insights
            response = await self.llm_service.client.chat.completions.create(
                model="gpt-4",
                messages=[
                    {"role": "system", "content": "You are an expert researcher and content analyst. Provide insights based on content analysis."},
                    {"role": "user", "content": research_prompt}
                ],
                max_tokens=1500,
                temperature=0.7
            )

            insights = response.choices[0].message.content.strip()

            result = {
                "insights": insights,
                "content_analyzed": len(content),
                "status": "success"
            }

            logger.info("Research insights generated successfully")
            return result

        except Exception as e:
            logger.error(f"Error generating research insights: {e}")
            return {
                "error": str(e),
                "status": "error"
            }

    async def validate_content_plan(
        self,
        content_plan: Dict[str, Any],
        uploaded_files: List[Dict]
    ) -> Dict[str, Any]:
        """
        Validate content plan against uploaded files
        Ensures content plan is based on actual uploaded content

        Args:
            content_plan: Generated content plan
            uploaded_files: List of uploaded files

        Returns:
            Dict containing validation results
        """
        try:
            logger.info("Validating content plan against uploaded files...")

            # Extract key content from uploaded files
            file_content = self._combine_file_content(uploaded_files)
            file_content_lower = file_content.lower()

            # Check if content plan references match uploaded content
            validation_results = {
                "is_valid": True,
                "warnings": [],
                "content_coverage": 0,
                "missing_elements": []
            }

            # Check main sections
            main_sections = content_plan.get("main_sections", [])
            for section in main_sections:
                section_title = section.get("title", "").lower()
                section_content = section.get("content", "").lower()

                # Check if section content relates to uploaded files
                if section_title and section_title not in file_content_lower:
                    validation_results["warnings"].append(
                        f"Section '{section_title}' may not relate to uploaded content")

                if section_content and section_content not in file_content_lower:
                    validation_results["warnings"].append(
                        f"Section content may not relate to uploaded content")

            # Calculate content coverage
            if file_content:
                # Simple heuristic for content coverage
                plan_text = str(content_plan).lower()
                common_words = set(file_content_lower.split()
                                   ) & set(plan_text.split())
                validation_results["content_coverage"] = len(
                    common_words) / max(len(set(file_content_lower.split())), 1) * 100

            # Determine if plan is valid
            if validation_results["content_coverage"] < 30:
                validation_results["is_valid"] = False
                validation_results["warnings"].append(
                    "Content plan has low coverage of uploaded content")

            logger.info(
                f"Content plan validation completed: {validation_results['is_valid']}")
            return validation_results

        except Exception as e:
            logger.error(f"Error validating content plan: {e}")
            return {
                "is_valid": False,
                "error": str(e),
                "warnings": ["Validation failed due to error"]
            }

    # Additional utility methods
    async def get_service_status(self) -> Dict[str, Any]:
        """Get AI service status and capabilities"""
        return {
            "available": self.is_available(),
            "templates_loaded": len(self.prompt_manager.templates),
            "llm_available": self.llm_service.is_available(),
            "capabilities": [
                "content_planning",
                "slide_generation",
                "content_refinement",
                "research_insights",
                "content_validation"
            ]
        }

    async def clear_client_data(self, client_id: str) -> bool:
        """Clear AI service data for a specific client"""
        try:
            # This service doesn't store persistent client data
            # Data is stored in other services
            logger.info(f"AI service data cleared for client {client_id}")
            return True
        except Exception as e:
            logger.error(f"Error clearing AI service data: {e}")
            return False
