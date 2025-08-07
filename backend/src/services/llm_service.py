"""
LLM service for slide generation using OpenAI GPT
"""

import logging
import json
from typing import Dict, List, Optional, Any
from openai import OpenAI
from src.core.config import Settings

logger = logging.getLogger(__name__)

class LLMService:
    """Service for LLM-based slide generation"""
    
    def __init__(self):
        self.settings = Settings()
        self.client = None
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
                logger.warning("OpenAI API key not found. LLM features will be disabled.")
                logger.info("Please check:")
                logger.info("1. .env.local file exists in backend directory")
                logger.info("2. OPENAI_API_KEY is set in .env.local file")
                logger.info("3. File format: OPENAI_API_KEY=your_api_key_here")
                self.client = None
        except Exception as e:
            logger.error(f"Error initializing OpenAI client: {e}")
            self.client = None
    
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
        
        Args:
            content: Extracted text content from files
            description: User's slide description
            theme: Slide theme
            has_images: Whether images are available
            theme_info: Detailed theme information including colors and description
            
        Returns:
            Dict containing layout information
        """
        if not self.client:
            return self._generate_fallback_layout(content, description, theme)
        
        try:
            # Build theme context for the prompt
            theme_context = ""
            if theme_info:
                theme_context = f"""
THEME INFORMATION:
- Theme Name: {theme_info.get('theme_name', theme)}
- Theme Description: {theme_info.get('theme_description', '')}
- Color Palette: {', '.join(theme_info.get('color_palette', []))}
- Preview Text: {theme_info.get('preview_text', '')}

Please incorporate this theme's visual style, color palette, and design philosophy into the layout.
"""
            
            system_prompt = f"""You are an expert presentation designer with 15+ years of experience creating compelling slides for Fortune 500 companies, TED talks, and academic conferences. Your task is to analyze content and user requirements to design an optimal, professional slide layout that maximizes impact and engagement.

CRITICAL REQUIREMENTS:
- Create layouts that tell a story and guide the audience's attention
- Design for visual hierarchy and readability
- Ensure content is well-distributed across the slide
- Consider the theme and make it cohesive with the design
- Create multiple sections that work together to present the information effectively
{theme_context}

Return ONLY a JSON object with the following structure (no markdown formatting, no code blocks):
{{
    "layout_type": "title_slide|content_slide|image_slide|mixed|key_insights|comparison|timeline|process",
    "title": "Compelling, action-oriented slide title",
    "sections": [
        {{
            "type": "text|bullet_list|image|chart|quote|highlight_box|timeline|process_step",
            "content": "Brief description of what this section will contain",
            "position": {{"x": 5, "y": 25, "width": 45, "height": 35}},
            "style": {{"font_size": "18px", "color": "#2c3e50", "alignment": "left", "font_weight": "bold"}}
        }},
        {{
            "type": "text|bullet_list|image|chart|quote|highlight_box|timeline|process_step", 
            "content": "Brief description of what this section will contain",
            "position": {{"x": 55, "y": 25, "width": 40, "height": 35}},
            "style": {{"font_size": "16px", "color": "#34495e", "alignment": "left"}}
        }}
    ],
    "background_style": "gradient|solid|image|pattern",
    "color_scheme": "professional|creative|minimal|colorful|corporate|academic|modern"
}}

LAYOUT GUIDELINES:
- Use 2-4 sections for optimal content distribution
- Position sections to create visual flow (left to right, top to bottom)
- Vary section types to maintain interest (text, bullet lists, highlights)
- Ensure adequate spacing between sections (at least 5% gap)
- Make title prominent and engaging
- Consider the content type and create appropriate sections
"""

            user_prompt = f"""CONTENT ANALYSIS:
{content[:3000]}...

DESIGN REQUIREMENTS:
- User Description: {description}
- Theme: {theme}
- Available Media: {'Images available' if has_images else 'Text content only'}

LAYOUT DESIGN TASK:
Create a professional, engaging slide layout that:
1. Effectively presents the key information from the content
2. Uses visual hierarchy to guide audience attention
3. Creates a compelling narrative flow
4. Maximizes impact and engagement
5. Works well with the specified theme
6. Distributes content optimally across the slide

Consider the content type and create appropriate sections:
- For data-heavy content: Use charts, bullet lists, and highlight boxes
- For narrative content: Use text sections with compelling storytelling
- For process content: Use timeline or process step sections
- For comparison content: Use side-by-side sections
- For key insights: Use highlight boxes and bullet lists

Design a layout that transforms this content into a compelling, professional presentation slide."""

            response = self.client.chat.completions.create(
                model="gpt-4o",
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt}
                ],
                max_tokens=2000,
                temperature=0.8
            )
            
            layout_text = response.choices[0].message.content.strip()
            
            # Log the raw response for debugging
            logger.info(f"LLM Layout Response (first 500 chars): {layout_text[:500]}...")
            
            # Clean up markdown code blocks if present
            if layout_text.startswith("```json"):
                layout_text = layout_text[7:]  # Remove ```json
            elif layout_text.startswith("```"):
                layout_text = layout_text[3:]   # Remove ```
            
            if layout_text.endswith("```"):
                layout_text = layout_text[:-3]  # Remove trailing ```
            
            layout_text = layout_text.strip()
            
            # Try to parse JSON response
            try:
                layout_data = json.loads(layout_text)
                
                # Validate the layout structure
                if not isinstance(layout_data, dict):
                    raise ValueError("Layout data must be a dictionary")
                
                if "sections" not in layout_data:
                    raise ValueError("Layout data must contain 'sections' field")
                
                if not isinstance(layout_data["sections"], list):
                    raise ValueError("Layout sections must be a list")
                
                logger.info(f"✅ Successfully parsed layout JSON: {layout_data.get('layout_type', 'unknown')}")
                logger.info(f"   Sections: {len(layout_data['sections'])}")
                logger.info(f"   Title: {layout_data.get('title', 'No title')}")
                return layout_data
                
            except (json.JSONDecodeError, ValueError) as e:
                logger.warning(f"❌ Failed to parse/validate LLM response: {e}")
                logger.warning(f"Raw response: {layout_text}")
                logger.info("Using fallback layout generation")
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
        
        Args:
            content: Extracted text content from files
            description: User's slide description
            layout: Generated layout structure
            theme_info: Detailed theme information including colors and description
            
        Returns:
            Dict containing content for each section
        """
        if not self.client:
            return self._generate_fallback_content(content, description, layout)
        
        try:
            # Build theme context for the prompt
            theme_context = ""
            if theme_info:
                theme_context = f"""
THEME INFORMATION:
- Theme Name: {theme_info.get('theme_name', 'default')}
- Theme Description: {theme_info.get('theme_description', '')}
- Color Palette: {', '.join(theme_info.get('color_palette', []))}
- Preview Text: {theme_info.get('preview_text', '')}

Please ensure the content style and tone match this theme's characteristics.
"""
            
            system_prompt = f"""You are a senior content strategist and copywriter with 10+ years of experience creating compelling presentation content for Fortune 500 companies, TED talks, and high-profile events. Your task is to transform raw content into engaging, well-structured slide content that tells a compelling story.

CRITICAL REQUIREMENTS:
- Create content that is concise, impactful, and easy to read
- Maintain professional tone while being engaging
- Ensure content fits the specified layout structure
- Make information scannable and memorable
- Use active voice and action-oriented language
{theme_context}

Return ONLY a JSON object with content for each section (no markdown formatting, no code blocks):
{{
    "section_0": {{
        "content": "Engaging, well-formatted content for the first section",
        "style_notes": "Any specific styling or formatting notes"
    }},
    "section_1": {{
        "content": "Engaging, well-formatted content for the second section", 
        "style_notes": "Any specific styling or formatting notes"
    }}
}}

CONTENT GUIDELINES:
- Keep bullet points to 3-5 items maximum
- Use clear, action-oriented language
- Include key insights and takeaways
- Make content scannable and memorable
- Ensure proper hierarchy and flow
"""

            user_prompt = f"""SOURCE CONTENT ANALYSIS:
{content[:3000]}...

USER REQUIREMENTS:
- Description: {description}
- Layout Structure: {json.dumps(layout, indent=2)}

CONTENT GENERATION TASK:
Transform the source content into compelling, professional slide content that:
1. Extracts the most important insights and key messages
2. Includes specific data points, statistics, and examples from the source material
3. Creates a coherent narrative that flows between sections
4. Uses professional business language appropriate for executive audiences
5. Includes actionable insights and recommendations where relevant
6. Makes complex information accessible and engaging

For each section in the layout, create comprehensive content that:
- Tells a compelling story
- Includes specific details from the source material
- Uses professional language and formatting
- Provides value to the audience
- Supports the overall slide message

Generate detailed, comprehensive content for each section."""

            response = self.client.chat.completions.create(
                model="gpt-4o",
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt}
                ],
                max_tokens=2500,
                temperature=0.8
            )
            
            content_text = response.choices[0].message.content.strip()
            
            # Log the raw response for debugging
            logger.info(f"LLM Content Response (first 500 chars): {content_text[:500]}...")
            
            # Clean up markdown code blocks if present
            if content_text.startswith("```json"):
                content_text = content_text[7:]  # Remove ```json
            elif content_text.startswith("```"):
                content_text = content_text[3:]   # Remove ```
            
            if content_text.endswith("```"):
                content_text = content_text[:-3]  # Remove trailing ```
            
            content_text = content_text.strip()
            
            try:
                content_data = json.loads(content_text)
                
                # Validate the content structure
                if not isinstance(content_data, dict):
                    raise ValueError("Content data must be a dictionary")
                
                # Check if we have at least one section
                section_keys = [key for key in content_data.keys() if key.startswith("section_")]
                if not section_keys:
                    raise ValueError("Content data must contain at least one section")
                
                logger.info("✅ Successfully parsed content JSON")
                logger.info(f"   Sections: {len(section_keys)}")
                return content_data
                
            except (json.JSONDecodeError, ValueError) as e:
                logger.warning(f"❌ Failed to parse/validate content response: {e}")
                logger.warning(f"Raw response: {content_text}")
                logger.info("Using fallback content generation")
                return self._generate_fallback_content(content, description, layout)
                
        except Exception as e:
            logger.error(f"Error generating slide content: {e}")
            return self._generate_fallback_content(content, description, layout)

    def _generate_fallback_layout(self, content: str, description: str, theme: str) -> Dict[str, Any]:
        """Generate a fallback layout when LLM is not available"""
        logger.info("Using fallback layout generation")

        # Extract title from description
        title = description.split()[:5]
        title = " ".join(title).title()

        return {
            "layout_type": "content_slide",
            "title": title,
            "sections": [
                {
                    "type": "text",
                    "content": "Main content section",
                    "position": {"x": 5, "y": 25, "width": 90, "height": 70},
                    "style": {"font_size": "18px", "color": "#2c3e50", "alignment": "left"}
                }
            ],
            "background_style": "gradient",
            "color_scheme": theme
        }
    
    def _generate_fallback_content(self, content: str, description: str, layout: Dict[str, Any]) -> Dict[str, Any]:
        """Generate fallback content when LLM is not available"""
        logger.info("Using fallback content generation")
        
        # Create simple content based on the layout
        sections = layout.get("sections", [])
        content_data = {}
        
        for i, section in enumerate(sections):
            if section["type"] == "text":
                # Use first 200 characters of content
                section_content = content[:200] + "..." if len(content) > 200 else content
                content_data[f"section_{i}"] = {
                    "type": "text",
                    "content": section_content,
                    "style": section.get("style", {})
                }
            elif section["type"] == "bullet_list":
                # Create bullet points from content
                lines = content.split('\n')[:5]
                bullet_content = "\n".join([f"• {line.strip()}" for line in lines if line.strip()])
                content_data[f"section_{i}"] = {
                    "type": "bullet_list",
                    "content": bullet_content,
                    "style": section.get("style", {})
                }
        
        return content_data
    
    def is_available(self) -> bool:
        """Check if LLM service is available"""
        return self.client is not None 