"""
LLM service for slide generation using OpenAI GPT
"""

import logging
import json
from typing import Dict, List, Optional, Any
import openai
from src.core.config import Settings

logger = logging.getLogger(__name__)

class LLMService:
    """Service for LLM-based slide generation and knowledge graph extraction"""
    
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
                self.client = openai.OpenAI(api_key=api_key)
                logger.info("OpenAI client initialized successfully")
            else:
                logger.warning("OpenAI API key not found. LLM features will be disabled.")
                logger.info("Please check:")
                logger.info("1. .env file exists in backend directory")
                logger.info("2. OPENAI_API_KEY is set in .env file")
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
                max_tokens=2000,
                temperature=0.8,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt}
                ]
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
                max_tokens=2500,
                temperature=0.8,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt}
                ]
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

    async def generate_content(
        self, 
        prompt: str, 
        max_tokens: int = 2000,
        system_prompt: str = None
    ) -> str:
        """
        Generate content using LLM for general purposes
        
        Args:
            prompt: User prompt for content generation
            max_tokens: Maximum tokens for the response
            system_prompt: Optional system prompt to override default
            
        Returns:
            Generated content as string
        """
        if not self.client:
            logger.warning("OpenAI client not available. Cannot generate content.")
            return ""
        
        try:
            # Use default system prompt if none provided
            if not system_prompt:
                system_prompt = """You are a helpful AI assistant that provides clear, concise, and accurate responses. 
                Follow the user's instructions carefully and format your response appropriately."""
            
            # Create the message request
            response = self.client.chat.completions.create(
                model="gpt-4o",
                max_tokens=max_tokens,
                temperature=0.7,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": prompt}
                ]
            )
            
            # Extract the generated content
            generated_content = response.choices[0].message.content.strip()
            logger.info(f"Successfully generated content with {len(generated_content)} characters")
            
            return generated_content
            
        except Exception as e:
            logger.error(f"Error generating content: {e}")
            return ""

    async def extract_knowledge_graph_from_chunk(
        self, 
        content: str, 
        chunk_index: int,
        filename: str,
        file_path: str
    ) -> Dict[str, Any]:
        """
        Extract entities, relationships, and facts from a content chunk using LLM
        
        Args:
            content: Text content chunk to analyze
            chunk_index: Index of the chunk in the file
            filename: Name of the source file
            file_path: Path to the source file
            
        Returns:
            Dictionary containing extracted entities, relationships, and facts
        """
        if not self.client:
            logger.warning("LLM client not available, returning empty knowledge graph data")
            return self._generate_empty_knowledge_graph_data(chunk_index, filename, file_path)
        
        try:
            system_prompt = """You are an expert knowledge graph extraction specialist. Your task is to analyze text content and extract ONLY three types of information:

1. ENTITIES: Named entities, concepts, organizations, people, places, etc.
2. RELATIONSHIPS: Connections between entities (subject-verb-object relationships)
3. FACTS: Key factual information, statistics, claims, or assertions

CRITICAL REQUIREMENTS:
- Return ONLY a JSON object with the exact structure specified
- Do not include any explanations, markdown, or additional text
- Focus on factual, extractable information
- Be precise and accurate
- Do not generate or invent information not present in the text

Return ONLY this JSON structure (no other text):
{
    "entities": [
        {
            "id": "unique_entity_id",
            "name": "entity_name",
            "type": "entity_type",
            "description": "brief_description",
        }
    ],
    "relationships": [
        {
            "id": "unique_relationship_id",
            "source_entity": "source_entity_id",
            "target_entity": "target_entity_id",
            "relationship_type": "relationship_label",
        }
    ],
    "facts": [
        {
            "id": "unique_fact_id",
            "content": "factual_statement",
            "source_entities": ["entity_id1", "entity_id2"],
        }
    ]
}"""

            user_prompt = f"""Analyze the following text content and extract entities, relationships, and facts:

TEXT CONTENT:
{content}

EXTRACTION TASK:
Extract ONLY:
1. Named entities (people, organizations, places, concepts, etc.)
2. Relationships between entities (who does what to whom, what connects what, etc.)
3. Key facts, statistics, or assertions from the text

Return the JSON structure as specified in the system prompt. Be thorough but accurate."""

            response = self.client.chat.completions.create(
                model="gpt-4o",
                max_tokens=2000,
                temperature=0.1,  # Low temperature for more consistent extraction
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt}
                ]
            )
            
            extraction_text = response.choices[0].message.content.strip()
            
            # Clean up markdown code blocks if present
            if extraction_text.startswith("```json"):
                extraction_text = extraction_text[7:]
            elif extraction_text.startswith("```"):
                extraction_text = extraction_text[3:]
            
            if extraction_text.endswith("```"):
                extraction_text = extraction_text[:-3]
            
            extraction_text = extraction_text.strip()
            
            try:
                extraction_data = json.loads(extraction_text)
                
                # Validate the structure
                required_fields = ["entities", "relationships", "facts"]
                for field in required_fields:
                    if field not in extraction_data:
                        extraction_data[field] = []
                    if not isinstance(extraction_data[field], list):
                        extraction_data[field] = []
                
                # Add metadata
                extraction_data["metadata"] = {
                    "chunk_index": chunk_index,
                    "filename": filename,
                    "file_path": file_path,
                    "chunk_content": content,
                    "extraction_timestamp": self._get_current_timestamp()
                }

                logger.info(f"Extraction data: {extraction_data}")
                
                logger.info(f"Successfully extracted knowledge graph data from chunk {chunk_index}")
                logger.info(f"  Entities: {len(extraction_data['entities'])}")
                logger.info(f"  Relationships: {len(extraction_data['relationships'])}")
                logger.info(f"  Facts: {len(extraction_data['facts'])}")
                
                return extraction_data
                
            except (json.JSONDecodeError, ValueError) as e:
                logger.warning(f"Failed to parse knowledge graph extraction response: {e}")
                logger.warning(f"Raw response: {extraction_text}")
                logger.info("Using fallback knowledge graph extraction")
                return self._generate_fallback_knowledge_graph_data(content, chunk_index, filename, file_path)
                
        except Exception as e:
            logger.error(f"Error extracting knowledge graph from chunk: {e}")
            return self._generate_fallback_knowledge_graph_data(content, chunk_index, filename, file_path)

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

    def _generate_empty_knowledge_graph_data(self, chunk_index: int, filename: str, file_path: str) -> Dict[str, Any]:
        """Generate empty knowledge graph data when LLM is not available"""
        return {
            "entities": [],
            "relationships": [],
            "facts": [],
            "metadata": {
                "chunk_index": chunk_index,
                "filename": filename,
                "file_path": file_path,
                "chunk_content": "",
                "extraction_timestamp": self._get_current_timestamp(),
                "note": "LLM not available - empty data generated"
            }
        }

    def _generate_fallback_knowledge_graph_data(self, content: str, chunk_index: int, filename: str, file_path: str) -> Dict[str, Any]:
        """Generate fallback knowledge graph data when LLM extraction fails"""
        # Simple fallback: extract basic entities from text
        # TODO: Do this using spacy
        entities = []
        relationships = []
        facts = []
        
        # Extract basic entities (capitalized words that might be entities)
        words = content.split()
        for i, word in enumerate(words):
            if word and word[0].isupper() and len(word) > 2:
                # Simple heuristic for entity detection
                entity_id = f"entity_{chunk_index}_{i}"
                entities.append({
                    "id": entity_id,
                    "name": word,
                    "type": "unknown",
                    "description": f"Extracted from chunk {chunk_index}",
                })
        
        return {
            "entities": entities,
            "relationships": relationships,
            "facts": facts,
            "metadata": {
                "chunk_index": chunk_index,
                "filename": filename,
                "file_path": file_path,
                "chunk_content": content,
                "extraction_timestamp": self._get_current_timestamp(),
                "note": "Fallback extraction used due to LLM failure"
            }
        }

    def _get_current_timestamp(self) -> str:
        """Get current timestamp as string"""
        from datetime import datetime
        return datetime.now().isoformat()
    
    def is_available(self) -> bool:
        """Check if LLM service is available"""
        return self.client is not None 

    async def generate_slide_html(
        self,
        description: str,
        theme: str = "Professional",
        researchData: Optional[str] = None,
        contentPlan: Optional[str] = None,
        userFeedback: Optional[str] = None,
        documents: Optional[List[Dict[str, Any]]] = None,
        model: str = "gpt-4o"
    ) -> str:
        """
        Generate professional PowerPoint slide in HTML format using enhanced prompt engineering
        
        This method uses the same advanced prompt engineering approach as the successful frontend endpoint
        """
        if not self.client:
            raise Exception("LLM service not available")
        
        try:
            # PROMPT CONSTRUCTION: Build the comprehensive prompt for OpenAI GPT based on available data
            # This prompt engineering approach ensures consistent, high-quality slide generation
            # by providing clear requirements, examples, and constraints to the AI model
            prompt = f"""Create a professional PowerPoint slide in HTML format based on the following requirements:

SLIDE DESCRIPTION: {description}

THEME: {theme}

"""

            # Add content plan from content planning step if available
            # This provides structured guidance for what should be included on the slide
            if contentPlan:
                prompt += f"""CONTENT PLAN:
{contentPlan}

"""

            # Add user feedback and additional requirements if provided
            # This allows for iterative improvements and specific user requests
            if userFeedback:
                prompt += f"""USER FEEDBACK & ADDITIONAL REQUIREMENTS:
{userFeedback}

"""

            # Append research data to prompt if provided by user
            # This allows AI to incorporate relevant insights and statistics
            if researchData:
                prompt += f"""RESEARCH DATA TO INCORPORATE:
{researchData}

"""

            # Add parsed document content if available
            # This provides the actual content from uploaded documents for AI to use
            if documents and len(documents) > 0:
                prompt += "DOCUMENT CONTENT:\n"

                # If we have parsed document content, include the actual text
                if len(documents) > 0 and isinstance(documents[0], dict) and 'content' in documents[0]:
                    # documents contains parsed content
                    for index, doc in enumerate(documents):
                        if doc.get('success') and doc.get('content'):
                            prompt += f"Document {index + 1} ({doc.get('filename', 'unknown')}):\n{doc['content']}\n\n"
                        else:
                            prompt += f"Document {index + 1} ({doc.get('filename', 'unknown')}): [Content extraction failed]\n\n"
                else:
                    # Fallback: just mention document count if no parsed content available
                    prompt += f"User has uploaded {len(documents)} document(s) for reference.\n\n"

            # TEMPLATE EXAMPLES: Provide example templates for consistency
            templatesContent = """EXAMPLE TEMPLATES TO FOLLOW:
Here are examples of well-designed slides that you should use as inspiration for structure, styling, and layout:

<!DOCTYPE html>
<html>
<head>
<style>
.slide-main { 
  width: 100%; 
  height: 100%; 
  background: white; 
  padding: 40px; 
  box-sizing: border-box; 
  font-family: Arial, sans-serif;
  display: flex;
  flex-direction: column;
  justify-content: center;
}
.slide-main h1 { color: #1a1a1a; font-size: 2.5rem; margin-bottom: 1rem; }
.slide-main p { color: #333333; font-size: 1.1rem; line-height: 1.6; }
</style>
</head>
<body>
<div class="slide-main">
  <!-- Your slide content here -->
</div>
</body>
</html>

Please create a slide that follows similar structural patterns, CSS scoping practices, and professional styling as shown in the example above.

"""

            prompt += templatesContent

            # Add theme-specific styling guidance
            theme_guidance = ""
            if theme.lower() == "professional":
                theme_guidance = """
THEME-SPECIFIC GUIDANCE (Professional):
- Use clean, corporate style with blue/gray color schemes
- Prefer structured layouts with clear hierarchy
- Use conservative fonts and spacing
- Include subtle gradients and shadows
- Maintain business-appropriate color palette
"""
            elif theme.lower() == "creative":
                theme_guidance = """
THEME-SPECIFIC GUIDANCE (Creative):
- Use vibrant colors with artistic gradients and patterns
- Embrace bold typography and creative layouts
- Include dynamic visual elements
- Use energetic color combinations
- Allow for more expressive design choices
"""
            elif theme.lower() == "minimal":
                theme_guidance = """
THEME-SPECIFIC GUIDANCE (Minimal):
- Clean, simple design with lots of white space
- Use minimal color palette (primarily black, white, gray)
- Focus on typography and spacing
- Avoid unnecessary decorative elements
- Emphasize content over visual flourishes
"""
            elif theme.lower() == "modern":
                theme_guidance = """
THEME-SPECIFIC GUIDANCE (Modern):
- Contemporary design with bold typography
- Use current design trends and techniques
- Include geometric shapes and clean lines
- Use modern color schemes and gradients
- Emphasize sleek, cutting-edge appearance
"""
            
            if theme_guidance:
                prompt += theme_guidance

            # SLIDE GENERATION REQUIREMENTS: Complete the prompt with detailed requirements and style guidelines
            # This section emphasizes accessibility, readability, and professional appearance
            # Key focus areas: CSS scoping, accessibility compliance, and embeddable HTML output
            prompt += f"""REQUIREMENTS:
1. Create a complete HTML slide that looks professional and presentation-ready
2. Use modern CSS styling with the {theme} theme
3. Incorporate the research data naturally into the slide content
4. Make it visually appealing with proper typography, spacing, and layout
5. Include relevant data points, statistics, or insights from the research
6. Use a clean, readable design suitable for presentations
7. Ensure the slide is self-contained with scoped CSS that won't affect parent elements
8. Make it responsive and well-structured
9. CRITICAL: Design for 16:9 aspect ratio (PowerPoint slide dimensions) - the slide will be displayed in a container with 16:9 proportions

ASPECT RATIO REQUIREMENTS:
// ============================================================================
// 16:9 ASPECT RATIO OPTIMIZATION: Critical design constraints for slide display
// ============================================================================
// The generated slide must work perfectly within a 16:9 aspect ratio container
// This ensures consistency between web preview and PowerPoint export formats
- Design the slide content to work optimally in a 16:9 aspect ratio container
- This matches standard PowerPoint slide dimensions (1920x1080, 1280x720, etc.)
- Content should be well-proportioned and not cramped when displayed in this format
- Use appropriate font sizes and spacing that work well in the 16:9 format
- Consider that the slide will be viewed at various sizes but always maintain 16:9 proportions

OUTPUT FORMAT:
Return a complete, self-contained HTML slide that can be embedded safely. You can choose either:
1. A complete HTML document with scoped CSS in the <head> (recommended for complex layouts)
2. A single container div with inline <style> tag containing scoped CSS (simpler embedding)

CRITICAL CSS SCOPING REQUIREMENTS:
- ALL CSS must be scoped to prevent affecting the parent page
- If using a complete HTML document, scope all styles to a main container class
- If using a div container, scope all styles to that container class
- NEVER use global selectors like body, html, *, or unscoped element selectors
- Example: Use ".slide-container h1" instead of just "h1"
- Example: Use ".slide-container .title" instead of just ".title"

STYLE GUIDELINES:
- Use professional fonts (Arial, Helvetica, or similar)
- CRITICAL: Ensure high contrast text - use dark text (#333333 or darker) on light backgrounds, never light grey text
- Main headings should be #1a1a1a or #000000 for maximum readability
- Body text should be #333333 minimum, never lighter than #555555
- Background colors should provide strong contrast with text
- Include appropriate margins, padding, and spacing optimized for 16:9 viewing
- Use bullet points, headings, and visual hierarchy effectively
- Incorporate any statistics or data points from the research prominently
- Make the layout clean and uncluttered, suitable for 16:9 presentation format
- Test color combinations for WCAG accessibility standards

PREFERRED STRUCTURE (Option 1 - Complete HTML):
<!DOCTYPE html>
<html>
<head>
<style>
.slide-main {{ 
  width: 100%; 
  height: 100%; 
  background: white; 
  padding: 40px; 
  box-sizing: border-box; 
  font-family: Arial, sans-serif;
  display: flex;                    /* Enable flexbox layout for vertical centering */
  flex-direction: column;           /* Stack content vertically */
  justify-content: center;          /* Center content vertically in 16:9 container */
}}
.slide-main h1 {{ color: #1a1a1a; font-size: 2.5rem; margin-bottom: 1rem; }}
.slide-main p {{ color: #333333; font-size: 1.1rem; line-height: 1.6; }}
</style>
</head>
<body>
<div class="slide-main">
  <!-- Your slide content here -->
</div>
</body>
</html>

ALTERNATIVE STRUCTURE (Option 2 - Container div):
<div class="slide-container" style="width: 100%; height: 100%; background: white; padding: 40px; box-sizing: border-box; font-family: Arial, sans-serif; display: flex; flex-direction: column; justify-content: center;">
  <style>
    .slide-container h1 {{ color: #1a1a1a; font-size: 2.5rem; margin-bottom: 1rem; }}
    .slide-container p {{ color: #333333; font-size: 1.1rem; line-height: 1.6; }}
  </style>
  <!-- Your slide content here -->
</div>"""

ASPECT RATIO REQUIREMENTS:
// ============================================================================
// 16:9 ASPECT RATIO OPTIMIZATION: Critical design constraints for slide display
// ============================================================================
// The generated slide must work perfectly within a 16:9 aspect ratio container
// This ensures consistency between web preview and PowerPoint export formats
- Design the slide content to work optimally in a 16:9 aspect ratio container
- This matches standard PowerPoint slide dimensions (1920x1080, 1280x720, etc.)
- Content should be well-proportioned and not cramped when displayed in this format
- Use appropriate font sizes and spacing that work well in the 16:9 format
- Consider that the slide will be viewed at various sizes but always maintain 16:9 proportions

OUTPUT FORMAT:
Return a complete, self-contained HTML slide that can be embedded safely. You can choose either:
1. A complete HTML document with scoped CSS in the <head> (recommended for complex layouts)
2. A single container div with inline <style> tag containing scoped CSS (simpler embedding)

CRITICAL CSS SCOPING REQUIREMENTS:
- ALL CSS must be scoped to prevent affecting the parent page
- If using a complete HTML document, scope all styles to a main container class
- If using a div container, scope all styles to that container class
- NEVER use global selectors like body, html, *, or unscoped element selectors
- Example: Use ".slide-container h1" instead of just "h1"
- Example: Use ".slide-container .title" instead of just ".title"

STYLE GUIDELINES:
- Use professional fonts (Arial, Helvetica, or similar)
- CRITICAL: Ensure high contrast text - use dark text (#333333 or darker) on light backgrounds, never light grey text
- Main headings should be #1a1a1a or #000000 for maximum readability
- Body text should be #333333 minimum, never lighter than #555555
- Background colors should provide strong contrast with text
- Include appropriate margins, padding, and spacing optimized for 16:9 viewing
- Use bullet points, headings, and visual hierarchy effectively
- Incorporate any statistics or data points from the research prominently
- Make the layout clean and uncluttered, suitable for 16:9 presentation format
- Test color combinations for WCAG accessibility standards

PREFERRED STRUCTURE (Option 1 - Complete HTML):
<!DOCTYPE html>
<html>
<head>
<style>
.slide-main {{ 
  width: 100%; 
  height: 100%; 
  background: white; 
  padding: 40px; 
  box-sizing: border-box; 
  font-family: Arial, sans-serif;
  display: flex;                    /* Enable flexbox layout for vertical centering */
  flex-direction: column;           /* Stack content vertically */
  justify-content: center;          /* Center content vertically in 16:9 container */
}}
.slide-main h1 {{ color: #1a1a1a; font-size: 2.5rem; margin-bottom: 1rem; }}
.slide-main p {{ color: #333333; font-size: 1.1rem; line-height: 1.6; }}
</style>
</head>
<body>
<div class="slide-main">
  <!-- Your slide content here -->
</div>
</body>
</html>

ALTERNATIVE STRUCTURE (Option 2 - Container div):
<div class="slide-container" style="width: 100%; height: 100%; background: white; padding: 40px; box-sizing: border-box; font-family: Arial, sans-serif; display: flex; flex-direction: column; justify-content: center;">
  <style>
    .slide-container h1 {{ color: #1a1a1a; font-size: 2.5rem; margin-bottom: 1rem; }}
    .slide-container p {{ color: #333333; font-size: 1.1rem; line-height: 1.6; }}
  </style>
  <!-- Your slide content here -->
</div>"""

            # Make API call to OpenAI GPT for slide generation
            # Using specific model, temperature, and token limits for optimal results
            completion = self.client.chat.completions.create(
                model=model,
                max_tokens=2000,  # Sufficient tokens for complete HTML slide generation
                temperature=0.7,  # Balanced creativity while maintaining consistency
                messages=[
                    {
                        "role": "system",
                        "content": "You are an expert presentation designer who creates professional, visually appealing PowerPoint slides with excellent accessibility and readability. You NEVER use light grey text on light backgrounds and always ensure high contrast ratios. You ALWAYS create complete, working HTML slides that render properly when embedded. You ALWAYS scope ALL CSS to prevent affecting parent page styles. You specialize in incorporating research data and creating clean, modern slide layouts with proper typography contrast. You return valid HTML that displays immediately without errors."
                    },
                    {
                        "role": "user",
                        "content": prompt
                    }
                ]
            )

            # Extract the generated slide HTML content from OpenAI response
            slide_html = completion.choices[0].message.content

            # Validate that content was actually generated
            if not slide_html:
                raise Exception('No slide content generated')

            # Clean up the response by extracting HTML from markdown code blocks
            # OpenAI sometimes wraps HTML in markdown formatting that needs removal
            if '```html' in slide_html:
                # Extract content from HTML-specific code blocks
                import re
                html_match = re.search(r'```html\n([\s\S]*?)\n```', slide_html)
                if html_match:
                    slide_html = html_match.group(1)
            elif '```' in slide_html:
                # Extract content from generic code blocks
                import re
                code_match = re.search(r'```[a-zA-Z]*\n([\s\S]*?)\n```', slide_html)
                if code_match:
                    slide_html = code_match.group(1)

            # RESPONSE VALIDATION: Debug logging to monitor OpenAI output quality and format
            # These logs help troubleshoot issues with slide generation and ensure we receive valid HTML
            logger.info(f'Generated slide HTML length: {len(slide_html)}')
            logger.info(f'Generated slide HTML preview: {slide_html[:200]}...')

            # CONTENT VALIDATION: Verify that OpenAI returned actual HTML markup
            # Check for common HTML elements to ensure the response contains valid slide content
            # This helps catch cases where OpenAI might return plain text or malformed responses
            if not ('<div' in slide_html or '<html' in slide_html):
                logger.warning('Warning: Generated content may not be valid HTML')

            return slide_html.strip()  # Remove any leading/trailing whitespace

        except Exception as e:
            logger.error(f"Error generating slide HTML: {e}")
            raise Exception(f"Failed to generate slide: {str(e)}") 