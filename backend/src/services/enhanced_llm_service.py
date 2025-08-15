"""
Simplified and robust LLM service that handles all content planning scenarios
Designed to work reliably with minimal dependencies and robust error handling
"""

import logging
import json
from typing import Dict, List, Optional, Any
from openai import OpenAI
from src.core.config import Settings

logger = logging.getLogger(__name__)


class EnhancedLLMService:
    """
    Simplified LLM service with robust content generation
    
    This service provides reliable content planning with multiple fallback levels:
    1. Direct OpenAI calls with optimized prompts
    2. ContentCreatorAgent integration when available
    3. Fallback content generation for any scenario
    """

    def __init__(self):
        self.settings = Settings()
        self.client = None
        self.content_creator_agent = self._init_content_creator_agent()
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

    def _init_content_creator_agent(self):
        """Initialize ContentCreatorAgent with proper error handling"""
        try:
            from src.agents.content_creator_agent import ContentCreatorAgent
            agent = ContentCreatorAgent()
            logger.info("ContentCreatorAgent initialized successfully")
            return agent
        except Exception as e:
            logger.info(f"ContentCreatorAgent not available: {e}")
            return None

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
        Generate content plan with intelligent routing and robust fallbacks
        """
        if not self.client:
            logger.warning("OpenAI client not available, using fallback")
            return self._generate_fallback_content_plan(description, uploaded_files)

        logger.info(f"🎯 Content planning: AI agent={use_ai_agent}, style={content_style}")

        # Extract content from uploaded files
        uploaded_content = self._extract_content_from_files(uploaded_files or [])
        
        # Route to appropriate generation method
        try:
            if use_ai_agent and self.content_creator_agent:
                logger.info("🤖 Using ContentCreatorAgent")
                return await self._generate_with_content_agent(
                    description, uploaded_content, research_data, theme_info, content_style
                )
            elif use_ai_agent:
                logger.info("🚀 Using enhanced AI generation (ContentCreatorAgent not available)")
                return await self._generate_enhanced_content(
                    description, uploaded_content, research_data, content_style
                )
            else:
                logger.info("📝 Using standard content generation")
                return await self._generate_standard_content(
                    description, uploaded_content, research_data
                )
        except Exception as e:
            logger.error(f"Content generation failed: {e}")
            return self._generate_fallback_content_plan(description, uploaded_files)

    def _extract_content_from_files(self, uploaded_files: List[Dict]) -> str:
        """Extract text content from uploaded files"""
        content_parts = []
        for file_info in uploaded_files:
            if isinstance(file_info, dict):
                file_path = file_info.get('file_path') or file_info.get('path')
                if file_path:
                    try:
                        with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                            content = f.read().strip()
                            if content:
                                content_parts.append(content)
                                logger.info(f"📖 Extracted {len(content)} chars from {file_path}")
                    except Exception as e:
                        logger.warning(f"Could not read file {file_path}: {e}")
        
        total_content = '\n\n'.join(content_parts)
        logger.info(f"📊 Total content extracted: {len(total_content)} characters")
        return total_content

    async def _generate_with_content_agent(
        self,
        description: str,
        uploaded_content: str,
        research_data: Optional[str],
        theme_info: Optional[Dict],
        content_style: str
    ) -> Dict[str, Any]:
        """Generate content using ContentCreatorAgent"""
        try:
            logger.info("🤖 Starting ContentCreatorAgent generation")
            
            agent_result = await self.content_creator_agent.create_content(
                uploaded_content=uploaded_content or f"Create content about: {description}",
                user_description=description,
                theme_info=theme_info,
                research_data=research_data,
                use_ai_agent=True,
                content_style=content_style
            )
            
            logger.info(f"✅ ContentCreatorAgent completed: {type(agent_result)}")
            
            # Format agent result
            if isinstance(agent_result, dict):
                content_plan = str(agent_result.get('content_plan', agent_result.get('content', str(agent_result))))
                return {
                    "content_plan": content_plan,
                    "slide_count": agent_result.get('slide_count', 3),
                    "suggestions": agent_result.get('suggestions', [
                        "AI-enhanced content with expanded details",
                        "Optimized structure and flow",
                        "Professional formatting and style"
                    ]),
                    "ai_generated": True,
                    "generation_mode": "content_creator_agent",
                    "metadata": agent_result.get('metadata', {})
                }
            else:
                return {
                    "content_plan": str(agent_result),
                    "slide_count": 3,
                    "suggestions": ["Enhanced with ContentCreatorAgent"],
                    "ai_generated": True,
                    "generation_mode": "content_creator_agent"
                }
                
        except Exception as e:
            logger.error(f"ContentCreatorAgent failed: {e}")
            # Fallback to enhanced generation
            return await self._generate_enhanced_content(description, uploaded_content, research_data, content_style)

    async def _generate_enhanced_content(
        self,
        description: str,
        uploaded_content: str,
        research_data: Optional[str],
        content_style: str
    ) -> Dict[str, Any]:
        """Generate enhanced content using direct LLM calls optimized for minimal input"""
        try:
            logger.info("🚀 Starting enhanced AI content generation")
            
            # Create context-aware prompt that works with minimal input
            system_prompt = f"""You are an expert presentation content creator. Your task is to generate comprehensive, engaging presentation content from minimal input.

Style: {content_style}
Goal: Create detailed, structured presentation content that expands on the given topic.

Always provide:
1. A compelling title
2. Clear section structure
3. Detailed content for each section
4. Key takeaways and insights
5. Engaging examples and explanations

Be creative and expansive - turn brief topics into rich, informative content."""

            # Build comprehensive user prompt
            user_prompt_parts = [f"Create a comprehensive presentation about: {description}"]
            
            if uploaded_content:
                user_prompt_parts.append(f"\nBased on this uploaded content:\n{uploaded_content}")
            
            if research_data:
                user_prompt_parts.append(f"\nIncorporating this research:\n{research_data[:500]}...")
            
            user_prompt_parts.append(f"""

Please generate a detailed presentation content plan that includes:

1. **Title**: Create an engaging presentation title
2. **Introduction**: Hook the audience and set context
3. **Main Content**: 3-5 detailed sections with:
   - Clear headings
   - Rich content and explanations
   - Relevant examples or case studies
   - Key insights and takeaways
4. **Conclusion**: Summary and call-to-action

Make the content engaging, informative, and suitable for a professional presentation. Expand on the topic with relevant details, examples, and insights even if the input is minimal."""

            user_prompt = '\n'.join(user_prompt_parts)

            response = self.client.chat.completions.create(
                model="gpt-3.5-turbo",
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt}
                ],
                max_tokens=1500,
                temperature=0.7
            )

            content_plan = response.choices[0].message.content.strip()
            logger.info(f"✅ Enhanced content generated: {len(content_plan)} characters")

            return {
                "content_plan": content_plan,
                "slide_count": 5,
                "suggestions": [
                    "AI-enhanced content with expanded details",
                    "Rich context and examples included",
                    "Professional structure and flow",
                    "Ready for visual enhancement"
                ],
                "ai_generated": True,
                "generation_mode": "enhanced_ai"
            }

        except Exception as e:
            logger.error(f"Enhanced content generation failed: {e}")
            return await self._generate_standard_content(description, uploaded_content, research_data)

    async def _generate_standard_content(
        self,
        description: str,
        uploaded_content: str,
        research_data: Optional[str]
    ) -> Dict[str, Any]:
        """Generate standard content using basic LLM approach"""
        try:
            logger.info("📝 Starting standard content generation")
            
            system_prompt = """You are a helpful assistant that creates presentation content. Generate clear, structured content based on the provided information."""

            content_parts = [f"Topic: {description}"]
            if uploaded_content:
                content_parts.append(f"Content: {uploaded_content}")
            if research_data:
                content_parts.append(f"Research: {research_data}")

            user_prompt = f"Create presentation content for:\n\n" + "\n\n".join(content_parts)

            response = self.client.chat.completions.create(
                model="gpt-3.5-turbo",
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt}
                ],
                max_tokens=800,
                temperature=0.6
            )

            content_plan = response.choices[0].message.content.strip()
            logger.info(f"✅ Standard content generated: {len(content_plan)} characters")

            return {
                "content_plan": content_plan,
                "slide_count": 3,
                "suggestions": [
                    "Review content structure",
                    "Add visual elements",
                    "Enhance with examples"
                ],
                "ai_generated": True,
                "generation_mode": "standard"
            }

        except Exception as e:
            logger.error(f"Standard content generation failed: {e}")
            return self._generate_fallback_content_plan(description, [])

    def _generate_fallback_content_plan(
        self, 
        description: str, 
        uploaded_files: Optional[List[Dict]] = None
    ) -> Dict[str, Any]:
        """Generate fallback content when all other methods fail"""
        try:
            logger.info("🛟 Generating fallback content plan")
            
            # Extract any available content
            uploaded_content = ""
            if uploaded_files:
                uploaded_content = self._extract_content_from_files(uploaded_files)
            
            # Create structured content based on available information
            title = description.split('.')[0] if description else "Presentation"
            
            if uploaded_content:
                content_plan = f"""# {title}

## Overview
This presentation is based on your uploaded content and covers: {description}

## Key Content Areas

### 1. Introduction
{uploaded_content[:200]}{'...' if len(uploaded_content) > 200 else ''}

### 2. Main Topics
- Key insights from your material
- Supporting details and context
- Examples and applications

### 3. Analysis & Discussion
- Important findings
- Implications and impact
- Future considerations

### 4. Conclusion
- Summary of key points
- Recommendations
- Next steps

## Supporting Material
Based on {len(uploaded_content)} characters of uploaded content."""

            else:
                # Minimal input fallback
                content_plan = f"""# {title}

## Presentation Structure

### 1. Introduction to {description}
- Definition and overview
- Why this topic matters
- Context and background

### 2. Key Concepts
- Fundamental principles
- Core components
- Important terminology

### 3. Applications & Examples
- Real-world uses
- Case studies
- Best practices

### 4. Benefits & Impact
- Advantages and opportunities
- Potential challenges
- Success factors

### 5. Conclusion
- Key takeaways
- Summary points
- Future outlook

*This content plan provides a comprehensive structure for exploring {description}. Consider adding specific examples, data, or research to enhance the presentation.*"""

            return {
                "content_plan": content_plan,
                "slide_count": 5,
                "suggestions": [
                    "Add specific examples and data",
                    "Include relevant visuals",
                    "Enhance with research findings",
                    "Customize for your audience"
                ],
                "ai_generated": False,
                "generation_mode": "fallback",
                "metadata": {
                    "has_uploaded_content": bool(uploaded_content),
                    "content_length": len(uploaded_content),
                    "fallback_reason": "Primary generation methods unavailable"
                }
            }

        except Exception as e:
            logger.error(f"Fallback content generation failed: {e}")
            return {
                "content_plan": f"# Presentation: {description}\n\nContent plan could not be generated. Please provide more details or try again.",
                "slide_count": 1,
                "suggestions": ["Provide more detailed input"],
                "ai_generated": False,
                "generation_mode": "minimal_fallback"
            }

    # Additional utility methods
    async def generate_completion(self, system_prompt: str, user_prompt: str, **kwargs) -> str:
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