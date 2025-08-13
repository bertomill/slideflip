"""
Slide service for handling slide generation and processing

This service acts as the main orchestrator for slide creation, handling:
- File content extraction and storage
- Theme selection and application
- AI-powered slide generation
- Research data integration
- Content planning and refinement
- HTML and PowerPoint file generation

Frontend Integration Points:
- WebSocket status callbacks for real-time progress updates
- Theme selection storage for consistent styling
- Client-specific data management for session persistence
- Error handling with user-friendly messages
"""

import asyncio
import logging
from typing import List, Dict, Optional, Any
from datetime import datetime
import json
import re

from src.models.message_models import FileInfo, SlideData, ProcessingResult, ProcessingStatus
from src.services.file_service import FileService
from src.services.llm_service import LLMService
from src.services.ppt_service import PPTService
from src.services.ai_service import AIService
from src.services.research_service import ResearchService
from src.services.theme_service import ThemeService

logger = logging.getLogger(__name__)


class SlideService:
    """
    Main service for slide generation and processing
    
    Frontend Integration Notes:
    - All async methods support WebSocket status callbacks for real-time updates
    - Client data is stored in memory dictionaries (consider Redis for production)
    - Methods return structured data suitable for JSON serialization
    - Error handling provides user-friendly messages for UI display
    """

    def __init__(self):
        # Initialize all service dependencies
        self.file_service = FileService()
        self.llm_service = LLMService()
        self.ppt_service = PPTService()
        self.ai_service = AIService()
        self.research_service = ResearchService()
        self.theme_service = ThemeService()
        
        # In-memory storage for client data (Frontend: Consider implementing cleanup for memory management)
        self.client_descriptions: Dict[str, str] = {}  # User-provided slide descriptions
        self.client_themes: Dict[str, Dict] = {}  # Selected theme data with colors and styling
        self.client_content: Dict[str, List[Dict]] = {}  # Extracted file content (text + images)
        self.processing_results: Dict[str, ProcessingResult] = {}  # Generation results for download
        self.client_research_data: Dict[str, Dict] = {}  # External research data
        self.client_content_plans: Dict[str, Dict] = {}  # AI-generated content outlines

    async def store_slide_description(self, client_id: str, description: str) -> bool:
        """
        Store user's slide description for later use
        
        Frontend Usage:
        - Call this when user submits description in step 1
        - Returns boolean for success/error UI feedback
        - Description is used throughout the generation process
        """
        try:
            self.client_descriptions[client_id] = description
            logger.info(f"Stored slide description for client {client_id}")
            return True
        except Exception as e:
            logger.error(
                f"Error storing slide description for client {client_id}: {e}")
            return False

    async def get_slide_description(self, client_id: str) -> Optional[str]:
        """
        Retrieve stored slide description
        
        Frontend Usage:
        - Use for displaying user's original description in UI
        - Returns None if no description stored
        """
        return self.client_descriptions.get(client_id)

    async def store_theme_selection(self, client_id: str, theme_data) -> bool:
        """
        Store user's theme selection with full styling data
        
        Frontend Usage:
        - Call when user selects theme in theme selection step
        - Supports both ThemeMessage objects and plain dictionaries
        - Theme data includes colors, fonts, and styling preferences
        - Returns boolean for UI feedback
        """
        try:
            # Handle both ThemeMessage objects and dictionaries for flexible frontend integration
            if hasattr(theme_data, 'theme_id'):
                # ThemeMessage object from API
                theme_info = {
                    "theme_id": theme_data.theme_id,
                    "theme_name": theme_data.theme_name,
                    "theme_description": theme_data.theme_description,
                    "color_palette": theme_data.color_palette,
                    "preview_text": theme_data.preview_text
                }
            elif isinstance(theme_data, dict):
                # Dictionary from frontend form data
                theme_info = {
                    "theme_id": theme_data.get("theme_id"),
                    "theme_name": theme_data.get("theme_name"),
                    "theme_description": theme_data.get("theme_description"),
                    "color_palette": theme_data.get("color_palette", []),
                    "preview_text": theme_data.get("preview_text", "")
                }
            else:
                logger.error(
                    f"Invalid theme_data type for client {client_id}: {type(theme_data)}")
                return False

            # Validate required fields for frontend error handling
            if not theme_info["theme_id"] or not theme_info["theme_name"]:
                logger.error(
                    f"Missing required theme fields for client {client_id}")
                return False

            self.client_themes[client_id] = theme_info
            logger.info(
                f"Stored theme selection for client {client_id}: {theme_info['theme_id']}")
            return True
        except Exception as e:
            logger.error(
                f"Error storing theme selection for client {client_id}: {e}")
            return False

    async def get_theme_selection(self, client_id: str) -> Optional[Dict]:
        """
        Retrieve stored theme selection
        
        Frontend Usage:
        - Use for displaying selected theme in UI
        - Contains full theme data including color palette
        - Returns None if no theme selected
        """
        return self.client_themes.get(client_id)

    async def store_extracted_content(self, client_id: str, content_data: Dict) -> bool:
        """
        Store extracted content from uploaded files
        
        Frontend Usage:
        - Called automatically during file upload processing
        - Stores both text content and image data
        - Multiple files create multiple content entries
        - Returns boolean for UI feedback
        """
        try:
            if client_id not in self.client_content:
                self.client_content[client_id] = []

            self.client_content[client_id].append(content_data)
            logger.info(
                f"Stored extracted content for client {client_id}: {content_data.get('filename', 'unknown')}")
            return True
        except Exception as e:
            logger.error(
                f"Error storing extracted content for client {client_id}: {e}")
            return False

    async def get_extracted_content(self, client_id: str) -> List[Dict]:
        """
        Get all stored extracted content for a client
        
        Frontend Usage:
        - Use for displaying uploaded content summary
        - Returns list of content dictionaries with text and images
        - Each entry includes filename and file type
        """
        return self.client_content.get(client_id, [])

    async def get_client_files_content(self, client_id: str) -> List[Dict]:
        """
        Get content from all files uploaded by a client
        
        Frontend Usage:
        - Alternative to get_extracted_content that reads from file system
        - Includes file metadata for UI display
        - Used for content verification and preview
        """
        try:
            # Get all files for the client
            files = await self.file_service.get_client_files(client_id)
            content_list = []

            for file_info in files:
                # Extract content from each file
                content = await self.file_service.extract_content_from_file(file_info.file_path)
                if content:
                    content['file_info'] = file_info.model_dump()
                    content_list.append(content)

            return content_list
        except Exception as e:
            logger.error(
                f"Error getting client files content for {client_id}: {e}")
            return []

    # AI Integration Methods - Core slide generation functionality

    async def generate_slide_with_ai(
        self,
        client_id: str,
        description: str,
        theme: str,
        research_data: Optional[str] = None,
        content_plan: Optional[str] = None,
        user_feedback: Optional[str] = None,
        status_callback=None
    ) -> Dict[str, Any]:
        """
        Main AI-powered slide generation method with real-time progress updates
        
        Frontend Integration:
        - Primary method for slide generation (step 5: generate)
        - status_callback: WebSocket function for real-time progress (0-100%)
        - Returns complete slide data including HTML and file paths
        - Includes processing time for UI performance metrics
        - Error handling returns structured error data
        
        Progress Stages for UI:
        10% - Starting generation
        20% - Loading theme and content
        40% - AI processing
        80% - Finalizing
        100% - Complete
        """
        start_time = datetime.now()

        try:
            logger.info(
                f"Starting AI-powered slide generation for client {client_id}")

            # Progress update: Starting generation
            if status_callback:
                await status_callback("Starting AI-powered slide generation...", 10)

            # Get stored theme information for consistent styling
            theme_info = await self.theme_service.get_theme_selection(client_id)
            color_palette = theme_info.get(
                "color_palette", []) if theme_info else []

            # Progress update: Loading data
            if status_callback:
                await status_callback("Retrieving theme and content data...", 20)

            # Get stored content from previous upload steps
            parsed_documents = await self.get_extracted_content(client_id)

            # Progress update: AI processing
            if status_callback:
                await status_callback("Generating slide HTML with AI...", 40)

            # Main AI generation call - creates HTML content
            slide_html = await self.ai_service.generate_slide_html(
                description=description,
                theme=theme,
                research_data=research_data,
                content_plan=content_plan,
                user_feedback=user_feedback,
                color_palette=color_palette
            )

            # Progress update: Finalizing
            if status_callback:
                await status_callback("Finalizing slide generation...", 80)

            # Save HTML for download - creates file in client folder
            html_file_path = await self._save_html_to_client_folder(
                slide_html, description, client_id
            )

            processing_time = (datetime.now() - start_time).total_seconds()

            # Progress update: Complete
            if status_callback:
                await status_callback("Slide generation completed!", 100)

            # Return structured data for frontend consumption
            result = {
                "slide_html": slide_html,  # For preview display
                "html_file_path": html_file_path,  # For download link
                "processing_time": processing_time,  # For performance metrics
                "theme": theme,  # For UI confirmation
                "research_data": research_data,  # For user reference
                "content_plan": content_plan,  # For user reference
                "user_feedback": user_feedback,  # For user reference
                "color_palette": color_palette,  # For theme preview
                "status": "success"  # For UI state management
            }

            logger.info(
                f"AI-powered slide generation completed in {processing_time:.2f} seconds")
            return result

        except Exception as e:
            processing_time = (datetime.now() - start_time).total_seconds()
            logger.error(f"Error in AI-powered slide generation: {e}")

            # Return error data for frontend error handling
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
        Generate AI-powered content plan (step 4: content planning)
        
        Frontend Usage:
        - Called in content planning step before generation
        - Returns structured outline for user review and editing
        - Content plan is used in final slide generation
        - Throw exceptions for frontend error handling
        """
        try:
            logger.info(f"Generating content plan for client {client_id}")

            # Get parsed documents for AI context
            parsed_documents = await self.get_extracted_content(client_id)

            # AI service generates structured content outline
            content_plan_result = await self.ai_service.generate_content_plan(
                description=description,
                research_data=research_data,
                theme=theme,
                parsed_documents=parsed_documents
            )

            # Store for use in slide generation
            self.client_content_plans[client_id] = content_plan_result

            logger.info(
                f"Content plan generated successfully for client {client_id}")
            return content_plan_result

        except Exception as e:
            logger.error(
                f"Error generating content plan for client {client_id}: {e}")
            raise  # Re-raise for frontend error handling

    async def refine_content_plan(
        self,
        client_id: str,
        content_plan: str,
        user_feedback: str
    ) -> Dict[str, Any]:
        """
        Refine content plan based on user feedback
        
        Frontend Usage:
        - Called when user provides feedback on content plan
        - Allows iterative improvement before final generation
        - Returns updated content plan for UI display
        - Integrates user input for personalized results
        """
        try:
            logger.info(f"Refining content plan for client {client_id}")

            # Get original context for AI refinement
            original_description = await self.get_slide_description(client_id)

            # AI service refines plan based on feedback
            refined_plan = await self.ai_service.refine_content_plan(
                content_plan=content_plan,
                user_feedback=user_feedback,
                original_description=original_description or ""
            )

            # Update stored plan for final generation
            self.client_content_plans[client_id] = refined_plan

            logger.info(
                f"Content plan refined successfully for client {client_id}")
            return refined_plan

        except Exception as e:
            logger.error(
                f"Error refining content plan for client {client_id}: {e}")
            raise  # Re-raise for frontend error handling

    async def store_research_data(
        self,
        client_id: str,
        research_data: Dict[str, Any]
    ) -> bool:
        """
        Store research data from external sources (step 3: research)
        
        Frontend Usage:
        - Called when research step completes
        - Stores external data for content enhancement
        - Returns boolean for UI feedback
        """
        try:
            self.client_research_data[client_id] = research_data
            logger.info(f"Research data stored for client {client_id}")
            return True
        except Exception as e:
            logger.error(
                f"Error storing research data for client {client_id}: {e}")
            return False

    async def get_research_data(
        self,
        client_id: str
    ) -> Optional[Dict[str, Any]]:
        """
        Retrieve stored research data
        
        Frontend Usage:
        - Use for displaying research results in UI
        - Returns None if no research performed
        """
        return self.client_research_data.get(client_id)

    async def get_content_plan(
        self,
        client_id: str
    ) -> Optional[Dict[str, Any]]:
        """
        Retrieve stored content plan
        
        Frontend Usage:
        - Use for displaying content plan in UI
        - Returns None if no plan generated
        """
        return self.client_content_plans.get(client_id)

    async def store_file_content(self, client_id: str, file_path: str, filename: str) -> bool:
        """
        Extract and store content from a specific uploaded file
        
        Frontend Usage:
        - Called during file upload processing (step 1: upload)
        - Extracts text and images from various file formats
        - Returns boolean for upload success feedback
        - Content is used throughout the generation process
        """
        try:
            # Extract content using file service
            content = await self.file_service.extract_content_from_file(file_path)
            logger.info(f"Content: {content['text'][:100]}")
            if content:
                # Add client metadata for tracking
                content['client_id'] = client_id
                content['upload_time'] = datetime.now().isoformat()

                # Store for later use in generation
                await self.store_extracted_content(client_id, content)
                logger.info(
                    f"Stored content from file {filename} for client {client_id}")
                return True
            else:
                logger.warning(
                    f"No content extracted from file {filename} for client {client_id}")
                return False
        except Exception as e:
            logger.error(
                f"Error storing file content for client {client_id}, file {filename}: {e}")
            return False

    async def generate_slide_with_params(
        self,
        files: List[FileInfo],
        description: str,
        theme: str = "default",
        wants_research: bool = False,
        client_id: str = None,
        status_callback=None
    ) -> Dict:
        """
        Legacy slide generation method with parameters (maintains backward compatibility)
        
        Frontend Usage:
        - Alternative generation method for simple workflows
        - Generates both HTML and PowerPoint files
        - Includes detailed progress updates via status_callback
        - Returns comprehensive result data for UI display
        
        Progress Stages:
        5% - Starting process
        10-40% - File processing (varies by file count)
        50% - AI layout generation
        60% - AI content generation
        75% - PowerPoint creation
        85% - HTML generation
        90% - File saving
        95% - Finalizing
        """
        start_time = datetime.now()

        try:
            logger.info(
                f"Starting slide generation with {len(files)} files, theme: {theme}, research: {wants_research}")

            # Progress: Starting
            if status_callback:
                logger.info(
                    f"Calling status callback: Starting slide generation process... (5%)")
                await status_callback("Starting slide generation process...", 5)

            # Get or extract content based on client_id availability
            if client_id:
                # Use stored content for faster processing
                if status_callback:
                    logger.info(
                        f"Calling status callback: Retrieving stored content... (10%)")
                    await status_callback("Retrieving stored content...", 10)
                file_contents = await self.get_extracted_content(client_id)
                logger.info(
                    f"Using stored content for client {client_id}: {len(file_contents)} items")
            else:
                # Extract content from files (fallback for backward compatibility)
                if status_callback:
                    logger.info(
                        f"Calling status callback: Extracting content from uploaded files... (15%)")
                    await status_callback("Extracting content from uploaded files...", 15)
                file_contents = []
                for i, file_info in enumerate(files):
                    # Dynamic progress based on file count
                    if status_callback:
                        progress = 15 + (i * 5)
                        logger.info(
                            f"Calling status callback: Processing file {i+1}/{len(files)}: {file_info.filename} ({progress}%)")
                        await status_callback(f"Processing file {i+1}/{len(files)}: {file_info.filename}", progress)
                    content = await self.file_service.extract_text_from_file(file_info.file_path)
                    if content:
                        file_contents.append({
                            "filename": file_info.filename,
                            "content": content,
                            "file_type": file_info.file_type
                        })

            # Content processing for AI consumption
            if status_callback:
                logger.info(
                    f"Calling status callback: Combining content from all files... (40%)")
                await status_callback("Combining content from all files...", 40)
            
            # Combine content for AI processing
            combined_content = ""
            has_images = False

            for content in file_contents:
                if isinstance(content, dict):
                    # Handle different content formats
                    if 'text' in content:
                        combined_content += f"--- {content.get('file_name', 'unknown')} ---\n{content['text']}\n\n"
                    elif 'content' in content:
                        combined_content += f"--- {content.get('filename', 'unknown')} ---\n{content['content']}\n\n"

                    # Check for images for layout decisions
                    if 'images' in content and content['images']:
                        has_images = True
                else:
                    combined_content += f"--- Content ---\n{str(content)}\n\n"

            # AI layout generation
            if status_callback:
                logger.info(
                    f"Calling status callback: Generating slide layout with AI... (50%)")
                await status_callback("Generating slide layout with AI...", 50)
            logger.info("Generating slide layout using LLM...")

            # Get theme information for consistent styling
            theme_info = None
            if client_id:
                theme_info = await self.get_theme_selection(client_id)

            # Generate structured layout using AI
            layout = await self.llm_service.generate_slide_layout(
                combined_content,
                description,
                theme,
                has_images,
                theme_info
            )

            # AI content generation
            if status_callback:
                logger.info(
                    f"Calling status callback: Creating slide content with AI... (60%)")
                await status_callback("Creating slide content with AI...", 60)
            logger.info("Generating slide content using LLM...")
            
            # Generate detailed content for each layout section
            content = await self.llm_service.generate_slide_content(
                combined_content,
                description,
                layout,
                theme_info
            )

            # PowerPoint file generation
            if status_callback:
                logger.info(
                    f"Calling status callback: Creating PowerPoint presentation... (75%)")
                await status_callback("Creating PowerPoint presentation...", 75)
            logger.info("Generating PPT file...")
            ppt_file_path = await self._generate_ppt_file(
                file_contents,
                description,
                theme,
                wants_research,
                client_id
            )

            # HTML generation for preview
            if status_callback:
                logger.info(
                    f"Calling status callback: Generating HTML preview... (85%)")
                await status_callback("Generating HTML preview...", 85)
            logger.info("Generating HTML preview...")
            slide_html = await self._generate_html_from_layout(
                layout,
                content,
                theme,
                wants_research,
                theme_info
            )

            # File saving
            if status_callback:
                logger.info(f"Calling status callback: Saving files... (90%)")
                await status_callback("Saving files...", 90)
            html_file_path = None
            if client_id:
                html_file_path = await self._save_html_to_client_folder(
                    slide_html, description, client_id
                )

            # Finalizing
            if status_callback:
                logger.info(
                    f"Calling status callback: Finalizing slide generation... (95%)")
                await status_callback("Finalizing slide generation...", 95)

            processing_time = (datetime.now() - start_time).total_seconds()

            # Return comprehensive result data for frontend
            result = {
                "slide_html": slide_html,  # For preview display
                "html_file_path": html_file_path,  # For HTML download
                "ppt_file_path": ppt_file_path,  # For PowerPoint download
                "processing_time": processing_time,  # For performance metrics
                "files_processed": len(files),  # For user feedback
                "content_extracted": len(file_contents),  # For user feedback
                "theme": theme,  # For UI confirmation
                "wants_research": wants_research  # For UI state
            }

            logger.info(
                f"Slide generation completed in {processing_time:.2f} seconds")
            return result

        except Exception as e:
            processing_time = (datetime.now() - start_time).total_seconds()
            logger.error(f"Error generating slide: {e}")

            # Return error data for frontend error handling
            return {
                "error": str(e),
                "processing_time": processing_time,
                "status": "error"
            }

    async def _analyze_content_and_generate_slide(
        self,
        file_contents: List[Dict],
        description: str
    ) -> SlideData:
        """
        Legacy content analysis method (internal use)
        
        Note for Frontend: This is an internal method used by legacy workflows.
        Modern workflows use the AI service directly for better results.
        """
        try:
            # Handle both old and new content formats
            combined_content = ""
            total_images = 0

            for content in file_contents:
                if isinstance(content, dict):
                    # New format with text and images
                    if 'text' in content:
                        combined_content += f"--- {content.get('file_name', 'unknown')} ---\n{content['text']}\n\n"
                    elif 'content' in content:
                        # Old format with just content
                        combined_content += f"--- {content.get('filename', 'unknown')} ---\n{content['content']}\n\n"

                    # Count images for UI feedback
                    if 'images' in content:
                        total_images += len(content['images'])
                else:
                    # Fallback for string content
                    combined_content += f"--- Content ---\n{str(content)}\n\n"

            # Extract slide elements from description and content
            slide_title = self._extract_title_from_description(description)
            slide_theme = self._extract_theme_from_description(description)
            slide_layout = self._determine_layout(
                description, combined_content)

            # Generate slide elements for structured data
            elements = await self._generate_slide_elements(combined_content, description)

            # Add image summary if images found
            if total_images > 0:
                elements.append({
                    "type": "image_summary",
                    "content": f"Found {total_images} images in uploaded content",
                    "position": {"x": 50, "y": 90},
                    "style": {"fontSize": "12px", "color": "#666", "fontStyle": "italic"}
                })

            # Create structured slide data
            slide_data = SlideData(
                title=slide_title,
                content=combined_content[:1000] + "..." if len(
                    combined_content) > 1000 else combined_content,
                theme=slide_theme,
                layout=slide_layout,
                elements=elements
            )

            return slide_data

        except Exception as e:
            logger.error(f"Error analyzing content: {e}")
            # Return basic slide structure for error recovery
            return SlideData(
                title="Generated Slide",
                content="Content analysis failed",
                theme="default",
                layout="standard",
                elements=[]
            )

    async def _generate_html_from_layout(
        self,
        layout: Dict[str, Any],
        content: Dict[str, Any],
        theme: str = "default",
        wants_research: bool = False,
        theme_info: Optional[Dict] = None
    ) -> str:
        """
        Generate HTML content for preview display
        
        Frontend Integration:
        - Creates responsive HTML for slide preview
        - Applies theme styling and color palettes
        - Supports both AI-generated and fallback HTML
        - Returns ready-to-display HTML for iframe or div
        """
        try:
            # Use AI service for best results, fallback if unavailable
            if self.llm_service.is_available():
                return await self._generate_html_with_llm(layout, content, theme, wants_research, theme_info)
            else:
                return await self._generate_html_fallback(layout, content, theme, wants_research, theme_info)

        except Exception as e:
            logger.error(f"Error generating HTML from layout: {e}")
            return self._generate_error_html()

    async def _generate_html_with_llm(
        self,
        layout: Dict[str, Any],
        content: Dict[str, Any],
        theme: str,
        wants_research: bool,
        theme_info: Optional[Dict] = None
    ) -> str:
        """
        Generate professional HTML using AI with advanced styling
        
        Frontend Notes:
        - Creates production-ready HTML with embedded CSS
        - Includes modern design elements (gradients, shadows, animations)
        - Responsive design suitable for various screen sizes
        - Incorporates theme colors and styling preferences
        - Returns complete HTML document ready for display
        """
        try:
            # Build theme context for AI prompt
            theme_context = ""
            if theme_info:
                theme_context = f"""
THEME INFORMATION:
- Theme Name: {theme_info.get('theme_name', theme)}
- Theme Description: {theme_info.get('theme_description', '')}
- Color Palette: {', '.join(theme_info.get('color_palette', []))}
- Preview Text: {theme_info.get('preview_text', '')}

Please incorporate this theme's visual style, color palette, and design philosophy into the HTML design.
"""

            # Comprehensive AI prompt for professional slide generation
            system_prompt = """You are a senior frontend developer and UI/UX expert specializing in creating stunning, professional slide presentations in HTML and CSS. You have 10+ years of experience creating presentations for Fortune 500 companies, TED talks, and high-profile events.

Your task is to convert a slide layout and content into a beautiful, modern HTML slide that rivals the best presentation software.

DESIGN REQUIREMENTS:
- Create a slide with dimensions 1200px x 800px for better visibility
- Use modern CSS with advanced gradients, shadows, and smooth animations
- Implement professional typography with proper hierarchy
- Create visually stunning designs that match the theme perfectly
- Include interactive elements and hover effects
- Ensure excellent readability and visual appeal
- Use CSS Grid and Flexbox for responsive layouts
- Include subtle animations and transitions

THEME SUPPORT:
- Professional: Clean, corporate style with blue/gray color schemes
- Creative: Vibrant colors with artistic gradients and patterns
- Minimal: Clean, simple design with lots of white space
- Colorful: Bright, energetic colors with dynamic gradients
- Corporate: Formal, business-focused design
- Academic: Scholarly, research-oriented design
- Modern: Contemporary design with bold typography

HTML STRUCTURE REQUIREMENTS:
- Use semantic HTML5 elements
- Include proper meta tags and viewport settings
- Implement responsive design principles
- Use CSS custom properties for theming
- Include smooth animations and transitions
- Ensure accessibility standards are met

Return only the complete HTML code with embedded CSS, no explanations or markdown formatting."""

            user_prompt = f"""SLIDE DESIGN SPECIFICATIONS:

LAYOUT STRUCTURE:
{json.dumps(layout, indent=2)}

CONTENT DATA:
{json.dumps(content, indent=2)}

DESIGN PARAMETERS:
- Theme: {theme}
- Research Integration: {wants_research}
- Slide Dimensions: 1200px x 800px
{theme_context}

HTML GENERATION TASK:
Create a stunning, professional HTML slide that:
1. Accurately represents the layout structure and positioning
2. Displays all content sections with proper formatting
3. Implements the specified theme with beautiful styling
4. Uses modern CSS with gradients, shadows, and animations
5. Includes interactive elements and smooth transitions
6. Ensures excellent readability and visual hierarchy
7. Creates a memorable, engaging presentation experience

CONTENT FORMATTING REQUIREMENTS:
- Format bullet lists with proper styling and icons
- Style text sections with appropriate typography
- Create highlight boxes for key insights
- Format quotes with proper attribution styling
- Style timelines and process steps clearly
- Ensure all content is visually appealing and readable

Generate a complete, production-ready HTML slide that transforms this layout and content into a beautiful, professional presentation."""

            # Generate HTML using AI
            response = self.llm_service.client.chat.completions.create(
                model="gpt-4o",
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt}
                ],
                max_tokens=4000,
                temperature=0.8
            )

            html_content = response.choices[0].message.content.strip()

            # Log response for debugging
            logger.info(
                f"LLM HTML Response (first 500 chars): {html_content[:500]}...")
            logger.info(f"HTML content size: {len(html_content)} characters")

            # Clean up AI response to extract pure HTML
            if html_content.startswith("```html"):
                html_content = html_content[7:]
            if html_content.endswith("```"):
                html_content = html_content[:-3]

            # Validate and sanitize HTML for frontend security
            if len(html_content) > 50000:  # 50KB limit for performance
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

            # Security: Remove potentially harmful content for frontend safety
            html_content = re.sub(
                r'<script[^>]*>.*?</script>', '', html_content, flags=re.DOTALL | re.IGNORECASE)
            html_content = re.sub(
                r'\s+on\w+\s*=\s*["\'][^"\']*["\']', '', html_content, flags=re.IGNORECASE)
            html_content = re.sub(r'javascript:', '',
                                  html_content, flags=re.IGNORECASE)

            logger.info("✅ Generated HTML using LLM successfully")
            return html_content

        except Exception as e:
            logger.error(f"Error generating HTML with LLM: {e}")
            return await self._generate_html_fallback(layout, content, theme, wants_research, theme_info)

    async def _generate_html_fallback(
        self,
        layout: Dict[str, Any],
        content: Dict[str, Any],
        theme: str,
        wants_research: bool,
        theme_info: Optional[Dict] = None
    ) -> str:
        """
        Fallback HTML generation when AI is unavailable
        
        Frontend Notes:
        - Creates basic but professional HTML slides
        - Uses predefined theme styles and layouts
        - Incorporates stored theme colors if available
        - Ensures consistent visual presentation
        - Reliable backup for AI service failures
        """
        try:
            # Extract basic slide information
            title = layout.get("title", "Generated Slide")

            # Get base theme styles
            theme_styles = self._get_theme_styles(theme)
            
            # Override with stored theme information if available
            if theme_info:
                color_palette = theme_info.get('color_palette', [])
                if color_palette:
                    # Apply custom color palette from theme selection
                    primary_color = color_palette[0]
                    secondary_color = color_palette[1] if len(
                        color_palette) > 1 else primary_color
                    accent_color = color_palette[2] if len(
                        color_palette) > 2 else secondary_color

                    theme_styles = {
                        'background': f'background: linear-gradient(135deg, {primary_color} 0%, {secondary_color} 100%);',
                        'text_color': 'white',
                        'overlay': f'background: linear-gradient(45deg, {accent_color} 0%, transparent 100%);',
                        'content_bg': 'rgba(255,255,255,0.15)',
                        'title_style': f'color: {primary_color};'
                    }

            # Generate content sections from layout structure
            content_sections = ""
            sections = layout.get("sections", [])

            for i, section in enumerate(sections):
                section_content = content.get(f"section_{i}", {})
                section_text = section_content.get(
                    "content", "Content not available")

                # Format different content types
                if section.get("type") == "bullet_list":
                    # Create styled bullet list
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
                    # Regular text content with styling
                    content_sections += f"""
                    <div style="margin-bottom: 20px; padding: 15px; background: rgba(255,255,255,0.1); border-radius: 10px;">
                        <p style="margin: 0; line-height: 1.6;">{section_text}</p>
                    </div>
                    """

            # Add research indicator if research was requested
            if wants_research:
                content_sections += """
                <div style="margin-top: 20px; padding: 10px; background: rgba(245, 158, 11, 0.2); border-radius: 8px; border-left: 4px solid #f59e0b;">
                    <p style="margin: 0; font-size: 14px; color: #f59e0b;">
                        <strong>🔍 Enhanced with AI Research</strong>
                    </p>
                </div>
                """

            # Create complete HTML slide with modern styling
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

            return slide_html

        except Exception as e:
            logger.error(f"Error generating fallback HTML: {e}")
            return self._generate_error_html()

    def _generate_error_html(self) -> str:
        """
        Generate error slide for frontend display
        
        Frontend Usage:
        - Displays when slide generation fails
        - Provides user-friendly error message
        - Maintains consistent visual design
        """
        return """
        <div style="width: 800px; height: 600px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 60px; color: white; font-family: 'Arial', sans-serif; display: flex; align-items: center; justify-content: center; border-radius: 15px;">
            <div style="text-align: center;">
                <h1 style="font-size: 36px; margin-bottom: 20px;">Slide Generation Error</h1>
                <p style="font-size: 18px;">Unable to generate slide content. Please try again.</p>
            </div>
        </div>
        """

    def _extract_title_from_description(self, description: str) -> str:
        """Extract slide title from user description (internal utility)"""
        words = description.split()
        if len(words) >= 3:
            title = " ".join(words[:5])
            return title.title()
        return "Generated Slide"

    def _extract_theme_from_description(self, description: str) -> str:
        """Extract theme preference from description (internal utility)"""
        description_lower = description.lower()

        if any(word in description_lower for word in ["professional", "business", "corporate"]):
            return "professional"
        elif any(word in description_lower for word in ["creative", "modern", "design"]):
            return "creative"
        elif any(word in description_lower for word in ["minimal", "simple", "clean"]):
            return "minimal"
        elif any(word in description_lower for word in ["colorful", "vibrant", "bright"]):
            return "colorful"
        else:
            return "default"

    def _determine_layout(self, description: str, content: str) -> str:
        """Determine slide layout from content analysis (internal utility)"""
        description_lower = description.lower()
        content_lower = content.lower()

        # Analyze content for layout suggestions
        if any(word in description_lower for word in ["chart", "graph", "data", "statistics"]):
            return "data_visualization"
        elif any(word in description_lower for word in ["timeline", "process", "steps"]):
            return "timeline"
        elif any(word in description_lower for word in ["comparison", "compare", "versus"]):
            return "comparison"
        elif any(word in description_lower for word in ["list", "bullets", "points"]):
            return "list"
        else:
            return "standard"

    async def _generate_slide_elements(self, content: str, description: str) -> List[Dict]:
        """Generate structured slide elements for legacy support (internal utility)"""
        elements = []

        try:
            # Process content into structured elements
            paragraphs = [p.strip()
                          for p in content.split('\n\n') if p.strip()]

            # Title element
            title = self._extract_title_from_description(description)
            elements.append({
                "type": "title",
                "content": title,
                "position": {"x": 50, "y": 10},
                "style": {"fontSize": "24px", "fontWeight": "bold"}
            })

            # Content elements with positioning
            y_position = 80
            for i, paragraph in enumerate(paragraphs[:5]):  # Limit to 5 paragraphs
                if len(paragraph) > 200:
                    paragraph = paragraph[:200] + "..."

                elements.append({
                    "type": "text",
                    "content": paragraph,
                    "position": {"x": 50, "y": y_position},
                    "style": {"fontSize": "14px", "lineHeight": "1.5"}
                })
                y_position += 60

            # Summary element for long content
            if len(content) > 500:
                summary = f"Summary: {len(paragraphs)} key points extracted from uploaded documents"
                elements.append({
                    "type": "summary",
                    "content": summary,
                    "position": {"x": 50, "y": y_position + 20},
                    "style": {"fontSize": "12px", "fontStyle": "italic", "color": "#666"}
                })

        except Exception as e:
            logger.error(f"Error generating slide elements: {e}")
            # Basic fallback element
            elements.append({
                "type": "text",
                "content": "Content processing completed",
                "position": {"x": 50, "y": 50},
                "style": {"fontSize": "16px"}
            })

        return elements

    async def get_processing_result(self, client_id: str) -> Optional[ProcessingResult]:
        """
        Get processing result for download links
        
        Frontend Usage:
        - Retrieve generation results for download page
        - Contains file paths and metadata
        """
        return self.processing_results.get(client_id)

    async def store_processing_result(self, client_id: str, result: ProcessingResult) -> bool:
        """
        Store processing result for later retrieval
        
        Frontend Usage:
        - Called after successful generation
        - Enables download functionality
        """
        try:
            self.processing_results[client_id] = result
            return True
        except Exception as e:
            logger.error(
                f"Error storing processing result for client {client_id}: {e}")
            return False

    async def clear_client_data(self, client_id: str) -> bool:
        """
        Clear all client data for privacy and memory management
        
        Frontend Usage:
        - Call when user session ends or starts new project
        - Clears all stored data and uploaded files
        - Returns boolean for UI feedback
        """
        try:
            # Clear all in-memory data
            if client_id in self.client_descriptions:
                del self.client_descriptions[client_id]

            if client_id in self.client_content:
                del self.client_content[client_id]

            if client_id in self.processing_results:
                del self.processing_results[client_id]

            # Clear uploaded files from file system
            await self.file_service.delete_client_files(client_id)

            logger.info(f"Cleared all data for client {client_id}")
            return True
        except Exception as e:
            logger.error(f"Error clearing data for client {client_id}: {e}")
            return False

    def get_service_stats(self) -> Dict:
        """
        Get service statistics for monitoring and analytics
        
        Frontend Usage:
        - Display service health and usage statistics
        - Monitor active sessions and performance
        """
        return {
            "active_clients": len(self.client_descriptions),
            "processing_results": len(self.processing_results),
            "total_descriptions_stored": len(self.client_descriptions),
            "total_results_stored": len(self.processing_results)
        }

    async def get_client_content_stats(self, client_id: str) -> Dict:
        """
        Get detailed content statistics for a client
        
        Frontend Usage:
        - Display upload summary and content analysis
        - Show file counts, types, and processing status
        - Provide user feedback on uploaded content
        """
        try:
            content_list = await self.get_extracted_content(client_id)

            # Calculate statistics
            total_files = len(content_list)
            total_text_length = sum(len(content.get('text', ''))
                                    for content in content_list)
            total_images = sum(len(content.get('images', []))
                               for content in content_list)

            # Analyze file types for UI display
            file_types = {}
            for content in content_list:
                file_name = content.get('file_name', 'unknown')
                file_ext = file_name.split(
                    '.')[-1].lower() if '.' in file_name else 'unknown'
                file_types[file_ext] = file_types.get(file_ext, 0) + 1

            return {
                "client_id": client_id,
                "total_files": total_files,
                "total_text_length": total_text_length,
                "total_images": total_images,
                "file_types": file_types,
                "has_description": client_id in self.client_descriptions,
                "description_length": len(self.client_descriptions.get(client_id, ''))
            }
        except Exception as e:
            logger.error(
                f"Error getting content stats for client {client_id}: {e}")
            return {
                "client_id": client_id,
                "error": str(e)
            }

    def _get_theme_styles(self, theme: str) -> Dict[str, str]:
        """
        Get CSS styles for different theme presets
        
        Frontend Reference:
        - Predefined theme styles for consistent design
        - Each theme includes background, colors, and styling
        - Used by fallback HTML generation
        """
        themes = {
            "professional": {
                "background": "background: linear-gradient(135deg, #2c3e50 0%, #34495e 100%)",
                "text_color": "white",
                "title_style": "color: #ecf0f1;",
                "subtitle_color": "#bdc3c7",
                "content_bg": "rgba(255,255,255,0.1)",
                "overlay": "background: url('data:image/svg+xml,<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 100 100\"><defs><pattern id=\"grain\" width=\"100\" height=\"100\" patternUnits=\"userSpaceOnUse\"><circle cx=\"25\" cy=\"25\" r=\"1\" fill=\"white\" opacity=\"0.1\"/><circle cx=\"75\" cy=\"75\" r=\"1\" fill=\"white\" opacity=\"0.1\"/></pattern></defs><rect width=\"100\" height=\"100\" fill=\"url(%23grain)\"/></svg>')"
            },
            "creative": {
                "background": "background: linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                "text_color": "white",
                "title_style": "color: #f0f0f0;",
                "subtitle_color": "#e0e0e0",
                "content_bg": "rgba(255,255,255,0.1)",
                "overlay": "background: url('data:image/svg+xml,<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 100 100\"><defs><pattern id=\"grain\" width=\"100\" height=\"100\" patternUnits=\"userSpaceOnUse\"><circle cx=\"25\" cy=\"25\" r=\"1\" fill=\"white\" opacity=\"0.1\"/><circle cx=\"75\" cy=\"75\" r=\"1\" fill=\"white\" opacity=\"0.1\"/></pattern></defs><rect width=\"100\" height=\"100\" fill=\"url(%23grain)\"/></svg>')"
            },
            "minimal": {
                "background": "background: #ffffff",
                "text_color": "#333333",
                "title_style": "color: #2c3e50;",
                "subtitle_color": "#7f8c8d",
                "content_bg": "rgba(236,240,241,0.8)",
                "overlay": "background: none"
            },
            "colorful": {
                "background": "background: linear-gradient(135deg, #ff6b6b 0%, #4ecdc4 100%)",
                "text_color": "white",
                "title_style": "color: #f0f0f0;",
                "subtitle_color": "#e0e0e0",
                "content_bg": "rgba(255,255,255,0.15)",
                "overlay": "background: url('data:image/svg+xml,<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 100 100\"><defs><pattern id=\"grain\" width=\"100\" height=\"100\" patternUnits=\"userSpaceOnUse\"><circle cx=\"25\" cy=\"25\" r=\"1\" fill=\"white\" opacity=\"0.1\"/><circle cx=\"75\" cy=\"75\" r=\"1\" fill=\"white\" opacity=\"0.1\"/></pattern></defs><rect width=\"100\" height=\"100\" fill=\"url(%23grain)\"/></svg>')"
            },
            "default": {
                "background": "background: linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                "text_color": "white",
                "title_style": "color: #f0f0f0;",
                "subtitle_color": "#e0e0e0",
                "content_bg": "rgba(255,255,255,0.1)",
                "overlay": "background: url('data:image/svg+xml,<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 100 100\"><defs><pattern id=\"grain\" width=\"100\" height=\"100\" patternUnits=\"userSpaceOnUse\"><circle cx=\"25\" cy=\"25\" r=\"1\" fill=\"white\" opacity=\"0.1\"/><circle cx=\"75\" cy=\"75\" r=\"1\" fill=\"white\" opacity=\"0.1\"/></pattern></defs><rect width=\"100\" height=\"100\" fill=\"url(%23grain)\"/></svg>')"
            }
        }

        return themes.get(theme, themes["default"])

    def _generate_content_sections(self, content: str, wants_research: bool) -> str:
        """
        Generate HTML content sections with styling (internal utility)
        
        Frontend Notes:
        - Creates styled bullet points and content sections
        - Includes research indicators when applicable
        - Returns HTML string for embedding in slides
        """
        try:
            # Process content into bullet points
            paragraphs = [p.strip()
                          for p in content.split('\n\n') if p.strip()]

            bullet_points = []

            # Document analysis bullet point
            bullet_points.append(
                '<li style="margin-bottom: 15px; padding-left: 25px; position: relative;">'
                '<span style="position: absolute; left: 0; top: 5px; width: 8px; height: 8px; background: #4ade80; border-radius: 50%;"></span>'
                f'Document analysis reveals {len(paragraphs)} key insights'
                '</li>'
            )

            # Theme application bullet point
            bullet_points.append(
                '<li style="margin-bottom: 15px; padding-left: 25px; position: relative;">'
                '<span style="position: absolute; left: 0; top: 5px; width: 8px; height: 8px; background: #60a5fa; border-radius: 50%;"></span>'
                'Professional theme applied for optimal impact'
                '</li>'
            )

            # Research enhancement bullet point
            if wants_research:
                bullet_points.append(
                    '<li style="margin-bottom: 15px; padding-left: 25px; position: relative;">'
                    '<span style="position: absolute; left: 0; top: 5px; width: 8px; height: 8px; background: #f59e0b; border-radius: 50%;"></span>'
                    'Enhanced with AI research insights'
                    '</li>'
                )

            # Content summary bullet point
            if len(content) > 500:
                bullet_points.append(
                    '<li style="margin-bottom: 15px; padding-left: 25px; position: relative;">'
                    '<span style="position: absolute; left: 0; top: 5px; width: 8px; height: 8px; background: #8b5cf6; border-radius: 50%;"></span>'
                    f'Content processed: {len(content)} characters analyzed'
                    '</li>'
                )

            return '\n'.join(bullet_points)

        except Exception as e:
            logger.error(f"Error generating content sections: {e}")
            return (
                '<li style="margin-bottom: 15px; padding-left: 25px; position: relative;">'
                '<span style="position: absolute; left: 0; top: 5px; width: 8px; height: 8px; background: #4ade80; border-radius: 50%;"></span>'
                'Content analysis completed'
                '</li>'
            )

    async def _generate_ppt_file(
        self,
        file_contents: List[Dict],
        description: str,
        theme: str = "default",
        wants_research: bool = False,
        client_id: str = None
    ) -> str:
        """
        Generate PowerPoint file from processed content
        
        Frontend Integration:
        - Creates downloadable PowerPoint presentations
        - Uses AI-generated layout and content structure
        - Saves files to client folder for organized downloads
        - Returns file path for download link generation
        """
        try:
            logger.info(
                f"Generating PPT file with theme: {theme}, research: {wants_research}, client: {client_id}")

            # Combine content for AI processing
            combined_content = ""
            has_images = False

            for content in file_contents:
                if isinstance(content, dict):
                    if 'text' in content:
                        combined_content += f"--- {content.get('file_name', 'unknown')} ---\n{content['text']}\n\n"
                    elif 'content' in content:
                        combined_content += f"--- {content.get('filename', 'unknown')} ---\n{content['content']}\n\n"

                    # Detect images for layout decisions
                    if 'images' in content and content['images']:
                        has_images = True
                else:
                    combined_content += f"--- Content ---\n{str(content)}\n\n"

            # Generate slide structure using AI
            logger.info("Generating slide layout using LLM...")
            layout = await self.llm_service.generate_slide_layout(
                combined_content,
                description,
                theme,
                has_images
            )

            logger.info("Generating slide content using LLM...")
            content = await self.llm_service.generate_slide_content(
                combined_content,
                description,
                layout
            )

            # Create file path with timestamp and safe filename
            from datetime import datetime
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            safe_description = "".join(
                c for c in description[:30] if c.isalnum() or c in (' ', '-', '_')).rstrip()
            safe_description = safe_description.replace(' ', '_')

            if client_id:
                # Save to client folder for organized file management
                client_folder = self.file_service.get_client_folder_path(
                    client_id)
                client_folder.mkdir(parents=True, exist_ok=True)
                filename = f"slide_{timestamp}_{safe_description}.pptx"
                file_path = client_folder / filename
            else:
                # Fallback to output directory
                import os
                output_dir = "output"
                os.makedirs(output_dir, exist_ok=True)
                filename = f"slide_{timestamp}_{safe_description}.pptx"
                file_path = os.path.join(output_dir, filename)

            # Generate PowerPoint file using structured data
            logger.info("Generating PPT file...")
            logger.info(f"Layout sections: {len(layout.get('sections', []))}")
            logger.info(f"Content sections: {list(content.keys())}")
            ppt_path = await self.ppt_service.generate_ppt_from_layout(
                layout,
                content,
                str(file_path),
                theme
            )

            logger.info(f"PPT file generated: {ppt_path}")
            return ppt_path

        except Exception as e:
            logger.error(f"Error generating PPT file: {e}")
            # Return error path for fallback handling
            if client_id:
                client_folder = self.file_service.get_client_folder_path(
                    client_id)
                return str(client_folder / "error_slide.pptx")
            else:
                return "output/error_slide.pptx"

    async def _save_html_to_client_folder(self, html_content: str, description: str, client_id: str) -> str:
        """
        Save HTML content to client folder for download
        
        Frontend Integration:
        - Creates downloadable HTML files
        - Organizes files by client for easy access
        - Returns file path for download link generation
        - Handles file naming with timestamps and safe characters
        """
        try:
            from datetime import datetime

            # Get client-specific folder
            client_folder = self.file_service.get_client_folder_path(client_id)
            client_folder.mkdir(parents=True, exist_ok=True)

            # Create unique, safe filename
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            safe_description = "".join(
                c for c in description[:30] if c.isalnum() or c in (' ', '-', '_')).rstrip()
            safe_description = safe_description.replace(' ', '_')

            # Save HTML file
            filename = f"slide_{timestamp}_{safe_description}.html"
            file_path = client_folder / filename

            with open(file_path, 'w', encoding='utf-8') as f:
                f.write(html_content)

            logger.info(f"HTML content saved to client folder: {file_path}")
            return str(file_path)

        except Exception as e:
            logger.error(f"Error saving HTML to client folder: {e}")
            return None
