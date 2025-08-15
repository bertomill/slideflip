"""
Simplified Prompt Manager

Lightweight prompt management system with built-in templates
and minimal dependencies for core functionality.
"""

import logging
from typing import Dict, Any, Optional, List
from src.core.config import Settings

logger = logging.getLogger(__name__)

# Global instance
_prompt_manager_instance = None


class SimplePromptManager:
    """
    Simplified prompt manager with built-in templates
    """

    def __init__(self):
        global _prompt_manager_instance

        if _prompt_manager_instance is not None:
            # Return existing instance to prevent multiple initializations
            return _prompt_manager_instance

        self.settings = Settings()
        self.templates = self._load_built_in_templates()

        # Only log once during first initialization
        if _prompt_manager_instance is None:
            logger.info(
                "SimplePromptManager initialized with built-in templates")

        # Set global instance
        _prompt_manager_instance = self

    def _load_built_in_templates(self) -> Dict[str, Any]:
        """Load built-in prompt templates"""
        return {
            "content_planning": {
                "system_prompt": """You are an expert content strategist and presentation planner. 
Your task is to analyze uploaded content and user requirements to create a strategic content plan.

CRITICAL PRINCIPLES:
- Content comes ONLY from uploaded files and user description
- Theme information is for styling suggestions only, NOT content generation
- Focus on extracting key insights, facts, and narratives from source material
- Create logical content flow that tells a compelling story
- Ensure all content recommendations are grounded in the uploaded material

Return a properly structured JSON response with content plan details.""",

                "user_prompt": """CONTENT ANALYSIS TASK:
Create a comprehensive content plan based on the following inputs:

USER DESCRIPTION: {description}

UPLOADED FILES CONTENT:
{uploaded_files_content}

{research_section}

CONTENT PLANNING REQUIREMENTS:
1. Analyze the uploaded content to identify key themes, facts, and insights
2. Create a logical content structure that flows naturally
3. Extract specific data points, examples, and quotes from the source material
4. Organize content into clear, focused sections
5. Ensure all content recommendations are directly supported by uploaded files
6. Create a compelling narrative that guides the audience through the information

Return a JSON object with this exact structure:
{{
  "title": "Clear, descriptive title based on uploaded content",
  "content_plan": "Detailed content plan in markdown format with clear sections based on uploaded content",
  "slide_count": 5,
  "key_messages": ["Primary takeaway from uploaded material", "Secondary insight from source content"],
  "suggestions": ["Add visual elements", "Include data charts", "Enhance with examples"],
  "ai_generated": true,
  "generation_mode": "content_planning"
}}

CRITICAL: 
- All content must be directly derived from uploaded files
- Respond only with valid JSON
- No additional text or markdown formatting around the JSON""",

                "model_config": {
                    "model": "gpt-3.5-turbo",
                    "temperature": 0.7,
                    "max_tokens": 2000
                }
            },

            "ai_enhanced_content_generation": {
                "system_prompt": """You are an expert content creator specializing in generating comprehensive presentation content from minimal input.

Your task is to create detailed, engaging presentation content that expands on brief topics or descriptions.

Style: {content_style}
Goal: Create detailed, structured presentation content that expands on the given topic.

Always provide:
1. A compelling title
2. Clear section structure
3. Detailed content for each section
4. Key takeaways and insights
5. Engaging examples and explanations

Be creative and expansive - turn brief topics into rich, informative content.

IMPORTANT: Always return a valid JSON response with the specified structure.""",

                "user_prompt": """Create a comprehensive presentation about: {user_description}

{uploaded_content_section}

{research_section}

Please generate a detailed presentation content plan that includes:

1. **Title**: Create an engaging presentation title
2. **Introduction**: Hook the audience and set context
3. **Main Content**: 3-5 detailed sections with:
   - Clear headings
   - Rich content and explanations
   - Relevant examples or case studies
   - Key insights and takeaways
4. **Conclusion**: Summary and call-to-action

Make the content engaging, informative, and suitable for a professional presentation. Expand on the topic with relevant details, examples, and insights even if the input is minimal.

Return as a JSON object with this exact structure:
{{
  "content_plan": "Detailed content plan in markdown format with clear sections and rich content",
  "slide_count": 5,
  "suggestions": ["AI-enhanced content with expanded details", "Rich context and examples included", "Professional structure and flow"],
  "ai_generated": true,
  "generation_mode": "ai_enhanced"
}}

CRITICAL: Respond only with valid JSON. No additional text or markdown formatting around the JSON.""",

                "model_config": {
                    "model": "gpt-3.5-turbo",
                    "temperature": 0.7,
                    "max_tokens": 1500
                }
            },

            "slide_layout_generation": {
                "system_prompt": """You are a senior slide designer with expertise in creating visually appealing and effective presentation layouts.
Your task is to generate slide layout configurations based on content analysis and theme requirements.""",

                "user_prompt": """Create a slide layout for the following content:

CONTENT: {content}
THEME: {theme}
DESCRIPTION: {description}

Generate a layout configuration that optimizes visual hierarchy and readability.""",

                "model_config": {
                    "model": "gpt-3.5-turbo",
                    "temperature": 0.5,
                    "max_tokens": 800
                }
            }
        }

    async def render_prompt(self, template_name: str, variables: Dict[str, Any]) -> Dict[str, Any]:
        """Render a prompt template with the given variables"""
        try:
            if template_name not in self.templates:
                logger.error(f"Template '{template_name}' not found")
                # Return a fallback template
                return {
                    "system_prompt": "You are a helpful assistant.",
                    "user_prompt": str(variables.get('description', 'Generate content based on the provided information.')),
                    "model_config": {"model": "gpt-3.5-turbo", "temperature": 0.7, "max_tokens": 1000}
                }

            template = self.templates[template_name]

            # Handle content planning template
            if template_name == "content_planning":
                return self._render_content_planning_template(template, variables)
            elif template_name == "ai_enhanced_content_generation":
                return self._render_ai_enhanced_template(template, variables)
            else:
                return self._render_basic_template(template, variables)

        except Exception as e:
            logger.error(f"Error rendering template '{template_name}': {e}")
            # Return a safe fallback
            return {
                "system_prompt": "You are a helpful assistant that creates presentation content.",
                "user_prompt": f"Create content for: {variables.get('description', 'presentation topic')}",
                "model_config": {"model": "gpt-3.5-turbo", "temperature": 0.7, "max_tokens": 1000}
            }

    def _render_content_planning_template(self, template: Dict, variables: Dict[str, Any]) -> Dict[str, Any]:
        """Render the content planning template"""
        try:
            # Format uploaded files content
            uploaded_files_content = "No uploaded files provided"
            if variables.get('uploaded_files'):
                content_parts = []
                for file_info in variables['uploaded_files']:
                    if isinstance(file_info, dict):
                        filename = file_info.get('filename', 'Unknown file')
                        content = file_info.get('content') or file_info.get(
                            'full_text', 'No content available')
                        content_parts.append(f"--- {filename} ---\n{content}")
                if content_parts:
                    uploaded_files_content = '\n\n'.join(content_parts)

            # Format research section
            research_section = ""
            if variables.get('research_data'):
                research_section = f"ADDITIONAL RESEARCH DATA:\n{variables['research_data']}"

            user_prompt = template["user_prompt"].format(
                description=variables.get(
                    'description', 'Generate slide content'),
                uploaded_files_content=uploaded_files_content,
                research_section=research_section
            )

            return {
                "system_prompt": template["system_prompt"],
                "user_prompt": user_prompt,
                "model_config": template["model_config"]
            }

        except Exception as e:
            logger.error(f"Error rendering content planning template: {e}")
            raise

    def _render_ai_enhanced_template(self, template: Dict, variables: Dict[str, Any]) -> Dict[str, Any]:
        """Render the AI enhanced content generation template"""
        try:
            content_style = variables.get('content_style', 'professional')
            user_description = variables.get(
                'user_description', variables.get('description', 'presentation topic'))

            # Format uploaded content section
            uploaded_content_section = ""
            if variables.get('uploaded_content'):
                uploaded_content_section = f"Based on this uploaded content:\n{variables['uploaded_content']}"

            # Format research section
            research_section = ""
            if variables.get('research_data'):
                research_section = f"Incorporating this research:\n{variables['research_data'][:500]}..."

            system_prompt = template["system_prompt"].format(
                content_style=content_style)
            user_prompt = template["user_prompt"].format(
                user_description=user_description,
                uploaded_content_section=uploaded_content_section,
                research_section=research_section
            )

            return {
                "system_prompt": system_prompt,
                "user_prompt": user_prompt,
                "model_config": template["model_config"]
            }

        except Exception as e:
            logger.error(f"Error rendering AI enhanced template: {e}")
            raise

    def _render_basic_template(self, template: Dict, variables: Dict[str, Any]) -> Dict[str, Any]:
        """Render a basic template with simple variable substitution"""
        try:
            system_prompt = template["system_prompt"]
            user_prompt = template["user_prompt"]

            # Simple variable substitution
            for key, value in variables.items():
                placeholder = f"{{{key}}}"
                system_prompt = system_prompt.replace(placeholder, str(value))
                user_prompt = user_prompt.replace(placeholder, str(value))

            return {
                "system_prompt": system_prompt,
                "user_prompt": user_prompt,
                "model_config": template["model_config"]
            }

        except Exception as e:
            logger.error(f"Error rendering basic template: {e}")
            raise


def get_prompt_manager() -> SimplePromptManager:
    """Get the global prompt manager instance (singleton)"""
    global _prompt_manager_instance
    if _prompt_manager_instance is None:
        _prompt_manager_instance = SimplePromptManager()
    return _prompt_manager_instance
