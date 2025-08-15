"""
Prompt loading utility for managing external prompt templates
"""

import logging
from pathlib import Path
from typing import Dict, Any, Optional
from string import Template

logger = logging.getLogger(__name__)

class PromptLoader:
    """
    Utility class for loading and managing prompt templates from external files
    
    Features:
    - Load prompts from organized directory structure
    - Template variable substitution
    - Error handling and fallbacks
    - File path resolution relative to prompts directory
    """
    
    def __init__(self):
        # Get the directory where this file is located (src/prompts/)
        self.prompts_dir = Path(__file__).parent
    
    def load_prompt(self, prompt_path: str, variables: Optional[Dict[str, Any]] = None) -> str:
        """
        Load a prompt template from file and substitute variables
        
        Args:
            prompt_path: Relative path to prompt file from prompts directory
                        e.g., "slide_generation/layout_system.txt"
            variables: Dictionary of variables to substitute in template
        
        Returns:
            Processed prompt string with variables substituted
            
        Raises:
            FileNotFoundError: If prompt file doesn't exist
            ValueError: If template substitution fails
        """
        try:
            file_path = self.prompts_dir / prompt_path
            
            # Check if file exists
            if not file_path.exists():
                raise FileNotFoundError(f"Prompt file not found: {file_path}")
            
            # Read the prompt template
            with open(file_path, 'r', encoding='utf-8') as f:
                template_content = f.read()
            
            # If no variables provided, return template as-is
            if not variables:
                return template_content
            
            # Substitute template variables
            template = Template(template_content)
            try:
                return template.substitute(variables)
            except KeyError as e:
                # If required variable is missing, provide helpful error
                raise ValueError(f"Missing required variable for template {prompt_path}: {e}")
        
        except Exception as e:
            logger.error(f"Error loading prompt from {prompt_path}: {e}")
            raise
    
    def load_system_user_prompts(
        self, 
        category: str, 
        prompt_name: str, 
        system_variables: Optional[Dict[str, Any]] = None,
        user_variables: Optional[Dict[str, Any]] = None
    ) -> tuple[str, str]:
        """
        Load both system and user prompts for a given category and name
        
        Args:
            category: Category directory (e.g., "slide_layout_prompt")
            prompt_name: Base name for prompts (e.g., "layout")
            system_variables: Variables for system prompt template
            user_variables: Variables for user prompt template
            
        Returns:
            Tuple of (system_prompt, user_prompt)
        """
        system_path = f"{category}/{prompt_name}_system.txt"
        user_path = f"{category}/{prompt_name}_user.txt"
        
        system_prompt = self.load_prompt(system_path, system_variables)
        user_prompt = self.load_prompt(user_path, user_variables)
        
        return system_prompt, user_prompt
    
    def prompt_exists(self, prompt_path: str) -> bool:
        """
        Check if a prompt file exists
        
        Args:
            prompt_path: Relative path to prompt file
            
        Returns:
            True if file exists, False otherwise
        """
        file_path = self.prompts_dir / prompt_path
        return file_path.exists()
    
    def list_prompts(self, category: Optional[str] = None) -> list[str]:
        """
        List available prompt files
        
        Args:
            category: Optional category to filter by
            
        Returns:
            List of relative prompt file paths
        """
        if category:
            search_dir = self.prompts_dir / category
            if not search_dir.exists():
                return []
            files = search_dir.glob("*.txt")
            return [f"{category}/{f.name}" for f in files]
        else:
            # Find all .txt files recursively
            files = self.prompts_dir.glob("**/*.txt")
            return [str(f.relative_to(self.prompts_dir)) for f in files]