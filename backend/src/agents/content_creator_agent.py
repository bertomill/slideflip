"""
Content Creator Agent

AI agent responsible for generating additional content for slides using LangGraph workflows.
This agent can create content based on uploaded files, user descriptions, and optionally
perform research to enhance the content.
"""

import logging
from typing import Dict, Any, Optional, List
from datetime import datetime
import json

from src.core.prompt_manager import get_prompt_manager
from src.services.llm_service import LLMService
from src.core.monitoring import get_monitoring_service

logger = logging.getLogger(__name__)


class ContentCreatorAgent:
    """
    AI agent for creating comprehensive slide content

    This agent can:
    1. Generate content based only on uploaded files (basic mode)
    2. Create enhanced content using AI research capabilities (agent mode)
    3. Adapt content based on user preferences and themes
    """

    def __init__(self):
        self.llm_service = LLMService()
        self.prompt_manager = get_prompt_manager()
        self.monitoring_service = get_monitoring_service()

    async def create_content(
        self,
        uploaded_content: str,
        user_description: str,
        theme_info: Optional[Dict[str, Any]] = None,
        research_data: Optional[str] = None,
        use_ai_agent: bool = False,
        content_style: str = "professional"
    ) -> Dict[str, Any]:
        """
        Create slide content using the appropriate method

        Args:
            uploaded_content: Content extracted from uploaded files
            user_description: User's description of what they want
            theme_info: Theme styling information (not used for content)
            research_data: Optional research data from external sources
            use_ai_agent: Whether to use AI agent capabilities
            content_style: Style preference for content generation

        Returns:
            Dict containing generated content and metadata
        """
        start_time = datetime.now()

        try:
            if use_ai_agent and research_data:
                # Use AI agent mode with research enhancement
                logger.info("Using AI agent mode with research enhancement")
                content = await self._create_enhanced_content_with_agent(
                    uploaded_content, user_description, research_data, content_style
                )
            elif use_ai_agent:
                # Use AI agent mode without research (AI generates additional content)
                logger.info(
                    "Using AI agent mode to generate additional content")
                content = await self._create_enhanced_content_without_research(
                    uploaded_content, user_description, content_style
                )
            else:
                # Basic mode: use only uploaded content
                logger.info("Using basic mode with uploaded content only")
                content = await self._create_basic_content(
                    uploaded_content, user_description
                )

            # Add metadata
            content["metadata"] = {
                "generation_mode": "ai_agent" if use_ai_agent else "basic",
                "content_style": content_style,
                "processing_time": (datetime.now() - start_time).total_seconds(),
                "has_research": bool(research_data),
                "uploaded_content_length": len(uploaded_content),
                "generated_at": datetime.now().isoformat()
            }

            return content

        except Exception as e:
            logger.error(f"Error in content creation: {e}")
            # Return fallback content
            return await self._create_fallback_content(
                uploaded_content, user_description, str(e)
            )

    async def _create_enhanced_content_with_agent(
        self,
        uploaded_content: str,
        user_description: str,
        research_data: str,
        content_style: str
    ) -> Dict[str, Any]:
        """Create enhanced content using AI agent with research data"""
        try:
            # Prepare variables for the enhanced content generation prompt
            template_variables = {
                "uploaded_content": uploaded_content[:3000] + "..." if len(uploaded_content) > 3000 else uploaded_content,
                "user_description": user_description,
                "research_data": research_data[:2000] + "..." if len(research_data) > 2000 else research_data,
                "content_style": content_style,
                "current_timestamp": datetime.now().isoformat()
            }

            # Render the enhanced content generation prompt
            prompt_data = await self.prompt_manager.render_prompt(
                "enhanced_content_generation",
                template_variables
            )

            # Generate content using LLM
            response = await self.llm_service.generate_completion(
                system_prompt=prompt_data["system_prompt"],
                user_prompt=prompt_data["user_prompt"],
                **prompt_data["model_config"]
            )

            # Parse the response
            try:
                content_data = json.loads(response)
                logger.info(
                    "✅ Successfully generated enhanced content with AI agent")
                return content_data
            except json.JSONDecodeError as e:
                logger.warning(
                    f"Failed to parse enhanced content response: {e}")
                return await self._create_fallback_content(
                    uploaded_content, user_description, "JSON parsing failed"
                )

        except Exception as e:
            logger.error(f"Error in enhanced content creation: {e}")
            return await self._create_fallback_content(
                uploaded_content, user_description, str(e)
            )

    async def _create_enhanced_content_without_research(
        self,
        uploaded_content: str,
        user_description: str,
        content_style: str
    ) -> Dict[str, Any]:
        """Create enhanced content using AI agent without external research"""
        try:
            # Prepare variables for AI-enhanced content generation
            template_variables = {
                "uploaded_content": uploaded_content[:3000] + "..." if len(uploaded_content) > 3000 else uploaded_content,
                "user_description": user_description,
                "content_style": content_style,
                "current_timestamp": datetime.now().isoformat()
            }

            # Render the AI-enhanced content generation prompt
            prompt_data = await self.prompt_manager.render_prompt(
                "ai_enhanced_content_generation",
                template_variables
            )

            # Generate content using LLM
            response = await self.llm_service.generate_completion(
                system_prompt=prompt_data["system_prompt"],
                user_prompt=prompt_data["user_prompt"],
                **prompt_data["model_config"]
            )

            # Parse the response
            try:
                content_data = json.loads(response)
                logger.info("✅ Successfully generated AI-enhanced content")
                return content_data
            except json.JSONDecodeError as e:
                logger.warning(
                    f"Failed to parse AI-enhanced content response: {e}")
                return await self._create_fallback_content(
                    uploaded_content, user_description, "JSON parsing failed"
                )

        except Exception as e:
            logger.error(f"Error in AI-enhanced content creation: {e}")
            return await self._create_fallback_content(
                uploaded_content, user_description, str(e)
            )

    async def _create_basic_content(
        self,
        uploaded_content: str,
        user_description: str
    ) -> Dict[str, Any]:
        """Create basic content using only uploaded files"""
        try:
            # Use the existing slide content generation prompt
            template_variables = {
                "content": uploaded_content[:3000] + "..." if len(uploaded_content) > 3000 else uploaded_content,
                "description": user_description,
                "layout": {"type": "basic", "sections": 3},  # Basic layout
                "theme_info": None
            }

            # Generate content using existing LLM service method
            content = await self.llm_service.generate_slide_content(
                content=uploaded_content,
                description=user_description,
                layout={"type": "basic", "sections": 3},
                theme_info=None
            )

            logger.info("✅ Successfully generated basic content")
            return content

        except Exception as e:
            logger.error(f"Error in basic content creation: {e}")
            return await self._create_fallback_content(
                uploaded_content, user_description, str(e)
            )

    async def _create_fallback_content(
        self,
        uploaded_content: str,
        user_description: str,
        error_reason: str
    ) -> Dict[str, Any]:
        """Create fallback content when other methods fail"""
        logger.warning(f"Creating fallback content due to: {error_reason}")

        # Create simple fallback content based on uploaded content
        title = f"Presentation: {user_description[:50]}..."

        # Extract key points from uploaded content
        lines = uploaded_content.split('\n')
        key_points = [line.strip() for line in lines if line.strip()
                      and len(line.strip()) > 10][:5]

        if not key_points:
            key_points = ["Content from uploaded files",
                          "User requirements", "Additional details needed"]

        return {
            "title": title,
            "section_0": {
                "content": f"Overview: {user_description}",
                "style_notes": "Use as introduction section"
            },
            "section_1": {
                "content": "Key Points:\n" + "\n".join([f"• {point}" for point in key_points]),
                "style_notes": "Use bullet points for clarity"
            },
            "section_2": {
                "content": "Additional information and insights will be added here.",
                "style_notes": "Use for conclusions or next steps"
            },
            "fallback_reason": error_reason,
            "generation_mode": "fallback"
        }

    async def validate_content_quality(
        self,
        content: Dict[str, Any],
        user_description: str
    ) -> Dict[str, Any]:
        """
        Validate the quality of generated content

        Returns:
            Dict with quality score and feedback
        """
        try:
            # Basic quality checks
            quality_score = 0.0
            feedback = []

            # Check if content has required sections
            if "title" in content:
                quality_score += 0.2
            else:
                feedback.append("Missing title")

            # Check for content sections
            section_count = len(
                [k for k in content.keys() if k.startswith('section_')])
            if section_count >= 2:
                quality_score += 0.3
            else:
                feedback.append(f"Insufficient sections: {section_count}")

            # Check content length
            total_content_length = sum(
                len(str(section.get('content', '')))
                for section in content.values()
                if isinstance(section, dict) and 'content' in section
            )

            if total_content_length > 100:
                quality_score += 0.3
            else:
                feedback.append("Content too short")

            # Check for fallback indicators
            if content.get('fallback_reason'):
                quality_score -= 0.2
                feedback.append("Generated using fallback method")

            # Ensure score is between 0 and 1
            quality_score = max(0.0, min(1.0, quality_score))

            return {
                "quality_score": quality_score,
                "feedback": feedback,
                "section_count": section_count,
                "total_content_length": total_content_length,
                "is_acceptable": quality_score >= 0.6
            }

        except Exception as e:
            logger.error(f"Error in content quality validation: {e}")
            return {
                "quality_score": 0.0,
                "feedback": [f"Validation error: {str(e)}"],
                "section_count": 0,
                "total_content_length": 0,
                "is_acceptable": False
            }
