"""
AI Service for OpenAI integration and AI-powered operations
"""

import logging
import asyncio
import openai
from src.core.config import Settings

logger = logging.getLogger(__name__)

class AIService:
    """Service for AI-powered operations using OpenAI GPT"""
    
    def __init__(self):
        self.settings = Settings()
        self.openai_client = None
        self._initialize_openai()
    
    def _initialize_openai(self):
        """Initialize OpenAI client if API key is available"""
        try:
            if self.settings.OPENAI_API_KEY:
                self.openai_client = openai.OpenAI(
                    api_key=self.settings.OPENAI_API_KEY)
                logger.info("OpenAI client initialized successfully")
            else:
                logger.warning("OpenAI API key not configured")
        except Exception as e:
            logger.error(f"Failed to initialize OpenAI client: {e}")
    
    def is_available(self) -> bool:
        """Check if OpenAI service is available"""
        return self.openai_client is not None and self.settings.OPENAI_API_KEY is not None
