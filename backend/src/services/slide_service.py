"""
Slide service for handling slide generation and processing
Rewritten with proper AI agentic approach and clear service boundaries
"""

import asyncio
import logging
import time
from typing import List, Dict, Optional, Any
from datetime import datetime
from pathlib import Path
import json
import re

from src.models.message_models import FileInfo, SlideData, ProcessingResult, ProcessingStatus
from src.services.file_service import FileService
from src.services.llm_service import LLMService
from src.services.ppt_service import PPTService
from src.services.ai_service import AIService
from src.services.research_service import ResearchService
from src.services.theme_service import ThemeService
from src.agents.content_creator_agent import ContentCreatorAgent

logger = logging.getLogger(__name__)


class SlideService:
    """
    Service for handling slide generation and processing
    Rewritten with clear responsibilities:
    - Content generation based on uploaded files and user description
    - Theme application for styling only (not content)
    - Proper AI agentic workflow
    """

    def __init__(self):
        self.file_service = FileService()
        self.llm_service = LLMService()
        self.ppt_service = PPTService()
        self.ai_service = AIService()
        self.research_service = ResearchService()
        self.theme_service = ThemeService()
        self.content_creator_agent = ContentCreatorAgent()

        # Client data storage with clear separation
        self.client_descriptions: Dict[str, str] = {}
        self.client_themes: Dict[str, Dict] = {}
        self.client_content: Dict[str, List[Dict]] = {}
        self.client_parsed_documents: Dict[str, List[Dict]] = {}
        self.client_content_plans: Dict[str, Dict] = {}
        self.processing_results: Dict[str, ProcessingResult] = {}

    async def store_slide_description(self, client_id: str, description: str) -> bool:
        """Store slide description for a client"""
        try:
            self.client_descriptions[client_id] = description
            logger.info(f"Stored slide description for client {client_id}")
            return True
        except Exception as e:
            logger.error(
                f"Error storing slide description for client {client_id}: {e}")
            return False

    async def store_parsed_document_content(self, client_id: str, filename: str, parsed_content: Dict[str, Any]) -> bool:
        """Store parsed document content from LangChain parser"""
        try:
            if client_id not in self.client_parsed_documents:
                self.client_parsed_documents[client_id] = []

            # Add metadata for tracking
            parsed_content_with_metadata = {
                **parsed_content,
                "stored_at": datetime.now().isoformat(),
                "client_id": client_id,
                "filename": filename
            }

            self.client_parsed_documents[client_id].append(
                parsed_content_with_metadata)
            logger.info(
                f"Stored parsed document content for {filename} (client: {client_id})")
            return True
        except Exception as e:
            logger.error(f"Error storing parsed document content: {e}")
            return False

    def get_parsed_documents(self, client_id: str) -> List[Dict[str, Any]]:
        """Get parsed document content for a client"""
        return self.client_parsed_documents.get(client_id, [])

    def get_formatted_document_content_for_generation(self, client_id: str) -> str:
        """Get formatted document content for slide generation prompts"""
        parsed_docs = self.get_parsed_documents(client_id)
        if not parsed_docs:
            return ""

        formatted_content = []
        for doc in parsed_docs:
            # Extract the actual content from the parsed document
            # Document parser returns 'full_text', fallback to 'content' for backward compatibility
            content = doc.get('full_text', doc.get('content', ''))
            if isinstance(content, str) and content.strip():
                formatted_content.append(
                    f"=== {doc.get('filename', 'Unknown')} ===\n{content}")
            elif isinstance(content, list):
                # Handle case where content is a list of chunks
                for chunk in content:
                    if isinstance(chunk, dict):
                        chunk_content = chunk.get(
                            'text', chunk.get('content', ''))
                        if chunk_content:
                            formatted_content.append(chunk_content)
                    elif isinstance(chunk, str):
                        formatted_content.append(chunk)

        return "\n\n" + "="*80 + "\n\n".join(formatted_content)

    async def get_slide_description(self, client_id: str) -> Optional[str]:
        """Get stored slide description for a client"""
        return self.client_descriptions.get(client_id)

    async def store_file_content(self, client_id: str, file_path: str, filename: str) -> bool:
        """Store file content for a client"""
        try:
            # Extract content from file
            content_info = await self.file_service.extract_content_from_file(file_path)
            content = content_info.get('text', '') if content_info else ''

            if client_id not in self.client_content:
                self.client_content[client_id] = []

            file_info = {
                "filename": filename,
                "file_path": file_path,
                "content": content,
                "stored_at": datetime.now().isoformat()
            }

            self.client_content[client_id].append(file_info)
            logger.info(
                f"Stored content from file {filename} for client {client_id}")
            return True
        except Exception as e:
            logger.error(f"Error storing file content: {e}")
            return False

    async def get_extracted_content(self, client_id: str) -> List[Dict[str, Any]]:
        """Get extracted content for a client"""
        return self.client_content.get(client_id, [])

    async def store_theme_selection(self, client_id: str, theme_data: Dict[str, Any]) -> bool:
        """Store theme selection for a client"""
        try:
            # Store only theme styling information, not content
            theme_info = {
                "theme_id": theme_data.get("theme_id"),
                "theme_name": theme_data.get("theme_name"),
                "color_palette": theme_data.get("color_palette", []),
                "font_family": theme_data.get("font_family", "Arial, sans-serif"),
                "layout_style": theme_data.get("layout_style", "structured"),
                "selected_at": datetime.now().isoformat()
            }

            self.client_themes[client_id] = theme_info
            logger.info(
                f"Stored theme selection for client {client_id}: {theme_data.get('theme_id')}")
            return True
        except Exception as e:
            logger.error(f"Error storing theme selection: {e}")
            return False

    async def get_theme_selection(self, client_id: str) -> Optional[Dict[str, Any]]:
        """Get stored theme selection for a client"""
        return self.client_themes.get(client_id)

    async def generate_slides(
        self,
        client_id: str,
        description: str,
        theme: str,
        wants_research: bool = False,
        use_ai_agent: bool = False,
        content_style: str = "professional",
        status_callback=None
    ) -> Dict[str, Any]:
        """
        Generate slides using AI agentic approach
        Key changes:
        1. Content generation based ONLY on uploaded files and user description
        2. Theme used only for styling, not content
        3. Proper AI workflow with clear separation of concerns
        """
        start_time = datetime.now()

        try:
            logger.info(
                f"Starting AI-powered slide generation for client {client_id}")

            if status_callback:
                await status_callback("Starting slide generation process...", 5)

            # Get stored content from uploaded files
            parsed_documents = self.get_parsed_documents(client_id)
            if not parsed_documents:
                raise Exception(
                    "No uploaded content found for slide generation")

            if status_callback:
                await status_callback("Retrieving stored content...", 10)

            # Get theme information for styling only
            theme_info = await self.get_theme_selection(client_id)
            if not theme_info:
                # Use default theme if none selected
                theme_info = {
                    "theme_id": "default",
                    "theme_name": "Default",
                    "color_palette": ["#2E86AB", "#A23B72", "#F18F01"],
                    "font_family": "Arial, sans-serif",
                    "layout_style": "structured"
                }

            if status_callback:
                await status_callback("Combining content from all files...", 40)

            # Combine content from all uploaded files
            combined_content = self.get_formatted_document_content_for_generation(
                client_id)
            if not combined_content.strip():
                raise Exception(
                    "No usable content extracted from uploaded files")

            if status_callback:
                await status_callback("Generating slide layout with AI...", 50)

            # Generate slide layout using AI (content-based, not theme-based)
            layout = await self.llm_service.generate_slide_layout(
                content=combined_content,
                description=description,
                theme="default",  # Don't pass theme info to content generation
                has_images=False,
                theme_info=None  # Don't pass theme info to content generation
            )

            if status_callback:
                await status_callback("Creating slide content with AI...", 60)

            # Generate slide content using appropriate method
            if use_ai_agent:
                # Use content creator agent for enhanced content generation
                if status_callback:
                    await status_callback("Using AI agent for enhanced content creation...", 65)

                content = await self.content_creator_agent.create_content(
                    uploaded_content=combined_content,
                    user_description=description,
                    theme_info=None,  # Theme is for styling only
                    research_data=None,  # No external research in this flow
                    use_ai_agent=True,
                    content_style=content_style
                )

                # Validate content quality
                quality_result = await self.content_creator_agent.validate_content_quality(
                    content, description
                )

                if not quality_result["is_acceptable"]:
                    logger.warning(
                        f"Content quality below threshold: {quality_result['feedback']}")
                    if status_callback:
                        await status_callback("Content quality validation completed with warnings", 67)
            else:
                # Use basic LLM service for content generation
                content = await self.llm_service.generate_slide_content(
                    content=combined_content,
                    description=description,
                    layout=layout,
                    theme_info=None  # Don't pass theme info to content generation
                )

            if status_callback:
                await status_callback("Creating PowerPoint presentation...", 75)

            # Generate PPT file
            ppt_file_path = await self._generate_ppt_file(
                client_id, layout, content, theme_info, description
            )

            if status_callback:
                await status_callback("Generating HTML preview...", 85)

            # Generate HTML preview
            html_content = await self._generate_html_preview(
                layout, content, theme_info, wants_research
            )

            if status_callback:
                await status_callback("Saving files...", 90)

            # Save HTML content
            html_file_path = await self._save_html_to_client_folder(
                html_content, description, client_id
            )

            if status_callback:
                await status_callback("Finalizing slide generation...", 95)

            processing_time = (datetime.now() - start_time).total_seconds()

            if status_callback:
                await status_callback("Slide generation completed!", 100)

            result = {
                "slide_html": html_content,
                "html_file_path": html_file_path,
                "ppt_file_path": ppt_file_path,
                "processing_time": processing_time,
                "theme": theme,
                "wants_research": wants_research,
                "use_ai_agent": use_ai_agent,
                "content_style": content_style,
                "status": "success"
            }

            logger.info(
                f"Slide generation completed in {processing_time:.2f} seconds")
            return result

        except Exception as e:
            processing_time = (datetime.now() - start_time).total_seconds()
            logger.error(f"Error in slide generation: {e}")

            return {
                "error": str(e),
                "processing_time": processing_time,
                "status": "error"
            }

    async def generate_content_plan(
        self,
        client_id: str,
        description: str,
        research_data: Optional[str] = None,
        theme: str = "default"
    ) -> Dict[str, Any]:
        """
        Generate content plan using AI
        Content plan is based ONLY on uploaded files and user description
        Theme is used only for styling suggestions, not content generation
        """
        try:
            logger.info(f"Generating content plan for client {client_id}")

            # Get parsed documents for context
            parsed_documents = self.get_parsed_documents(client_id)
            if not parsed_documents:
                raise Exception(
                    "No uploaded content found for content planning")

            # Get theme info for styling suggestions only
            theme_info = await self.get_theme_selection(client_id)

            # Generate content plan using AI service
            content_plan_result = await self.ai_service.generate_content_plan(
                description=description,
                research_data=research_data,
                theme=theme,
                uploaded_files=parsed_documents,
                theme_info=theme_info  # For styling suggestions only
            )

            # Store the content plan
            self.client_content_plans[client_id] = content_plan_result

            logger.info(
                f"Content plan generated successfully for client {client_id}")
            return content_plan_result

        except Exception as e:
            logger.error(
                f"Error generating content plan for client {client_id}: {e}")
            raise

    async def _generate_ppt_file(
        self,
        client_id: str,
        layout: Dict[str, Any],
        content: Dict[str, Any],
        theme_info: Dict[str, Any],
        description: str
    ) -> str:
        """Generate PPT file using the PPT service"""
        try:
            # Create PPT with content and theme styling
            # Generate output path for the PPT file
            output_dir = Path(f"outputs/client_{client_id}")
            output_dir.mkdir(parents=True, exist_ok=True)
            output_path = output_dir / f"slide_{int(time.time())}.pptx"

            ppt_file_path = await self.ppt_service.generate_ppt_from_layout(
                layout=layout,
                content=content,
                output_path=str(output_path),
                theme=theme_info.get(
                    "name", "default") if theme_info else "default"
            )

            logger.info(f"PPT file generated: {ppt_file_path}")
            return ppt_file_path
        except Exception as e:
            logger.error(f"Error generating PPT file: {e}")
            raise

    async def _generate_html_preview(
        self,
        layout: Dict[str, Any],
        content: Dict[str, Any],
        theme_info: Dict[str, Any],
        wants_research: bool
    ) -> str:
        """Generate HTML preview using AI"""
        try:
            # Generate HTML using LLM with proper content focus
            html_content = await self.llm_service.generate_slide_html(
                layout=layout,
                content=content,
                theme="default",  # Don't pass theme to content generation
                wants_research=wants_research,
                theme_info=theme_info  # Pass theme info for styling only
            )

            if not html_content:
                raise Exception("Failed to generate HTML content")

            # Clean up the HTML content
            html_content = self._clean_html_content(html_content)

            logger.info(f"✅ Generated HTML using LLM successfully")
            return html_content

        except Exception as e:
            logger.error(f"Error generating HTML with LLM: {e}")
            return await self._generate_html_fallback(layout, content, theme_info, wants_research)

    def _clean_html_content(self, html_content: str) -> str:
        """Clean and validate HTML content"""
        try:
            # Remove markdown code blocks if present
            if html_content.startswith("```html"):
                html_content = html_content[7:]
            if html_content.endswith("```"):
                html_content = html_content[:-3]

            # Validate HTML content
            if len(html_content) > 50000:  # 50KB limit
                logger.warning(
                    f"HTML content too large ({len(html_content)} chars), truncating")
                html_content = html_content[:50000]

            # Basic HTML validation
            if not html_content.strip():
                logger.error("Empty HTML content generated")
                return self._generate_error_html()

            if not ('<' in html_content and '>' in html_content):
                logger.error("Invalid HTML content - missing tags")
                return self._generate_error_html()

            # Sanitize HTML content
            html_content = re.sub(
                r'<script[^>]*>.*?</script>', '', html_content, flags=re.DOTALL | re.IGNORECASE)
            html_content = re.sub(
                r'\s+on\w+\s*=\s*["\'][^"\']*["\']', '', html_content, flags=re.IGNORECASE)
            html_content = re.sub(r'javascript:', '',
                                  html_content, flags=re.IGNORECASE)

            return html_content

        except Exception as e:
            logger.error(f"Error cleaning HTML content: {e}")
            return self._generate_error_html()

    async def _generate_html_fallback(
        self,
        layout: Dict[str, Any],
        content: Dict[str, Any],
        theme_info: Dict[str, Any],
        wants_research: bool
    ) -> str:
        """Generate HTML using fallback method"""
        try:
            # Extract title from layout
            title = layout.get("title", "Generated Slide")

            # Get theme styles for styling only
            theme_styles = self._get_theme_styles(theme_info)

            # Generate content sections from the layout
            content_sections = self._generate_content_sections(layout, content)

            # Create the HTML slide
            slide_html = self._create_html_slide(
                title, content_sections, theme_styles, wants_research)

            return slide_html

        except Exception as e:
            logger.error(f"Error generating fallback HTML: {e}")
            return self._generate_error_html()

    def _get_theme_styles(self, theme_info: Dict[str, Any]) -> Dict[str, str]:
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

    def _generate_content_sections(self, layout: Dict[str, Any], content: Dict[str, Any]) -> str:
        """Generate content sections from layout and content"""
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

        return content_sections

    def _create_html_slide(self, title: str, content_sections: str, theme_styles: Dict[str, str], wants_research: bool) -> str:
        """Create HTML slide with theme styling"""
        # Add research indicator if enabled
        research_indicator = ""
        if wants_research:
            research_indicator = """
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
                    {research_indicator}
                </div>
                
                <div style="position: absolute; bottom: 20px; right: 60px; font-size: 12px; opacity: 0.7;">
                    Created with SlideFlip AI
                </div>
            </div>
        </div>
        """

        return slide_html

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

    async def _save_html_to_client_folder(self, html_content: str, description: str, client_id: str) -> str:
        """Save HTML content to client folder"""
        try:
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            filename = f"slide_{timestamp}_{description[:20].replace(' ', '_')}.html"

            # Create client folder if it doesn't exist
            client_folder = f"uploads/client_{client_id}"
            await self.file_service.ensure_client_folder(client_id)

            # Save HTML file
            file_path = f"{client_folder}/{filename}"
            await self.file_service.save_text_file(file_path, html_content)

            logger.info(f"HTML content saved to client folder: {file_path}")
            return file_path

        except Exception as e:
            logger.error(f"Error saving HTML to client folder: {e}")
            raise

    # Additional utility methods for backward compatibility
    async def get_content_plan(self, client_id: str) -> Optional[Dict[str, Any]]:
        """Get stored content plan for a client"""
        return self.client_content_plans.get(client_id)

    async def store_research_data(self, client_id: str, research_data: Dict[str, Any]) -> bool:
        """Store research data for a client"""
        try:
            # This method is kept for backward compatibility but research is now handled differently
            logger.info(
                f"Research data storage requested for client {client_id} (handled by research service)")
            return True
        except Exception as e:
            logger.error(f"Error storing research data: {e}")
            return False

    async def get_research_data(self, client_id: str) -> Optional[Dict[str, Any]]:
        """Get stored research data for a client"""
        # This method is kept for backward compatibility
        return None
