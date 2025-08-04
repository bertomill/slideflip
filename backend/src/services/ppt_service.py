"""
PPT generation service using python-pptx
"""

import logging
from typing import Dict, List, Any, Optional
from pathlib import Path
from pptx import Presentation
from pptx.util import Inches, Pt
from pptx.enum.text import PP_ALIGN
from pptx.dml.color import RGBColor
from pptx.enum.shapes import MSO_SHAPE

logger = logging.getLogger(__name__)

class PPTService:
    """Service for generating PowerPoint presentations"""
    
    def __init__(self):
        self.slide_width = 13.33  # Inches
        self.slide_height = 7.5   # Inches
        
    async def generate_ppt_from_layout(
        self,
        layout: Dict[str, Any],
        content: Dict[str, Any],
        output_path: str,
        theme: str = "default"
    ) -> str:
        """
        Generate a PowerPoint file from layout and content
        
        Args:
            layout: Slide layout structure
            content: Generated content for each section
            output_path: Path to save the PPT file
            theme: Slide theme
            
        Returns:
            Path to the generated PPT file
        """
        try:
            # Create a new presentation
            prs = Presentation()
            
            # Set slide size to 16:9 aspect ratio
            prs.slide_width = Inches(self.slide_width)
            prs.slide_height = Inches(self.slide_height)
            
            # Add a slide
            slide_layout = prs.slide_layouts[6]  # Blank layout
            slide = prs.slides.add_slide(slide_layout)
            
            # Apply theme styling
            self._apply_theme(slide, theme)
            
            # Add title if present
            if "title" in layout:
                self._add_title(slide, layout["title"], theme)
            
            # Add sections based on layout
            sections = layout.get("sections", [])
            for i, section in enumerate(sections):
                section_content = content.get(f"section_{i}", {})
                logger.info(f"Adding section {i}: {section.get('type', 'unknown')} with content: {section_content.get('content', 'No content')[:100]}...")
                self._add_section(slide, section, section_content, theme)
            
            # Save the presentation
            prs.save(output_path)
            logger.info(f"PPT file generated: {output_path}")
            
            return output_path
            
        except Exception as e:
            logger.error(f"Error generating PPT file: {e}")
            # Create a minimal error PPT
            return self._create_error_ppt(output_path, str(e))
    
    def _apply_theme(self, slide, theme: str):
        """Apply theme styling to the slide"""
        try:
            # Get background shape
            background = slide.background
            fill = background.fill
            
            if theme == "professional":
                # Professional blue gradient
                fill.gradient()
                fill.gradient_stops[0].color.rgb = RGBColor(44, 62, 80)
                fill.gradient_stops[1].color.rgb = RGBColor(52, 73, 94)
            elif theme == "creative":
                # Creative purple gradient
                fill.gradient()
                fill.gradient_stops[0].color.rgb = RGBColor(102, 126, 234)
                fill.gradient_stops[1].color.rgb = RGBColor(118, 75, 162)
            elif theme == "minimal":
                # Minimal white background
                fill.solid()
                fill.fore_color.rgb = RGBColor(255, 255, 255)
            elif theme == "colorful":
                # Colorful gradient
                fill.gradient()
                fill.gradient_stops[0].color.rgb = RGBColor(255, 107, 107)
                fill.gradient_stops[1].color.rgb = RGBColor(78, 205, 196)
            else:
                # Default gradient
                fill.gradient()
                fill.gradient_stops[0].color.rgb = RGBColor(102, 126, 234)
                fill.gradient_stops[1].color.rgb = RGBColor(118, 75, 162)
                
        except Exception as e:
            logger.warning(f"Error applying theme {theme}: {e}")
    
    def _add_title(self, slide, title: str, theme: str):
        """Add title to the slide"""
        try:
            # Add title text box with better positioning
            left = Inches(0.5)
            top = Inches(0.3)
            width = Inches(self.slide_width - 1)
            height = Inches(1.2)
            
            txBox = slide.shapes.add_textbox(left, top, width, height)
            tf = txBox.text_frame
            tf.text = title
            
            # Style the title
            p = tf.paragraphs[0]
            p.alignment = PP_ALIGN.CENTER
            
            # Set font properties
            font = p.font
            font.size = Pt(32)
            font.bold = True
            
            # Set color based on theme
            if theme == "minimal":
                font.color.rgb = RGBColor(51, 51, 51)
            else:
                font.color.rgb = RGBColor(255, 255, 255)
            
            logger.info(f"Added title: {title}")
                
        except Exception as e:
            logger.error(f"Error adding title: {e}")
    
    def _add_section(self, slide, section: Dict[str, Any], content: Dict[str, Any], theme: str):
        """Add a section to the slide"""
        try:
            section_type = section.get("type", "text")
            position = section.get("position", {"x": 10, "y": 30, "width": 80, "height": 60})
            
            # Validate and adjust position to ensure it fits on slide
            x = max(0, min(95, position.get("x", 10)))  # Ensure x is between 0-95%
            y = max(0, min(95, position.get("y", 30)))  # Ensure y is between 0-95%
            width = max(5, min(95, position.get("width", 80)))  # Ensure width is between 5-95%
            height = max(5, min(95, position.get("height", 60)))  # Ensure height is between 5-95%
            
            # Ensure section doesn't go off the slide
            if x + width > 95:
                width = 95 - x
            if y + height > 95:
                height = 95 - y
            
            # Convert percentage to inches
            left = Inches((x / 100) * self.slide_width)
            top = Inches((y / 100) * self.slide_height)
            width_inches = Inches((width / 100) * self.slide_width)
            height_inches = Inches((height / 100) * self.slide_height)
            
            logger.info(f"Adding section '{section_type}' at position: x={x}%, y={y}%, w={width}%, h={height}%")
            
            if section_type == "text":
                self._add_text_section(slide, content, left, top, width_inches, height_inches, theme)
            elif section_type == "bullet_list":
                self._add_bullet_list_section(slide, content, left, top, width_inches, height_inches, theme)
            elif section_type == "image":
                self._add_image_section(slide, content, left, top, width_inches, height_inches, theme)
            elif section_type == "highlight_box":
                self._add_highlight_box_section(slide, content, left, top, width_inches, height_inches, theme)
            elif section_type == "quote":
                self._add_quote_section(slide, content, left, top, width_inches, height_inches, theme)
            else:
                # Default to text
                self._add_text_section(slide, content, left, top, width_inches, height_inches, theme)
                
        except Exception as e:
            logger.error(f"Error adding section: {e}")
    
    def _add_text_section(self, slide, content: Dict[str, Any], left, top, width, height, theme: str):
        """Add a text section to the slide"""
        try:
            txBox = slide.shapes.add_textbox(left, top, width, height)
            tf = txBox.text_frame
            
            # Get the content from the section
            section_content = content.get("content", "Content not available")
            tf.text = section_content
            
            # Style the text
            p = tf.paragraphs[0]
            font = p.font
            font.size = Pt(16)
            
            # Set color based on theme
            if theme == "minimal":
                font.color.rgb = RGBColor(51, 51, 51)
            else:
                font.color.rgb = RGBColor(255, 255, 255)
            
            logger.info(f"Added text section with content: {section_content[:100]}...")
                
        except Exception as e:
            logger.error(f"Error adding text section: {e}")
    
    def _add_bullet_list_section(self, slide, content: Dict[str, Any], left, top, width, height, theme: str):
        """Add a bullet list section to the slide"""
        try:
            txBox = slide.shapes.add_textbox(left, top, width, height)
            tf = txBox.text_frame
            
            # Get the content from the section
            section_content = content.get("content", "")
            
            # Split content into lines for bullet points
            lines = section_content.split('\n')
            
            for i, line in enumerate(lines):
                if i == 0:
                    # First line
                    tf.text = line
                    p = tf.paragraphs[0]
                else:
                    # Additional lines
                    p = tf.add_paragraph()
                    p.text = line
                
                # Style the paragraph
                font = p.font
                font.size = Pt(14)
                
                # Set color based on theme
                if theme == "minimal":
                    font.color.rgb = RGBColor(51, 51, 51)
                else:
                    font.color.rgb = RGBColor(255, 255, 255)
            
            logger.info(f"Added bullet list section with {len(lines)} lines")
                    
        except Exception as e:
            logger.error(f"Error adding bullet list section: {e}")

    def _add_highlight_box_section(self, slide, content: Dict[str, Any], left, top, width, height, theme: str):
        """Add a highlight box section to the slide"""
        try:
            # Create a shape for the highlight box
            shape = slide.shapes.add_shape(
                MSO_SHAPE.RECTANGLE,
                left, top, width, height
            )
            
            # Style the highlight box
            fill = shape.fill
            fill.solid()
            if theme == "minimal":
                fill.fore_color.rgb = RGBColor(248, 249, 250)  # Light gray
            else:
                fill.fore_color.rgb = RGBColor(52, 152, 219)  # Blue
            
            # Add text to the highlight box
            tf = shape.text_frame
            section_content = content.get("content", "Key Insight")
            tf.text = section_content
            
            # Style the text
            p = tf.paragraphs[0]
            p.alignment = PP_ALIGN.CENTER
            font = p.font
            font.size = Pt(18)
            font.bold = True
            
            # Set color based on theme
            if theme == "minimal":
                font.color.rgb = RGBColor(51, 51, 51)
            else:
                font.color.rgb = RGBColor(255, 255, 255)
            
            logger.info(f"Added highlight box section with content: {section_content[:100]}...")
                
        except Exception as e:
            logger.error(f"Error adding highlight box section: {e}")

    def _add_quote_section(self, slide, content: Dict[str, Any], left, top, width, height, theme: str):
        """Add a quote section to the slide"""
        try:
            txBox = slide.shapes.add_textbox(left, top, width, height)
            tf = txBox.text_frame
            
            # Get the content from the section
            section_content = content.get("content", "Quote not available")
            
            # Add quote marks and format
            formatted_quote = f'"{section_content}"'
            tf.text = formatted_quote
            
            # Style the quote
            p = tf.paragraphs[0]
            p.alignment = PP_ALIGN.CENTER
            font = p.font
            font.size = Pt(20)
            font.italic = True
            
            # Set color based on theme
            if theme == "minimal":
                font.color.rgb = RGBColor(51, 51, 51)
            else:
                font.color.rgb = RGBColor(255, 255, 255)
            
            logger.info(f"Added quote section with content: {section_content[:100]}...")
                
        except Exception as e:
            logger.error(f"Error adding quote section: {e}")
    
    def _add_image_section(self, slide, content: Dict[str, Any], left, top, width, height, theme: str):
        """Add an image section to the slide"""
        try:
            # For now, add a placeholder shape
            # In the future, this could load actual images
            shape = slide.shapes.add_shape(
                MSO_SHAPE.RECTANGLE,
                left, top, width, height
            )
            
            # Style the placeholder
            fill = shape.fill
            fill.solid()
            fill.fore_color.rgb = RGBColor(200, 200, 200)
            
            # Add text to placeholder
            tf = shape.text_frame
            tf.text = "Image placeholder"
            
            p = tf.paragraphs[0]
            p.alignment = PP_ALIGN.CENTER
            font = p.font
            font.size = Pt(12)
            font.color.rgb = RGBColor(100, 100, 100)
            
        except Exception as e:
            logger.error(f"Error adding image section: {e}")
    
    def _create_error_ppt(self, output_path: str, error_message: str) -> str:
        """Create a minimal PPT file with error information"""
        try:
            prs = Presentation()
            slide_layout = prs.slide_layouts[6]  # Blank layout
            slide = prs.slides.add_slide(slide_layout)
            
            # Add error message
            left = Inches(1)
            top = Inches(2)
            width = Inches(self.slide_width - 2)
            height = Inches(2)
            
            txBox = slide.shapes.add_textbox(left, top, width, height)
            tf = txBox.text_frame
            tf.text = f"Error generating slide: {error_message}"
            
            p = tf.paragraphs[0]
            p.alignment = PP_ALIGN.CENTER
            font = p.font
            font.size = Pt(18)
            font.color.rgb = RGBColor(255, 0, 0)
            
            prs.save(output_path)
            logger.info(f"Error PPT created: {output_path}")
            return output_path
            
        except Exception as e:
            logger.error(f"Error creating error PPT: {e}")
            return output_path 