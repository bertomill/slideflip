"""
Content Creator Agent

AI agent responsible for generating additional content for slides using LangGraph workflows.
This agent uses structured workflows with proper state management and agentic behavior
instead of direct OpenAI calls.
"""

import logging
from typing import Dict, Any, Optional, List
from datetime import datetime
import json

from src.core.simple_prompt_manager import get_prompt_manager
from src.core.monitoring import get_monitoring_service
from src.core.config import Settings
from src.workflows.content_creation_workflow import ContentCreationWorkflow

logger = logging.getLogger(__name__)


class ContentCreatorAgent:
    """
    AI agent for creating comprehensive slide content using LangGraph workflows

    This agent uses LangGraph for:
    1. Structured content creation workflows
    2. Proper state management and error handling
    3. Agentic behavior with decision-making capabilities
    4. Enhanced content generation with research integration
    """

    def __init__(self):
        self.prompt_manager = get_prompt_manager()
        self.monitoring_service = get_monitoring_service()
        self.settings = Settings()
        
        # Initialize LangGraph workflow
        try:
            self.workflow = ContentCreationWorkflow()
            logger.debug("LangGraph ContentCreationWorkflow initialized successfully")
        except Exception as e:
            logger.warning(f"Failed to initialize LangGraph workflow: {e}")
            self.workflow = None


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
        Create slide content using LangGraph workflow

        Args:
            uploaded_content: Content extracted from uploaded files
            user_description: User's description of what they want
            theme_info: Theme styling information (not used for content generation)
            research_data: Optional research data from external sources
            use_ai_agent: Whether to use AI agent capabilities
            content_style: Style preference for content generation

        Returns:
            Dict containing generated content and metadata
        """
        start_time = datetime.now()

        try:
            if not self.workflow:
                logger.warning("LangGraph workflow not available, using fallback")
                return await self._create_fallback_content(
                    uploaded_content, user_description, "LangGraph workflow not available"
                )

            logger.info(f"🚀 Creating content with LangGraph workflow (AI agent: {use_ai_agent})")
            
            # Use LangGraph workflow for content creation
            content = await self.workflow.create_content(
                uploaded_content=uploaded_content,
                user_description=user_description,
                theme_info=theme_info,
                research_data=research_data,
                use_ai_agent=use_ai_agent,
                content_style=content_style
            )

            # Add processing metadata
            if "metadata" not in content:
                content["metadata"] = {}
                
            content["metadata"].update({
                "agent_processing_time": (datetime.now() - start_time).total_seconds(),
                "agent_mode": "langgraph_workflow",
                "has_research": bool(research_data),
                "uploaded_content_length": len(uploaded_content),
                "generated_at": datetime.now().isoformat()
            })

            logger.info("✅ LangGraph content creation completed successfully")
            return content

        except Exception as e:
            logger.error(f"Error in LangGraph content creation: {e}")
            # Return fallback content
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
