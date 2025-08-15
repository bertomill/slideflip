"""
Enhanced LLM service with proper ContentCreatorAgent integration
Rewritten to handle the complete workflow from content planning to slide generation
"""

import logging
import json
from typing import Dict, List, Optional, Any
from openai import OpenAI
from src.core.config import Settings
from src.core.prompt_manager import get_prompt_manager
import re

# Import ContentCreatorAgent for enhanced content generation
try:
    from src.agents.content_creator_agent import ContentCreatorAgent
except ImportError:
    ContentCreatorAgent = None

logger = logging.getLogger(__name__)


class LLMService:
    """
    Enhanced LLM service with intelligent ContentCreatorAgent integration
    
    This service provides:
    1. Intelligent routing between standard LLM and ContentCreatorAgent
    2. Enhanced content generation for minimal input scenarios
    3. Robust error handling and fallback mechanisms
    4. Proper workflow integration for the slide generation pipeline
    """

    def __init__(self):
        self.settings = Settings()
        self.client = None
        self.prompt_manager = get_prompt_manager()
        self.content_creator_agent = ContentCreatorAgent() if ContentCreatorAgent else None
        self._initialize_client()

    def _initialize_client(self):
        """Initialize OpenAI client"""
        try:
            api_key = self.settings.OPENAI_API_KEY
            if api_key:
                self.client = OpenAI(api_key=api_key)
                logger.info("OpenAI client initialized successfully")
            else:
                logger.warning("OpenAI API key not found. LLM features will be disabled.")
                self.client = None
        except Exception as e:
            logger.error(f"Error initializing OpenAI client: {e}")
            self.client = None

    def is_available(self) -> bool:
        """Check if LLM service is available"""
        return self.client is not None

    async def generate_content_plan(
        self,
        description: str,
        research_data: Optional[str] = None,
        theme: str = "default",
        uploaded_files: Optional[List[Dict]] = None,
        theme_info: Optional[Dict] = None,
        use_ai_agent: bool = False,
        content_style: str = "professional"
    ) -> Dict[str, Any]:
        """
        Generate content plan with intelligent agent routing
        
        This method automatically determines the best approach for content generation:
        - Uses ContentCreatorAgent for enhanced content when needed
        - Falls back to standard LLM for structured content
        - Handles minimal input scenarios gracefully
        """
        if not self.client:
            return self._generate_fallback_content_plan(description, uploaded_files)

        logger.info(f"Content planning request: use_ai_agent={use_ai_agent}, content_style={content_style}")

        # Extract uploaded content
        uploaded_content = self._extract_content_from_files(uploaded_files or [])
        
        # Determine if we should use ContentCreatorAgent
        should_use_agent = self._should_use_content_creator_agent(
            use_ai_agent, uploaded_content, description
        )
        
        if should_use_agent and self.content_creator_agent:
            logger.info("🤖 Using ContentCreatorAgent for enhanced content generation")
            return await self._generate_content_plan_with_agent(
                description, uploaded_content, research_data, theme_info, content_style
            )
        elif should_use_agent and not self.content_creator_agent:
            logger.warning("ContentCreatorAgent requested but not available, using direct LLM with enhancement")
            return await self._generate_content_plan_direct(description, research_data, uploaded_files)
        else:
            logger.info("📝 Using standard LLM content planning")
            return await self._generate_content_plan_standard(
                description, research_data, theme, uploaded_files, theme_info
            )

    def _should_use_content_creator_agent(
        self, 
        use_ai_agent: bool, 
        uploaded_content: str, 
        description: str
    ) -> bool:
        """
        Intelligent decision on whether to use ContentCreatorAgent
        
        Uses agent when:
        1. Explicitly requested by user
        2. Content is minimal and needs AI enhancement
        3. Description suggests need for content expansion
        """
        # Use agent if explicitly requested
        if use_ai_agent:
            logger.info("Using ContentCreatorAgent: explicitly requested")
            return True
        
        # Use agent if content is minimal (likely needs enhancement)
        content_len = len(uploaded_content.strip())
        desc_len = len(description.strip())
        
        if content_len < 100 and desc_len < 100:
            logger.info(f"Using ContentCreatorAgent: minimal content (content: {content_len}, desc: {desc_len})")
            return True
        
        # Use agent for very short descriptions that suggest content creation
        short_keywords = ['create', 'generate', 'make slides about', 'presentation on']
        if any(keyword in description.lower() for keyword in short_keywords) and desc_len < 200:
            logger.info("Using ContentCreatorAgent: description suggests content creation")
            return True
        
        return False
    
    def _extract_content_from_files(self, uploaded_files: List[Dict]) -> str:
        """Extract text content from uploaded files"""
        content_parts = []
        for file_info in uploaded_files:
            if isinstance(file_info, dict):
                # Handle different file info formats
                file_path = file_info.get('file_path') or file_info.get('path')
                if file_path:
                    try:
                        with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                            content = f.read().strip()
                            if content:
                                content_parts.append(content)
                                logger.info(f"Extracted {len(content)} chars from {file_path}")
                    except Exception as e:
                        logger.warning(f"Could not read file {file_path}: {e}")
                        
                # Also check if content is directly in the file info
                if 'content' in file_info and file_info['content']:
                    content_parts.append(str(file_info['content']))
        
        total_content = '\n\n'.join(content_parts)
        logger.info(f"Total extracted content: {len(total_content)} characters")
        return total_content
    
    async def _generate_content_plan_with_agent(
        self,
        description: str,
        uploaded_content: str,
        research_data: Optional[str],
        theme_info: Optional[Dict],
        content_style: str
    ) -> Dict[str, Any]:
        """Generate content plan using ContentCreatorAgent"""
        try:
            logger.info("Starting ContentCreatorAgent content generation")
            
            # Use ContentCreatorAgent to create enhanced content
            agent_result = await self.content_creator_agent.create_content(
                uploaded_content=uploaded_content or "Generate creative content based on the description.",
                user_description=description,
                theme_info=theme_info,
                research_data=research_data,
                use_ai_agent=True,
                content_style=content_style
            )
            
            logger.info(f"ContentCreatorAgent returned: {type(agent_result)}")
            
            # Convert agent result to content plan format
            if isinstance(agent_result, dict):
                # Extract the content plan from agent response
                content_plan = (
                    agent_result.get('content_plan') or 
                    agent_result.get('content') or 
                    agent_result.get('slide_content') or
                    str(agent_result)
                )
                
                # Ensure content_plan is a string
                if isinstance(content_plan, dict):
                    content_plan = json.dumps(content_plan, indent=2)
                
                # Create structured response
                return {
                    "content_plan": str(content_plan),
                    "slide_count": agent_result.get('slide_count', 1),
                    "suggestions": agent_result.get('suggestions', [
                        "Enhanced with AI-generated content",
                        "Includes expanded details and context", 
                        "Optimized for presentation flow"
                    ]),
                    "metadata": agent_result.get('metadata', {}),
                    "ai_generated": True,
                    "generation_mode": "ai_agent"
                }
            else:
                # Handle string response
                return {
                    "content_plan": str(agent_result),
                    "slide_count": 1,
                    "suggestions": ["Content enhanced with AI agent"],
                    "ai_generated": True,
                    "generation_mode": "ai_agent"
                }
                
        except Exception as e:
            logger.error(f"Error using ContentCreatorAgent: {e}")
            # Fallback to standard method
            logger.info("Falling back to standard content planning")
            return await self._generate_content_plan_standard(
                description, research_data, "default", [], theme_info
            )
    
    async def _generate_content_plan_standard(
        self,
        description: str,
        research_data: Optional[str],
        theme: str,
        uploaded_files: Optional[List[Dict]],
        theme_info: Optional[Dict]
    ) -> Dict[str, Any]:
        """Generate content plan using standard LLM approach with robust error handling"""
        try:
            logger.info("Starting standard LLM content planning")
            
            # Check if prompt manager and templates are available
            try:
                # Prepare variables for the prompt template
                template_variables = {
                    "description": description,
                    "theme": theme,
                    "research_data": research_data,
                    "uploaded_files": uploaded_files or [],
                    "user_feedback": "",
                    "theme_info": theme_info
                }

                # Render the content planning prompt
                prompt_data = await self.prompt_manager.render_prompt(
                    "content_planning",
                    template_variables
                )

                response = self.client.chat.completions.create(
                    **prompt_data["model_config"],
                    messages=[
                        {"role": "system", "content": prompt_data["system_prompt"]},
                        {"role": "user", "content": prompt_data["user_prompt"]}
                    ]
                )

                plan_text = response.choices[0].message.content.strip()
                logger.info(f"LLM response received: {len(plan_text)} characters")

                # Clean up markdown code blocks if present
                plan_text = self._clean_response_text(plan_text)

                # Try to parse JSON response
                try:
                    plan_data = json.loads(plan_text.strip())
                    logger.info("✅ Successfully parsed content plan JSON")
                    
                    # Ensure content_plan field is a string
                    if isinstance(plan_data.get('content_plan'), dict):
                        plan_data['content_plan'] = json.dumps(plan_data['content_plan'], indent=2)
                    
                    return plan_data
                    
                except json.JSONDecodeError as e:
                    # If JSON parsing fails, create structured response from text
                    logger.warning(f"JSON parsing failed: {e}, creating structured response from text")
                    return self._create_structured_response_from_text(plan_text, description)
            
            except Exception as prompt_error:
                # Prompt template failed, use direct LLM call
                logger.warning(f"Prompt template failed: {prompt_error}, using direct LLM call")
                return await self._generate_content_plan_direct(description, research_data, uploaded_files)

        except Exception as e:
            logger.error(f"Error generating standard content plan: {e}")
            return self._generate_fallback_content_plan(description, uploaded_files)
    
    async def _generate_content_plan_direct(
        self,
        description: str,
        research_data: Optional[str],
        uploaded_files: Optional[List[Dict]]
    ) -> Dict[str, Any]:
        """Direct LLM call when prompt templates fail"""
        try:
            logger.info("Using direct LLM call for content planning")
            
            # Extract content from files
            file_content = self._extract_content_from_files(uploaded_files or [])
            
            # Create a simple, direct prompt
            system_prompt = """You are a helpful assistant that creates presentation content plans. 
Your task is to analyze the provided information and create a structured content plan for a presentation.
Always respond with a clear, detailed content plan in plain text format."""

            user_prompt = f"""Please create a presentation content plan based on:

Description: {description}

Uploaded Content: {file_content[:1000] if file_content else 'No uploaded content'}

Research Data: {research_data[:500] if research_data else 'No research data'}

Create a structured content plan that includes:
1. A clear presentation title
2. Main sections and topics to cover
3. Key points for each section
4. Suggested slide structure

Please provide a comprehensive content plan that can be used to create an engaging presentation."""

            response = self.client.chat.completions.create(
                model="gpt-3.5-turbo",
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt}
                ],
                max_tokens=1000,
                temperature=0.7
            )

            plan_text = response.choices[0].message.content.strip()
            logger.info(f"Direct LLM response: {len(plan_text)} characters")

            return {
                "content_plan": plan_text,
                "slide_count": 5,
                "suggestions": [
                    "Review and refine content structure",
                    "Add visual elements and charts", 
                    "Include relevant examples"
                ],
                "ai_generated": True,
                "generation_mode": "direct_llm"
            }

        except Exception as e:
            logger.error(f"Direct LLM call failed: {e}")
            return self._generate_fallback_content_plan(description, uploaded_files)
    
    def _clean_response_text(self, text: str) -> str:
        """Clean LLM response text by removing markdown code blocks"""
        if text.startswith("```json"):
            text = text[7:]
        elif text.startswith("```"):
            text = text[3:]
        if text.endswith("```"):
            text = text[:-3]
        return text.strip()
    
    def _create_structured_response_from_text(self, text: str, description: str) -> Dict[str, Any]:
        """Create a structured response when JSON parsing fails"""
        return {
            "content_plan": text,
            "slide_count": 1,
            "suggestions": [
                "Review content structure", 
                "Add visual elements", 
                "Enhance with examples"
            ],
            "ai_generated": False,
            "generation_mode": "fallback_text",
            "original_description": description
        }

    def _generate_fallback_content_plan(
        self, 
        description: str, 
        uploaded_files: Optional[List[Dict]] = None
    ) -> Dict[str, Any]:
        """Generate fallback content plan when other methods fail"""
        try:
            logger.info("Generating fallback content plan")
            
            # Extract any available content
            uploaded_content = ""
            if uploaded_files:
                uploaded_content = self._extract_content_from_files(uploaded_files)
            
            # Create basic content plan based on available information
            if uploaded_content:
                content_plan = f"""
Based on your uploaded content and description: "{description}"

Key Content Points:
{uploaded_content[:500]}{'...' if len(uploaded_content) > 500 else ''}

Suggested Slide Structure:
1. Title: {description.split('.')[0] if description else 'Presentation Title'}
2. Main Content: Key insights from your uploaded material
3. Supporting Details: Additional context and examples
4. Conclusion: Summary and next steps
"""
            else:
                # Create content even with minimal input
                content_plan = f"""
Presentation Topic: {description}

Suggested Content Structure:
1. Introduction to {description}
2. Key concepts and definitions
3. Main points and examples
4. Applications and use cases
5. Conclusion and takeaways

Note: This is a basic structure. Consider adding more specific content, research data, or visual elements to enhance your presentation.
"""

            return {
                "content_plan": content_plan,
                "slide_count": 5,
                "suggestions": [
                    "Add more specific examples",
                    "Include relevant research or data",
                    "Consider adding visual elements",
                    "Expand on key concepts"
                ],
                "metadata": {
                    "generation_method": "fallback",
                    "has_uploaded_content": bool(uploaded_content),
                    "content_length": len(uploaded_content)
                },
                "ai_generated": False
            }

        except Exception as e:
            logger.error(f"Error generating fallback content plan: {e}")
            return {
                "content_plan": f"Content plan for: {description}\n\nPlease provide more details to generate a comprehensive content plan.",
                "slide_count": 1,
                "suggestions": ["Provide more detailed input"],
                "ai_generated": False,
                "error": str(e)
            }

    # Additional methods for other LLM operations can be added here
    async def generate_completion(
        self,
        system_prompt: str,
        user_prompt: str,
        **kwargs
    ) -> str:
        """Generate a completion using the LLM"""
        try:
            if not self.client:
                return "LLM service not available"
                
            response = self.client.chat.completions.create(
                model="gpt-3.5-turbo",
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt}
                ],
                **kwargs
            )
            
            return response.choices[0].message.content.strip()
            
        except Exception as e:
            logger.error(f"Error generating completion: {e}")
            return f"Error: {str(e)}"