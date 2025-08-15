"""
LLM service for slide generation using OpenAI GPT
"""

import logging
import json
from typing import Dict, List, Optional, Any
import openai
from src.core.config import Settings
from src.prompts.prompt_loader import PromptLoader

logger = logging.getLogger(__name__)

class LLMService:
    """Service for LLM-based slide generation and knowledge graph extraction"""
    
    def __init__(self):
        self.settings = Settings()
        self.client = None
        self.prompt_loader = PromptLoader()
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
            
            # Load prompts from external files
            system_variables = {"theme_context": theme_context}
            user_variables = {
                "content": content[:3000] if len(content) > 3000 else content,
                "description": description,
                "theme": theme,
                "media_availability": 'Images available' if has_images else 'Text content only'
            }
            
            system_prompt, user_prompt = self.prompt_loader.load_system_user_prompts(
                "slide_layout_prompt", 
                "layout", 
                system_variables, 
                user_variables
            )

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
            
            # Load prompts from external files
            system_variables = {"theme_context": theme_context}
            user_variables = {
                "content": content[:3000] + "..." if len(content) > 3000 else content,
                "description": description,
                "layout_structure": json.dumps(layout, indent=2)
            }
            
            system_prompt, user_prompt = self.prompt_loader.load_system_user_prompts(
                "slide_content_prompt", 
                "content", 
                system_variables, 
                user_variables
            )

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
            # Load prompts from external files
            system_variables = {}
            user_variables = {
                "content": content
            }
            
            system_prompt, user_prompt = self.prompt_loader.load_system_user_prompts(
                "knowledge_graph_prompt", 
                "extraction", 
                system_variables, 
                user_variables
            )

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
        Generate professional PowerPoint slide in HTML format using the same prompt engineering as frontend
        
        This method replicates the exact logic from the frontend /api/generate-slide endpoint
        """
        if not self.client:
            raise Exception("LLM service not available")
        
        try:
            # Build optional content sections dynamically
            content_plan = ""
            if contentPlan:
                content_plan = f"""CONTENT PLAN:
{contentPlan}

"""

            user_feedback = ""
            if userFeedback:
                user_feedback = f"""USER FEEDBACK & ADDITIONAL REQUIREMENTS:
{userFeedback}

"""

            research_data = ""
            if researchData:
                research_data = f"""RESEARCH DATA TO INCORPORATE:
{researchData}

"""

            document_content = ""
            if documents and len(documents) > 0:
                document_content = "DOCUMENT CONTENT:\n"

                # If we have parsed document content, include the actual text
                if len(documents) > 0 and isinstance(documents[0], dict) and 'content' in documents[0]:
                    # documents contains parsed content
                    for index, doc in enumerate(documents):
                        if doc.get('success') and doc.get('content'):
                            document_content += f"Document {index + 1} ({doc.get('filename', 'unknown')}):\n{doc['content']}\n\n"
                        else:
                            document_content += f"Document {index + 1} ({doc.get('filename', 'unknown')}): [Content extraction failed]\n\n"
                else:
                    # Fallback: just mention document count if no parsed content available
                    document_content += f"User has uploaded {len(documents)} document(s) for reference.\n\n"

            # Build templates content (for future integration with template service)
            # TODO: Replace this hardcoded template with dynamic template fetching from template service
            # This allows different templates based on theme, user preferences, or A/B testing
            templatesContent = f"""EXAMPLE TEMPLATE TO FOLLOW:
Here is an example of a well-designed slide that you should use as inspiration for structure, styling, and layout:

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

Please create a slide that follows similar structural patterns, CSS scoping practices, and professional styling as shown in the example above.

"""

            # Load prompts from external files
            system_variables = {}
            user_variables = {
                "description": description,
                "theme": theme,
                "content_plan": content_plan,
                "user_feedback": user_feedback,
                "research_data": research_data,
                "document_content": document_content,
                "templates_content": templatesContent
            }
            
            system_prompt, user_prompt = self.prompt_loader.load_system_user_prompts(
                "html_generation_prompt", 
                "slide_html", 
                system_variables, 
                user_variables
            )

            # Make API call to OpenAI GPT for slide generation
            # Using specific model, temperature, and token limits for optimal results
            completion = self.client.chat.completions.create(
                model=model,
                max_tokens=2000,  # Sufficient tokens for complete HTML slide generation
                temperature=0.7,  # Balanced creativity while maintaining consistency
                messages=[
                    {
                        "role": "system",
                        "content": system_prompt
                    },
                    {
                        "role": "user",
                        "content": user_prompt
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