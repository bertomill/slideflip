"""
LLM service for slide generation using OpenAI GPT
Rewritten with proper JSON parsing and content-focused generation
"""

import logging
import json
from typing import Dict, List, Optional, Any
from openai import OpenAI
from src.core.config import Settings
from src.core.prompt_manager import get_prompt_manager
import re

logger = logging.getLogger(__name__)


class LLMService:
    """
    Service for LLM-based slide generation and knowledge graph extraction
    Rewritten with proper JSON parsing and content-focused generation
    """

    def __init__(self):
        self.settings = Settings()
        self.client = None
        self.prompt_manager = get_prompt_manager()
        self._initialize_client()

    def _initialize_client(self):
        """Initialize OpenAI client"""
        try:
            # Check if API key is available
            api_key = self.settings.OPENAI_API_KEY
            if api_key:
                self.client = OpenAI(api_key=api_key)
                logger.info("OpenAI client initialized successfully")
            else:
                logger.warning(
                    "OpenAI API key not found. LLM features will be disabled.")
                logger.info("Please check:")
                logger.info("1. .env file exists in backend directory")
                logger.info("2. OPENAI_API_KEY is set in .env file")
                logger.info("3. File format: OPENAI_API_KEY=your_api_key_here")
                self.client = None
        except Exception as e:
            logger.error(f"Error initializing OpenAI client: {e}")
            self.client = None

    def is_available(self) -> bool:
        """Check if LLM service is available"""
        return self.client is not None

    async def generate_slide_layout(
        self,
        content: str,
        description: str,
        theme: str = "default",
        has_images: bool = False,
        theme_info: Optional[Dict] = None
    ) -> Dict[str, Any]:
        """
        Generate slide layout using LLM
        Content-focused generation based on uploaded files and user description

        Args:
            content: Extracted text content from uploaded files
            description: User's slide description
            theme: Slide theme (used only for styling, not content)
            has_images: Whether images are available
            theme_info: Theme information (not used for content generation)

        Returns:
            Dict containing layout information
        """
        if not self.client:
            return self._generate_fallback_layout(content, description, theme)

        try:
            # Prepare variables for the prompt template
            template_variables = {
                "content": content[:3000] + "..." if len(content) > 3000 else content,
                "description": description,
                "theme": theme,
                "has_images": has_images,
                "theme_info": None  # Don't pass theme info to content generation
            }

            # Render the slide layout generation prompt
            prompt_data = await self.prompt_manager.render_prompt(
                "slide_layout_generation",
                template_variables
            )

            response = self.client.chat.completions.create(
                **prompt_data["model_config"],
                messages=[
                    {"role": "system",
                        "content": prompt_data["system_prompt"]},
                    {"role": "user", "content": prompt_data["user_prompt"]}
                ]
            )

            layout_text = response.choices[0].message.content.strip()

            # Log the raw response for debugging
            logger.info(
                f"LLM Layout Response (first 500 chars): {layout_text[:500]}...")

            # Clean up markdown code blocks if present
            if layout_text.startswith("```json"):
                layout_text = layout_text[7:]  # Remove ```json
            elif layout_text.startswith("```"):
                layout_text = layout_text[3:]  # Remove ```
            if layout_text.endswith("```"):
                layout_text = layout_text[:-3]  # Remove trailing ```

            # Parse JSON response with better error handling
            try:
                layout_data = json.loads(layout_text.strip())
                logger.info(
                    f"✅ Successfully parsed layout JSON: {layout_data.get('layout_type', 'unknown')}")
                logger.info(
                    f"   Sections: {len(layout_data.get('sections', []))}")
                logger.info(
                    f"   Title: {layout_data.get('title', 'No title')}")
                return layout_data
            except json.JSONDecodeError as e:
                logger.warning(
                    f"❌ Failed to parse/validate layout response: {e}")
                logger.warning(f"Raw response: {layout_text}")
                logger.warning(f"Response length: {len(layout_text)}")
                logger.warning(f"First 100 chars: {layout_text[:100]}")
                logger.warning(f"Last 100 chars: {layout_text[-100:]}")

                # Try to extract JSON from the response if it's embedded in text
                try:
                    # Look for JSON-like content between curly braces
                    import re
                    json_match = re.search(r'\{.*\}', layout_text, re.DOTALL)
                    if json_match:
                        json_content = json_match.group(0)
                        logger.info(
                            f"Attempting to parse extracted JSON: {json_content[:200]}...")
                        layout_data = json.loads(json_content)
                        logger.info(f"✅ Successfully parsed extracted JSON")
                        return layout_data
                except Exception as extract_error:
                    logger.warning(
                        f"Failed to extract JSON from response: {extract_error}")

                return self._generate_fallback_layout(content, description, theme)

        except Exception as e:
            logger.error(f"Error generating slide layout: {e}")
            return self._generate_fallback_layout(content, description, theme)

    async def generate_slide_content(
        self,
        content: str,
        description: str,
        layout: Dict[str, Any],
        theme_info: Optional[Dict] = None
    ) -> Dict[str, Any]:
        """
        Generate slide content using LLM
        Content-focused generation based on uploaded files and user description

        Args:
            content: Extracted text content from uploaded files
            description: User's slide description
            layout: Generated layout structure
            theme_info: Theme information (not used for content generation)

        Returns:
            Dict containing content for each section
        """
        if not self.client:
            return self._generate_fallback_content(content, description, layout)

        try:
            # Prepare variables for the prompt template
            template_variables = {
                "content": content[:3000] + "..." if len(content) > 3000 else content,
                "description": description,
                "layout": layout,
                "theme_info": None  # Don't pass theme info to content generation
            }

            # Render the slide content generation prompt
            prompt_data = await self.prompt_manager.render_prompt(
                "slide_content_generation",
                template_variables
            )

            response = self.client.chat.completions.create(
                **prompt_data["model_config"],
                messages=[
                    {"role": "system",
                        "content": prompt_data["system_prompt"]},
                    {"role": "user", "content": prompt_data["user_prompt"]}
                ]
            )

            content_text = response.choices[0].message.content.strip()

            # Log the raw response for debugging
            logger.info(
                f"LLM Content Response (first 500 chars): {content_text[:500]}...")

            # Clean up markdown code blocks if present
            if content_text.startswith("```json"):
                content_text = content_text[7:]  # Remove ```json
            elif content_text.startswith("```"):
                content_text = content_text[3:]  # Remove ```
            if content_text.endswith("```"):
                content_text = content_text[:-3]  # Remove trailing ```

            # Parse JSON response with better error handling
            try:
                content_data = json.loads(content_text.strip())
                logger.info(f"✅ Successfully parsed content JSON")
                logger.info(
                    f"   Sections: {len([k for k in content_data.keys() if k.startswith('section_')])}")
                return content_data
            except json.JSONDecodeError as e:
                logger.warning(
                    f"❌ Failed to parse/validate content response: {e}")
                logger.warning(f"Raw response: {content_text}")
                return self._generate_fallback_content(content, description, layout)

        except Exception as e:
            logger.error(f"Error generating slide content: {e}")
            return self._generate_fallback_content(content, description, layout)

    async def generate_slide_html(
        self,
        layout: Dict[str, Any],
        content: Dict[str, Any],
        theme: str = "default",
        wants_research: bool = False,
        theme_info: Optional[Dict] = None
    ) -> str:
        """
        Generate HTML slide using LLM
        Content-focused generation with theme styling applied separately

        Args:
            layout: Generated layout structure
            content: Generated content for each section
            theme: Theme name (used only for styling)
            wants_research: Whether research is enabled
            theme_info: Theme information (used only for styling)

        Returns:
            HTML string for the slide
        """
        if not self.client:
            return self._generate_fallback_html(layout, content, theme_info, wants_research)

        try:
            # Prepare variables for the prompt template
            template_variables = {
                "layout": layout,
                "content": content,
                "theme": theme,
                "wants_research": wants_research,
                "theme_info": theme_info  # Pass theme info for styling only
            }

            # Render the slide HTML generation prompt
            prompt_data = await self.prompt_manager.render_prompt(
                "slide_html_generation",
                template_variables
            )

            response = self.client.chat.completions.create(
                **prompt_data["model_config"],
                messages=[
                    {"role": "system",
                        "content": prompt_data["system_prompt"]},
                    {"role": "user", "content": prompt_data["user_prompt"]}
                ]
            )

            html_text = response.choices[0].message.content.strip()

            # Log the raw response for debugging
            logger.info(
                f"LLM HTML Response (first 500 chars): {html_text[:500]}...")
            logger.info(f"HTML content size: {len(html_text)} characters")

            # Clean up markdown code blocks if present
            if html_text.startswith("```html"):
                html_text = html_text[7:]  # Remove ```html
            elif html_text.startswith("```"):
                html_text = html_text[3:]  # Remove ```
            if html_text.endswith("```"):
                html_text = html_text[:-3]  # Remove trailing ```

            # Validate HTML content
            if len(html_text) > 50000:  # 50KB limit
                logger.warning(
                    f"HTML content too large ({len(html_text)} chars), truncating")
                html_text = html_text[:50000]

            # Basic HTML validation
            if not html_text.strip():
                logger.error("Empty HTML content generated")
                return self._generate_error_html()

            if not ('<' in html_text and '>' in html_text):
                logger.error("Invalid HTML content - missing tags")
                return self._generate_error_html()

            # Sanitize HTML content to prevent issues
            html_text = re.sub(
                r'<script[^>]*>.*?</script>', '', html_text, flags=re.DOTALL | re.IGNORECASE)
            html_text = re.sub(
                r'\s+on\w+\s*=\s*["\'][^"\']*["\']', '', html_text, flags=re.IGNORECASE)
            html_text = re.sub(r'javascript:', '',
                               html_text, flags=re.IGNORECASE)

            logger.info("✅ Generated HTML using LLM successfully")
            return html_text

        except Exception as e:
            logger.error(f"Error generating HTML with LLM: {e}")
            return self._generate_fallback_html(layout, content, theme_info, wants_research)

    async def generate_completion(
        self,
        system_prompt: str,
        user_prompt: str,
        **model_config
    ) -> str:
        """
        Generate completion using LLM with custom prompts

        Args:
            system_prompt: System prompt for the LLM
            user_prompt: User prompt for the LLM
            **model_config: Model configuration parameters

        Returns:
            Generated text response
        """
        if not self.client:
            return "Error: LLM client not available"

        try:
            # Use default model config if none provided
            if not model_config:
                model_config = {
                    "model": "gpt-4o-mini",
                    "temperature": 0.7,
                    "max_tokens": 2000
                }

            response = self.client.chat.completions.create(
                **model_config,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt}
                ]
            )

            return response.choices[0].message.content.strip()

        except Exception as e:
            logger.error(f"Error generating completion: {e}")
            return f"Error: {str(e)}"

    async def generate_content_plan(
        self,
        description: str,
        research_data: Optional[str] = None,
        theme: str = "default",
        uploaded_files: Optional[List[Dict]] = None,
        theme_info: Optional[Dict] = None
    ) -> Dict[str, Any]:
        """
        Generate content plan using LLM
        Content-focused generation based on uploaded files and user description

        Args:
            description: User's slide description
            research_data: Optional research data
            theme: Theme name (used only for styling suggestions)
            uploaded_files: List of uploaded files with content
            theme_info: Theme information (used only for styling suggestions)

        Returns:
            Dict containing content plan
        """
        if not self.client:
            return self._generate_fallback_content_plan(description, uploaded_files)

        try:
            # Prepare variables for the prompt template
            template_variables = {
                "description": description,
                "theme": theme,
                "research_data": research_data,
                "uploaded_files": uploaded_files or [],
                "user_feedback": "",
                "theme_info": theme_info  # For styling suggestions only
            }

            # Render the content planning prompt
            prompt_data = await self.prompt_manager.render_prompt(
                "content_planning",
                template_variables
            )

            # Log the rendered prompts for debugging
            logger.debug(
                f"Content planning system prompt length: {len(prompt_data['system_prompt'])}")
            logger.debug(
                f"Content planning user prompt length: {len(prompt_data['user_prompt'])}")
            logger.debug(
                f"Template variables: {list(template_variables.keys())}")
            logger.debug(
                f"Uploaded files count: {len(template_variables.get('uploaded_files', []))}")

            response = self.client.chat.completions.create(
                **prompt_data["model_config"],
                messages=[
                    {"role": "system",
                        "content": prompt_data["system_prompt"]},
                    {"role": "user", "content": prompt_data["user_prompt"]}
                ]
            )

            plan_text = response.choices[0].message.content.strip()

            # Log the raw response for debugging
            logger.info(
                f"LLM Content Plan Response (first 500 chars): {plan_text[:500]}...")

            # Clean up markdown code blocks if present
            if plan_text.startswith("```json"):
                plan_text = plan_text[7:]  # Remove ```json
            elif plan_text.startswith("```"):
                plan_text = plan_text[3:]  # Remove ```
            if plan_text.endswith("```"):
                plan_text = plan_text[:-3]  # Remove trailing ```

            # Parse JSON response with better error handling
            try:
                plan_data = json.loads(plan_text.strip())
                logger.info(f"✅ Successfully parsed content plan JSON")
                return plan_data
            except json.JSONDecodeError as e:
                logger.warning(
                    f"❌ Failed to parse/validate content plan response: {e}")
                logger.warning(f"Raw response: {plan_text}")
                logger.warning(f"Response length: {len(plan_text)}")
                logger.warning(f"First 100 chars: {plan_text[:100]}")
                logger.warning(f"Last 100 chars: {plan_text[-100:]}")

                # Try to extract JSON from the response if it's embedded in text
                try:
                    # Look for JSON-like content between curly braces
                    import re
                    json_match = re.search(r'\{.*\}', plan_text, re.DOTALL)
                    if json_match:
                        json_content = json_match.group(0)
                        logger.info(
                            f"Attempting to parse extracted JSON: {json_content[:200]}...")
                        plan_data = json.loads(json_content)
                        logger.info(f"✅ Successfully parsed extracted JSON")
                        return plan_data
                except Exception as extract_error:
                    logger.warning(
                        f"Failed to extract JSON from response: {extract_error}")

                return self._generate_fallback_content_plan(description, uploaded_files)

        except Exception as e:
            logger.error(f"Error generating content plan: {e}")
            return self._generate_fallback_content_plan(description, uploaded_files)

    def _generate_fallback_layout(self, content: str, description: str, theme: str) -> Dict[str, Any]:
        """Generate fallback layout when LLM is not available"""
        try:
            # Extract key information from content
            content_lines = content.split('\n')
            content_summary = content[:200] + \
                "..." if len(content) > 200 else content

            # Create basic layout structure
            layout = {
                "layout_type": "content_slide",
                "title": description[:50] if description else "Generated Slide",
                "sections": [
                    {
                        "type": "text",
                        "content": "Content overview and key insights",
                        "position": {"x": 5, "y": 20, "width": 90, "height": 30},
                        "style": {"font_size": "18px", "color": "#2c3e50", "alignment": "left"}
                    },
                    {
                        "type": "bullet_list",
                        "content": "Key points from uploaded content",
                        "position": {"x": 5, "y": 55, "width": 90, "height": 40},
                        "style": {"font_size": "16px", "color": "#34495e", "alignment": "left"}
                    }
                ]
            }

            logger.info("Generated fallback layout")
            return layout

        except Exception as e:
            logger.error(f"Error generating fallback layout: {e}")
            return {
                "layout_type": "error_slide",
                "title": "Layout Generation Error",
                "sections": []
            }

    def _generate_fallback_content(self, content: str, description: str, layout: Dict[str, Any]) -> Dict[str, Any]:
        """Generate fallback content when LLM is not available"""
        try:
            # Extract key information from content
            content_lines = content.split('\n')
            content_summary = content[:300] + \
                "..." if len(content) > 300 else content

            # Create basic content structure
            content_data = {
                "title": description[:50] if description else "Generated Slide",
                "section_0": {
                    "content": f"Content Analysis:\n{content_summary}",
                    "style_notes": "Use clear, readable formatting"
                },
                "section_1": {
                    "content": "Key Insights:\n• Content processed successfully\n• Information extracted from uploaded files\n• Ready for presentation",
                    "style_notes": "Use bullet points for clarity"
                }
            }

            logger.info("Generated fallback content")
            return content_data

        except Exception as e:
            logger.error(f"Error generating fallback content: {e}")
            return {
                "title": "Content Generation Error",
                "section_0": {
                    "content": "Unable to generate content. Please try again.",
                    "style_notes": "Use error styling"
                }
            }

    def _generate_fallback_html(self, layout: Dict[str, Any], content: Dict[str, Any], theme_info: Optional[Dict], wants_research: bool) -> str:
        """Generate fallback HTML when LLM is not available"""
        try:
            # Extract title from layout
            title = layout.get("title", "Generated Slide")

            # Get theme styles
            theme_styles = self._get_theme_styles(theme_info)

            # Generate content sections
            content_sections = ""
            sections = layout.get("sections", [])

            for i, section in enumerate(sections):
                section_content = content.get(f"section_{i}", {})
                section_text = section_content.get(
                    "content", "Content not available")

                if section.get("type") == "bullet_list":
                    # Convert to bullet points
                    lines = section_text.split('\n')
                    bullet_points = ""
                    for line in lines:
                        if line.strip():
                            bullet_points += f"""
                            <li style="margin-bottom: 10px; padding-left: 20px; position: relative;">
                            <span style="position: absolute; left: 0; top: 5px; width: 6px; height: 6px; background: #4ade80; border-radius: 50%;"></span>
                            {line.strip()}
                            </li>
                            """
                    content_sections += f"""
                    <div style="margin-bottom: 20px;">
                        <ul style="list-style: none; padding: 0;">
                            {bullet_points}
                        </ul>
                    </div>
                    """
                else:
                    # Regular text content
                    content_sections += f"""
                    <div style="margin-bottom: 20px; padding: 15px; background: rgba(255,255,255,0.1); border-radius: 10px;">
                        <p style="margin: 0; line-height: 1.6;">{section_text}</p>
                    </div>
                    """

            # Add research indicator if enabled
            if wants_research:
                content_sections += """
                <div style="margin-top: 20px; padding: 10px; background: rgba(245, 158, 11, 0.2); border-radius: 8px; border-left: 4px solid #f59e0b;">
                    <p style="margin: 0; font-size: 14px; color: #f59e0b;">
                        <strong>🔍 Enhanced with AI Research</strong>
                    </p>
                </div>
                """

            # Create the HTML slide
            slide_html = f"""
            <div style="width: 800px; height: 600px; {theme_styles['background']}; padding: 60px; color: {theme_styles['text_color']}; font-family: 'Arial', sans-serif; position: relative; overflow: hidden; border-radius: 15px; box-shadow: 0 20px 40px rgba(0,0,0,0.3);">
                <div style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; {theme_styles['overlay']}; opacity: 0.3;"></div>
                
                <div style="position: relative; z-index: 1;">
                    <h1 style="font-size: 48px; font-weight: bold; margin-bottom: 30px; text-shadow: 2px 2px 4px rgba(0,0,0,0.3); {theme_styles['title_style']}; text-align: center;">
                        {title}
                    </h1>
                    
                    <div style="background: {theme_styles['content_bg']}; backdrop-filter: blur(10px); border-radius: 15px; padding: 30px; margin: 20px 0; max-height: 400px; overflow-y: auto;">
                        {content_sections}
                    </div>
                    
                    <div style="position: absolute; bottom: 20px; right: 60px; font-size: 12px; opacity: 0.7;">
                        Created with SlideFlip AI
                    </div>
                </div>
            </div>
            """

            logger.info("Generated fallback HTML")
            return slide_html

        except Exception as e:
            logger.error(f"Error generating fallback HTML: {e}")
            return self._generate_error_html()

    def _generate_fallback_content_plan(self, description: str, uploaded_files: Optional[List[Dict]]) -> Dict[str, Any]:
        """Generate fallback content plan when LLM is not available"""
        try:
            # Create basic content plan structure
            content_plan = {
                "title": description[:50] if description else "Generated Presentation",
                "subtitle": "Content plan based on uploaded materials",
                "main_sections": [
                    {
                        "type": "header",
                        "title": "Introduction",
                        "content": "Overview of the presentation topic",
                        "visual_elements": ["title", "subtitle"],
                        "priority": "high"
                    },
                    {
                        "type": "content",
                        "title": "Main Content",
                        "content": "Key information from uploaded files",
                        "visual_elements": ["bullet points", "text"],
                        "priority": "high"
                    }
                ],
                "key_messages": [
                    "Content processed successfully",
                    "Information extracted from uploaded files",
                    "Ready for presentation"
                ],
                "visual_recommendations": {
                    "layout_style": "single-column",
                    "emphasis_elements": ["title", "main_content"],
                    "color_usage": "Use theme colors for accents and highlights"
                }
            }

            logger.info("Generated fallback content plan")
            return content_plan

        except Exception as e:
            logger.error(f"Error generating fallback content plan: {e}")
            return {
                "title": "Content Plan Error",
                "error": "Unable to generate content plan. Please try again."
            }

    def _get_theme_styles(self, theme_info: Optional[Dict]) -> Dict[str, str]:
        """Get theme styles for HTML generation"""
        if not theme_info:
            return {
                'background': 'background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);',
                'text_color': 'white',
                'overlay': 'background: linear-gradient(45deg, #f093fb 0%, transparent 100%);',
                'content_bg': 'rgba(255,255,255,0.15)',
                'title_style': 'color: #667eea;'
            }

        color_palette = theme_info.get('color_palette', [])
        if color_palette:
            primary_color = color_palette[0]
            secondary_color = color_palette[1] if len(
                color_palette) > 1 else primary_color
            accent_color = color_palette[2] if len(
                color_palette) > 2 else secondary_color

            return {
                'background': f'background: linear-gradient(135deg, {primary_color} 0%, {secondary_color} 100%);',
                'text_color': 'white',
                'overlay': f'background: linear-gradient(45deg, {accent_color} 0%, transparent 100%);',
                'content_bg': 'rgba(255,255,255,0.15)',
                'title_style': f'color: {primary_color};'
            }

        return {
            'background': 'background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);',
            'text_color': 'white',
            'overlay': 'background: linear-gradient(45deg, #f093fb 0%, transparent 100%);',
            'content_bg': 'rgba(255,255,255,0.15)',
            'title_style': 'color: #667eea;'
        }

    def _generate_error_html(self) -> str:
        """Generate error HTML slide"""
        return """
        <div style="width: 800px; height: 600px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 60px; color: white; font-family: 'Arial', sans-serif; display: flex; align-items: center; justify-content: center; border-radius: 15px;">
            <div style="text-align: center;">
                <h1 style="font-size: 36px; margin-bottom: 20px;">Slide Generation Error</h1>
                <p style="font-size: 18px;">Unable to generate slide content. Please try again.</p>
            </div>
        </div>
        """

    # Knowledge Graph Methods (kept for backward compatibility)
    async def extract_knowledge_graph(
        self,
        content: str,
        description: str,
        max_nodes: int = 50
    ) -> Dict[str, Any]:
        """Extract knowledge graph from content"""
        if not self.client:
            return {"error": "LLM service not available"}

        try:
            # This method is kept for backward compatibility
            # Knowledge graph extraction is now handled by the dedicated service
            logger.info(
                "Knowledge graph extraction requested (handled by dedicated service)")
            return {"message": "Knowledge graph extraction handled by dedicated service"}

        except Exception as e:
            logger.error(f"Error extracting knowledge graph: {e}")
            return {"error": str(e)}

    async def query_knowledge_graph(
        self,
        query: str,
        graph_data: Dict[str, Any],
        max_results: int = 10
    ) -> Dict[str, Any]:
        """Query knowledge graph with natural language"""
        if not self.client:
            return {"error": "LLM service not available"}

        try:
            # This method is kept for backward compatibility
            # Knowledge graph querying is now handled by the dedicated service
            logger.info(
                "Knowledge graph query requested (handled by dedicated service)")
            return {"message": "Knowledge graph querying handled by dedicated service"}

        except Exception as e:
            logger.error(f"Error querying knowledge graph: {e}")
            return {"error": str(e)}
