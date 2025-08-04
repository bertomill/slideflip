#!/usr/bin/env python3
"""
Test script for LLM integration
"""

import asyncio
import logging
from src.services.llm_service import LLMService
from src.services.ppt_service import PPTService
from src.core.config import Settings

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

async def test_llm_integration():
    """Test the LLM integration"""
    try:
        # Initialize services
        llm_service = LLMService()
        ppt_service = PPTService()
        
        # Test content
        test_content = """
        This is a sample document about artificial intelligence and machine learning.
        The document discusses various applications of AI in modern technology.
        Key topics include:
        - Machine learning algorithms
        - Deep learning frameworks
        - Natural language processing
        - Computer vision applications
        """
        
        test_description = "Create a professional slide about AI and machine learning"
        test_theme = "professional"
        
        logger.info("Testing LLM service availability...")
        if not llm_service.is_available():
            logger.warning("LLM service not available (no API key)")
            logger.info("Testing with fallback mode...")
        
        # Test layout generation
        logger.info("Testing layout generation...")
        layout = await llm_service.generate_slide_layout(
            test_content, 
            test_description, 
            test_theme, 
            has_images=False
        )
        
        logger.info(f"Generated layout: {layout.get('layout_type', 'unknown')}")
        logger.info(f"Layout sections: {len(layout.get('sections', []))}")
        
        # Test content generation
        logger.info("Testing content generation...")
        content = await llm_service.generate_slide_content(
            test_content, 
            test_description, 
            layout
        )
        
        logger.info(f"Generated content sections: {len(content)}")
        
        # Test PPT generation
        logger.info("Testing PPT generation...")
        output_path = "test_output/sample_slide.pptx"
        
        ppt_path = await ppt_service.generate_ppt_from_layout(
            layout, 
            content, 
            output_path, 
            test_theme
        )
        
        logger.info(f"PPT file generated: {ppt_path}")
        logger.info("LLM integration test completed successfully!")
        
    except Exception as e:
        logger.error(f"Error in LLM integration test: {e}")
        raise

if __name__ == "__main__":
    asyncio.run(test_llm_integration()) 