"""
Slide service for handling slide generation and processing
"""

import asyncio
import logging
from typing import List, Dict, Optional
from datetime import datetime
import json

from src.models.message_models import FileInfo, SlideData, ProcessingResult, ProcessingStatus
from src.services.file_service import FileService

logger = logging.getLogger(__name__)

class SlideService:
    """Service for handling slide generation and processing"""
    
    def __init__(self):
        self.file_service = FileService()
        self.client_descriptions: Dict[str, str] = {}
        self.client_content: Dict[str, List[Dict]] = {}  # Store extracted content for each client
        self.processing_results: Dict[str, ProcessingResult] = {}
    
    async def store_slide_description(self, client_id: str, description: str) -> bool:
        """Store slide description for a client"""
        try:
            self.client_descriptions[client_id] = description
            logger.info(f"Stored slide description for client {client_id}")
            return True
        except Exception as e:
            logger.error(f"Error storing slide description for client {client_id}: {e}")
            return False
    
    async def get_slide_description(self, client_id: str) -> Optional[str]:
        """Get stored slide description for a client"""
        return self.client_descriptions.get(client_id)
    
    async def store_extracted_content(self, client_id: str, content_data: Dict) -> bool:
        """Store extracted content (text and images) for a client"""
        try:
            if client_id not in self.client_content:
                self.client_content[client_id] = []
            
            self.client_content[client_id].append(content_data)
            logger.info(f"Stored extracted content for client {client_id}: {content_data.get('filename', 'unknown')}")
            return True
        except Exception as e:
            logger.error(f"Error storing extracted content for client {client_id}: {e}")
            return False
    
    async def get_extracted_content(self, client_id: str) -> List[Dict]:
        """Get all stored extracted content for a client"""
        return self.client_content.get(client_id, [])
    
    async def get_client_files_content(self, client_id: str) -> List[Dict]:
        """Get content from all files uploaded by a client"""
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
            logger.error(f"Error getting client files content for {client_id}: {e}")
            return []
    
    async def store_file_content(self, client_id: str, file_path: str, filename: str) -> bool:
        """Extract and store content from a specific file"""
        try:
            # Extract content from the file
            content = await self.file_service.extract_content_from_file(file_path)
            logger.info(f"Content: {content['text'][:100]}")
            if content:
                content['client_id'] = client_id
                content['upload_time'] = datetime.now().isoformat()
                
                # Store the content
                await self.store_extracted_content(client_id, content)
                logger.info(f"Stored content from file {filename} for client {client_id}")
                return True
            else:
                logger.warning(f"No content extracted from file {filename} for client {client_id}")
                return False
        except Exception as e:
            logger.error(f"Error storing file content for client {client_id}, file {filename}: {e}")
            return False
    
    async def generate_slide_with_params(
        self, 
        files: List[FileInfo], 
        description: str, 
        theme: str = "default",
        wants_research: bool = False,
        client_id: str = None
    ) -> Dict:
        """Generate slide content with specific parameters and return both HTML and PPT file"""
        start_time = datetime.now()
        
        try:
            logger.info(f"Starting slide generation with {len(files)} files, theme: {theme}, research: {wants_research}")
            
            # Get stored content if client_id is provided, otherwise extract from files
            if client_id:
                file_contents = await self.get_extracted_content(client_id)
                logger.info(f"Using stored content for client {client_id}: {len(file_contents)} items")
            else:
                # Extract text content from all files (fallback for backward compatibility)
                file_contents = []
                for file_info in files:
                    content = await self.file_service.extract_text_from_file(file_info.file_path)
                    if content:
                        file_contents.append({
                            "filename": file_info.filename,
                            "content": content,
                            "file_type": file_info.file_type
                        })
            
            # Generate slide HTML for preview
            slide_html = await self._generate_slide_html(
                file_contents, 
                description,
                theme,
                wants_research
            )
            
            # Save HTML content to client folder if client_id is provided
            html_file_path = None
            if client_id:
                html_file_path = await self._save_html_to_client_folder(
                    slide_html, description, client_id
                )
            
            # Generate PPT file for download
            ppt_file_path = await self._generate_ppt_file(
                file_contents,
                description,
                theme,
                wants_research,
                client_id
            )
            
            # Create slide data for reference
            slide_data = await self._analyze_content_and_generate_slide(
                file_contents, 
                description
            )
            
            processing_time = (datetime.now() - start_time).total_seconds()
            
            result = {
                "slide_html": slide_html,
                "html_file_path": html_file_path,
                "ppt_file_path": ppt_file_path,
                "slide_data": slide_data.model_dump(),
                "processing_time": processing_time,
                "files_processed": len(files),
                "content_extracted": len(file_contents),
                "theme": theme,
                "wants_research": wants_research
            }
            
            logger.info(f"Slide generation completed in {processing_time:.2f} seconds")
            return result
            
        except Exception as e:
            processing_time = (datetime.now() - start_time).total_seconds()
            logger.error(f"Error generating slide: {e}")
            
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
        """Analyze content and generate slide data"""
        try:
            # Handle both old format (text only) and new format (text + images)
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
                    
                    # Count images if available
                    if 'images' in content:
                        total_images += len(content['images'])
                else:
                    # Fallback for string content
                    combined_content += f"--- Content ---\n{str(content)}\n\n"
            
            # Extract key information from description
            slide_title = self._extract_title_from_description(description)
            slide_theme = self._extract_theme_from_description(description)
            slide_layout = self._determine_layout(description, combined_content)
            
            # Generate slide elements based on content and description
            elements = await self._generate_slide_elements(combined_content, description)
            
            # Add image information to slide data if available
            if total_images > 0:
                elements.append({
                    "type": "image_summary",
                    "content": f"Found {total_images} images in uploaded content",
                    "position": {"x": 50, "y": 90},
                    "style": {"fontSize": "12px", "color": "#666", "fontStyle": "italic"}
                })
            
            # Create slide data
            slide_data = SlideData(
                title=slide_title,
                content=combined_content[:1000] + "..." if len(combined_content) > 1000 else combined_content,
                theme=slide_theme,
                layout=slide_layout,
                elements=elements
            )
            
            return slide_data
            
        except Exception as e:
            logger.error(f"Error analyzing content: {e}")
            # Return a basic slide structure
            return SlideData(
                title="Generated Slide",
                content="Content analysis failed",
                theme="default",
                layout="standard",
                elements=[]
            )
    
    async def _generate_slide_html(
        self, 
        file_contents: List[Dict], 
        description: str,
        theme: str = "default",
        wants_research: bool = False
    ) -> str:
        """Generate actual HTML content for the slide"""
        try:
            # Handle both old format (text only) and new format (text + images)
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
                    
                    # Count images if available
                    if 'images' in content:
                        total_images += len(content['images'])
                else:
                    # Fallback for string content
                    combined_content += f"--- Content ---\n{str(content)}\n\n"
            
            # Extract key information
            slide_title = self._extract_title_from_description(description)
            
            # Generate theme-specific styling
            theme_styles = self._get_theme_styles(theme)
            
            # Generate content sections
            content_sections = self._generate_content_sections(combined_content, wants_research)
            
            # Add image information if available
            if total_images > 0:
                content_sections += f"""
                <li style="margin-bottom: 15px; padding-left: 25px; position: relative;">
                <span style="position: absolute; left: 0; top: 5px; width: 8px; height: 8px; background: #ec4899; border-radius: 50%;"></span>
                {total_images} images extracted from uploaded content
                </li>
                """
            
            # Create the HTML slide
            slide_html = f"""
            <div style="width: 800px; height: 600px; {theme_styles['background']}; padding: 60px; color: {theme_styles['text_color']}; font-family: 'Arial', sans-serif; position: relative; overflow: hidden;">
                <div style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; {theme_styles['overlay']}; opacity: 0.3;"></div>
                
                <div style="position: relative; z-index: 1;">
                    <h1 style="font-size: 48px; font-weight: bold; margin-bottom: 20px; text-shadow: 2px 2px 4px rgba(0,0,0,0.3); {theme_styles['title_style']}">
                        {slide_title}
                    </h1>
                    
                    <div style="background: {theme_styles['content_bg']}; backdrop-filter: blur(10px); border-radius: 15px; padding: 30px; margin: 40px 0;">
                        <h2 style="font-size: 24px; margin-bottom: 20px; color: {theme_styles['subtitle_color']};">Key Insights</h2>
                        <ul style="list-style: none; padding: 0;">
                            {content_sections}
                        </ul>
                    </div>
                    
                    <div style="position: absolute; bottom: 40px; right: 60px; font-size: 14px; opacity: 0.8;">
                        Created with SlideFlip AI
                    </div>
                </div>
            </div>
            """
            
            return slide_html
            
        except Exception as e:
            logger.error(f"Error generating slide HTML: {e}")
            # Return a basic error slide
            return f"""
            <div style="width: 800px; height: 600px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 60px; color: white; font-family: 'Arial', sans-serif; display: flex; align-items: center; justify-content: center;">
                <div style="text-align: center;">
                    <h1 style="font-size: 36px; margin-bottom: 20px;">Slide Generation Error</h1>
                    <p style="font-size: 18px;">Unable to generate slide content. Please try again.</p>
                </div>
            </div>
            """
    
    def _extract_title_from_description(self, description: str) -> str:
        """Extract slide title from description"""
        # Simple title extraction - could be enhanced with NLP
        words = description.split()
        if len(words) >= 3:
            # Take first few words as title
            title = " ".join(words[:5])
            return title.title()
        return "Generated Slide"
    
    def _extract_theme_from_description(self, description: str) -> str:
        """Extract theme preference from description"""
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
        """Determine slide layout based on content and description"""
        description_lower = description.lower()
        content_lower = content.lower()
        
        # Check for specific layout indicators
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
        """Generate slide elements based on content and description"""
        elements = []
        
        try:
            # Split content into paragraphs
            paragraphs = [p.strip() for p in content.split('\n\n') if p.strip()]
            
            # Generate title element
            title = self._extract_title_from_description(description)
            elements.append({
                "type": "title",
                "content": title,
                "position": {"x": 50, "y": 10},
                "style": {"fontSize": "24px", "fontWeight": "bold"}
            })
            
            # Generate content elements
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
            
            # Add summary element if content is long
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
            # Add a basic text element
            elements.append({
                "type": "text",
                "content": "Content processing completed",
                "position": {"x": 50, "y": 50},
                "style": {"fontSize": "16px"}
            })
        
        return elements
    
    async def get_processing_result(self, client_id: str) -> Optional[ProcessingResult]:
        """Get processing result for a client"""
        return self.processing_results.get(client_id)
    
    async def store_processing_result(self, client_id: str, result: ProcessingResult) -> bool:
        """Store processing result for a client"""
        try:
            self.processing_results[client_id] = result
            return True
        except Exception as e:
            logger.error(f"Error storing processing result for client {client_id}: {e}")
            return False
    
    async def clear_client_data(self, client_id: str) -> bool:
        """Clear all data for a client"""
        try:
            if client_id in self.client_descriptions:
                del self.client_descriptions[client_id]
            
            if client_id in self.client_content:
                del self.client_content[client_id]
            
            if client_id in self.processing_results:
                del self.processing_results[client_id]
            
            # Also clear files
            await self.file_service.delete_client_files(client_id)
            
            logger.info(f"Cleared all data for client {client_id}")
            return True
        except Exception as e:
            logger.error(f"Error clearing data for client {client_id}: {e}")
            return False
    
    def get_service_stats(self) -> Dict:
        """Get service statistics"""
        return {
            "active_clients": len(self.client_descriptions),
            "processing_results": len(self.processing_results),
            "total_descriptions_stored": len(self.client_descriptions),
            "total_results_stored": len(self.processing_results)
        }
    
    async def get_client_content_stats(self, client_id: str) -> Dict:
        """Get content statistics for a specific client"""
        try:
            content_list = await self.get_extracted_content(client_id)
            
            total_files = len(content_list)
            total_text_length = sum(len(content.get('text', '')) for content in content_list)
            total_images = sum(len(content.get('images', [])) for content in content_list)
            
            # Count by file type
            file_types = {}
            for content in content_list:
                file_name = content.get('file_name', 'unknown')
                file_ext = file_name.split('.')[-1].lower() if '.' in file_name else 'unknown'
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
            logger.error(f"Error getting content stats for client {client_id}: {e}")
            return {
                "client_id": client_id,
                "error": str(e)
            }
    
    def _get_theme_styles(self, theme: str) -> Dict[str, str]:
        """Get CSS styles for different themes"""
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
        """Generate HTML content sections based on the content"""
        try:
            # Split content into paragraphs
            paragraphs = [p.strip() for p in content.split('\n\n') if p.strip()]
            
            # Generate bullet points from content
            bullet_points = []
            
            # Add document analysis point
            bullet_points.append(
                '<li style="margin-bottom: 15px; padding-left: 25px; position: relative;">'
                '<span style="position: absolute; left: 0; top: 5px; width: 8px; height: 8px; background: #4ade80; border-radius: 50%;"></span>'
                f'Document analysis reveals {len(paragraphs)} key insights'
                '</li>'
            )
            
            # Add theme point
            bullet_points.append(
                '<li style="margin-bottom: 15px; padding-left: 25px; position: relative;">'
                '<span style="position: absolute; left: 0; top: 5px; width: 8px; height: 8px; background: #60a5fa; border-radius: 50%;"></span>'
                'Professional theme applied for optimal impact'
                '</li>'
            )
            
            # Add research point if requested
            if wants_research:
                bullet_points.append(
                    '<li style="margin-bottom: 15px; padding-left: 25px; position: relative;">'
                    '<span style="position: absolute; left: 0; top: 5px; width: 8px; height: 8px; background: #f59e0b; border-radius: 50%;"></span>'
                    'Enhanced with AI research insights'
                    '</li>'
                )
            
            # Add content summary point
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
        Generate a PPT file from the content and return the file path
        This is a placeholder function that will be implemented with actual PPT generation logic
        """
        try:
            logger.info(f"Generating PPT file with theme: {theme}, research: {wants_research}, client: {client_id}")
            
            # TODO: Implement actual PPT generation logic
            # For now, we'll create a placeholder file path
            import os
            from datetime import datetime
            
            # Create a unique filename based on timestamp and description
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            safe_description = "".join(c for c in description[:30] if c.isalnum() or c in (' ', '-', '_')).rstrip()
            safe_description = safe_description.replace(' ', '_')
            
            # Use client-specific folder if client_id is provided
            if client_id:
                # Get client folder path from file service
                client_folder = self.file_service.get_client_folder_path(client_id)
                client_folder.mkdir(parents=True, exist_ok=True)
                logger.info(f"Using client folder for PPT generation: {client_folder}")
                
                # Generate filename within client folder
                filename = f"slide_{timestamp}_{safe_description}.pptx"
                file_path = client_folder / filename
            else:
                # Fallback to output directory for backward compatibility
                output_dir = "output"
                os.makedirs(output_dir, exist_ok=True)
                filename = f"slide_{timestamp}_{safe_description}.pptx"
                file_path = os.path.join(output_dir, filename)
            
            # TODO: Replace this with actual PPT generation
            # For now, create a placeholder file with some content
            self._create_placeholder_ppt_file(str(file_path), file_contents, description, theme, wants_research)
            
            logger.info(f"PPT file generated: {file_path}")
            return str(file_path)
            
        except Exception as e:
            logger.error(f"Error generating PPT file: {e}")
            # Return a default path in case of error
            if client_id:
                client_folder = self.file_service.get_client_folder_path(client_id)
                return str(client_folder / "error_slide.pptx")
            else:
                return "output/error_slide.pptx"
    
    def _create_placeholder_ppt_file(self, file_path: str, file_contents: List[Dict], description: str, theme: str, wants_research: bool):
        """
        Create a placeholder PPT file for testing
        This will be replaced with actual PPT generation logic
        """
        try:
            # Create a simple text file as placeholder for now
            # In the future, this will be replaced with actual PPT generation using libraries like python-pptx
            
            with open(file_path, 'w', encoding='utf-8') as f:
                f.write("# SlideFlip Generated Presentation\n\n")
                f.write(f"## Description: {description}\n")
                f.write(f"## Theme: {theme}\n")
                f.write(f"## Research Enabled: {wants_research}\n\n")
                f.write("## Content Summary:\n")
                
                for i, content in enumerate(file_contents, 1):
                    f.write(f"### File {i}: {content['filename']}\n")
                    f.write(f"Type: {content['file_type']}\n")
                    f.write(f"Content Length: {len(content['content'])} characters\n\n")
                
                f.write("## Generated Content:\n")
                f.write("- This is a placeholder PPT file\n")
                f.write("- Actual PPT generation will be implemented\n")
                f.write("- Will include proper formatting and styling\n")
                f.write("- Will support themes and layouts\n")
            
            # Rename to .pptx extension for consistency
            pptx_path = file_path.replace('.txt', '.pptx')
            os.rename(file_path, pptx_path)
            
            logger.info(f"Placeholder PPT file created: {pptx_path}")
            
        except Exception as e:
            logger.error(f"Error creating placeholder PPT file: {e}")
            # Create a minimal error file
            with open(file_path, 'w', encoding='utf-8') as f:
                f.write("Error: Could not generate PPT file")
    
    async def _save_html_to_client_folder(self, html_content: str, description: str, client_id: str) -> str:
        """
        Save HTML content to the client's folder
        """
        try:
            from datetime import datetime
            
            # Get client folder path
            client_folder = self.file_service.get_client_folder_path(client_id)
            client_folder.mkdir(parents=True, exist_ok=True)
            
            # Create unique filename
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            safe_description = "".join(c for c in description[:30] if c.isalnum() or c in (' ', '-', '_')).rstrip()
            safe_description = safe_description.replace(' ', '_')
            
            # Generate filename
            filename = f"slide_{timestamp}_{safe_description}.html"
            file_path = client_folder / filename
            
            # Save HTML content
            with open(file_path, 'w', encoding='utf-8') as f:
                f.write(html_content)
            
            logger.info(f"HTML content saved to client folder: {file_path}")
            return str(file_path)
            
        except Exception as e:
            logger.error(f"Error saving HTML to client folder: {e}")
            return None 