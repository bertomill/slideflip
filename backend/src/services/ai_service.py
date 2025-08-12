"""
AI Service for OpenAI integration and AI-powered operations
"""

import logging
import asyncio
from typing import Dict, Any, Optional, List
from openai import OpenAI
from src.core.config import Settings

logger = logging.getLogger(__name__)


class AIService:
    """Service for AI-powered operations using OpenAI"""

    def __init__(self):
        self.settings = Settings()
        self.openai_client = None
        self._initialize_openai()

    def _initialize_openai(self):
        """Initialize OpenAI client if API key is available"""
        try:
            if self.settings.OPENAI_API_KEY:
                self.openai_client = OpenAI(
                    api_key=self.settings.OPENAI_API_KEY)
                logger.info("OpenAI client initialized successfully")
            else:
                logger.warning("OpenAI API key not configured")
        except Exception as e:
            logger.error(f"Failed to initialize OpenAI client: {e}")

    def is_available(self) -> bool:
        """Check if OpenAI service is available"""
        return self.openai_client is not None and self.settings.OPENAI_API_KEY is not None

    async def generate_slide_html(
        self,
        description: str,
        theme: str,
        research_data: Optional[str] = None,
        content_plan: Optional[str] = None,
        user_feedback: Optional[str] = None,
        color_palette: Optional[List[str]] = None
    ) -> str:
        """
        Generate slide HTML using OpenAI GPT-4

        Args:
            description: User's slide description
            theme: Selected theme name
            research_data: Research results from Step 3
            content_plan: AI-generated content plan from Step 4
            user_feedback: User's additional requirements
            color_palette: Theme color palette

        Returns:
            Generated HTML content for the slide
        """
        if not self.is_available():
            raise Exception("OpenAI service not available")

        try:
            prompt = self._build_slide_prompt(
                description, theme, research_data, content_plan, user_feedback, color_palette
            )

            logger.info("Generating slide HTML with OpenAI...")

            # Use asyncio to run the synchronous OpenAI call
            loop = asyncio.get_event_loop()
            response = await loop.run_in_executor(
                None,
                lambda: self.openai_client.chat.completions.create(
                    model="gpt-4",
                    messages=[
                        {
                            "role": "system",
                            "content": "You are a senior frontend developer and UI/UX expert specializing in creating stunning, professional slide presentations in HTML and CSS."
                        },
                        {
                            "role": "user",
                            "content": prompt
                        }
                    ],
                    temperature=0.7,
                    max_tokens=4000
                )
            )

            html_content = response.choices[0].message.content
            logger.info("Slide HTML generated successfully")

            return html_content

        except Exception as e:
            logger.error(f"Error generating slide HTML: {e}")
            raise

    async def generate_content_plan(
        self,
        description: str,
        research_data: Optional[str] = None,
        theme: str = "default",
        parsed_documents: Optional[List[Dict[str, Any]]] = None
    ) -> Dict[str, Any]:
        """
        Generate content plan using OpenAI

        Args:
            description: User's slide description
            research_data: Research results (if any)
            theme: Selected theme
            parsed_documents: Array of parsed document content

        Returns:
            Dictionary containing content plan and suggestions
        """
        if not self.is_available():
            raise Exception("OpenAI service not available")

        try:
            prompt = self._build_content_plan_prompt(
                description, research_data, theme, parsed_documents
            )

            logger.info("Generating content plan with OpenAI...")

            loop = asyncio.get_event_loop()
            response = await loop.run_in_executor(
                None,
                lambda: self.openai_client.chat.completions.create(
                    model="gpt-4",
                    messages=[
                        {
                            "role": "system",
                            "content": "You are a presentation content strategist with expertise in creating compelling slide content plans."
                        },
                        {
                            "role": "user",
                            "content": prompt
                        }
                    ],
                    temperature=0.7,
                    max_tokens=2000
                )
            )

            content_plan = response.choices[0].message.content

            # Parse the response to extract structured information
            result = self._parse_content_plan_response(content_plan)
            logger.info("Content plan generated successfully")

            return result

        except Exception as e:
            logger.error(f"Error generating content plan: {e}")
            raise

    async def refine_content_plan(
        self,
        content_plan: str,
        user_feedback: str,
        original_description: str
    ) -> Dict[str, Any]:
        """
        Refine content plan based on user feedback

        Args:
            content_plan: Current content plan
            user_feedback: User's feedback for refinement
            original_description: Original slide description

        Returns:
            Refined content plan
        """
        if not self.is_available():
            raise Exception("OpenAI service not available")

        try:
            prompt = f"""
            Please refine the following content plan based on the user's feedback.
            
            ORIGINAL DESCRIPTION:
            {original_description}
            
            CURRENT CONTENT PLAN:
            {content_plan}
            
            USER FEEDBACK:
            {user_feedback}
            
            Please provide a refined content plan that addresses the user's feedback while maintaining the core structure and objectives.
            """

            logger.info("Refining content plan with OpenAI...")

            loop = asyncio.get_event_loop()
            response = await loop.run_in_executor(
                None,
                lambda: self.openai_client.chat.completions.create(
                    model="gpt-4",
                    messages=[
                        {
                            "role": "system",
                            "content": "You are a presentation content strategist helping to refine content plans based on user feedback."
                        },
                        {
                            "role": "user",
                            "content": prompt
                        }
                    ],
                    temperature=0.7,
                    max_tokens=2000
                )
            )

            refined_plan = response.choices[0].message.content
            result = self._parse_content_plan_response(refined_plan)
            logger.info("Content plan refined successfully")

            return result

        except Exception as e:
            logger.error(f"Error refining content plan: {e}")
            raise

    def _build_slide_prompt(
        self,
        description: str,
        theme: str,
        research_data: Optional[str],
        content_plan: Optional[str],
        user_feedback: Optional[str],
        color_palette: Optional[List[str]]
    ) -> str:
        """Build the prompt for slide HTML generation"""

        prompt_parts = [
            f"Create a stunning HTML slide presentation based on the following requirements:",
            f"\nSLIDE DESCRIPTION: {description}",
            f"\nTHEME: {theme}"
        ]

        if color_palette:
            prompt_parts.append(f"\nCOLOR PALETTE: {', '.join(color_palette)}")

        if research_data:
            prompt_parts.append(f"\nRESEARCH DATA: {research_data}")

        if content_plan:
            prompt_parts.append(f"\nCONTENT PLAN: {content_plan}")

        if user_feedback:
            prompt_parts.append(f"\nUSER FEEDBACK: {user_feedback}")

        prompt_parts.extend([
            "\nREQUIREMENTS:",
            "- Create a slide with dimensions 1200px x 800px",
            "- Use modern CSS with gradients, shadows, and smooth animations",
            "- Ensure the design matches the specified theme",
            "- Make it professional and visually appealing",
            "- Use the specified color palette if provided",
            "- Include proper HTML structure and CSS styling",
            "- Make it responsive and accessible",
            "\nPlease provide only the HTML and CSS code, no explanations."
        ])

        return "\n".join(prompt_parts)

    def _build_content_plan_prompt(
        self,
        description: str,
        research_data: Optional[str],
        theme: str,
        parsed_documents: Optional[List[Dict[str, Any]]]
    ) -> str:
        """Build the prompt for content plan generation"""

        prompt_parts = [
            f"Create a comprehensive content plan for a slide presentation based on:",
            f"\nSLIDE DESCRIPTION: {description}",
            f"\nTHEME: {theme}"
        ]

        if research_data:
            prompt_parts.append(f"\nRESEARCH DATA: {research_data}")

        if parsed_documents:
            doc_summary = "\n".join([
                f"- {doc.get('filename', 'Unknown')}: {doc.get('content', '')[:200]}..."
                for doc in parsed_documents[:3]  # Limit to first 3 documents
            ])
            prompt_parts.append(f"\nUPLOADED DOCUMENTS:\n{doc_summary}")

        prompt_parts.extend([
            "\nPlease provide a structured content plan that includes:",
            "1. Main topics and subtopics",
            "2. Key points for each section",
            "3. Estimated slide count",
            "4. Content flow and structure",
            "5. Visual elements recommendations",
            "\nFormat your response as a structured plan with clear sections."
        ])

        return "\n".join(prompt_parts)

    def _parse_content_plan_response(self, response: str) -> Dict[str, Any]:
        """Parse the AI response to extract structured content plan information"""
        try:
            # For now, return the raw response with some basic parsing
            # In a production system, you might want to use more sophisticated parsing
            lines = response.split('\n')

            # Extract estimated slide count if mentioned
            estimated_slides = 1
            for line in lines:
                if 'slide' in line.lower() and any(char.isdigit() for char in line):
                    # Try to extract number from line
                    import re
                    numbers = re.findall(r'\d+', line)
                    if numbers:
                        estimated_slides = int(numbers[0])
                        break

            return {
                "content_plan": response,
                "suggestions": self._extract_suggestions(response),
                "estimated_slide_count": estimated_slides,
                "raw_response": response
            }

        except Exception as e:
            logger.warning(f"Error parsing content plan response: {e}")
            return {
                "content_plan": response,
                "suggestions": [],
                "estimated_slide_count": 1,
                "raw_response": response
            }

    def _extract_suggestions(self, response: str) -> List[str]:
        """Extract suggestions from the AI response"""
        suggestions = []
        lines = response.split('\n')

        for line in lines:
            line = line.strip()
            if line.startswith('-') or line.startswith('•') or line.startswith('*'):
                suggestions.append(line[1:].strip())
            elif line and len(line) > 10 and not line.startswith('#'):
                # Add non-header lines as suggestions
                suggestions.append(line)

        return suggestions[:5]  # Limit to 5 suggestions
