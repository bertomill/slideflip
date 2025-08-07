#!/usr/bin/env python3
"""
Test script for the new slide generation flow with LLM integration
"""

import asyncio
import logging
from pathlib import Path
from datetime import datetime
from src.services.slide_service import SlideService
from src.models.message_models import FileInfo

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

async def test_new_slide_generation():
    """Test the new slide generation flow"""
    try:
        # Initialize slide service
        slide_service = SlideService()
        
        # Create test file info
        test_files = [
            FileInfo(
                filename="sample_document.txt",
                file_path="test_files/sample_document.txt",
                file_type="text/plain",
                file_size=1024,
                upload_time=datetime.now().isoformat()
            )
        ]
        
        # Test description
        description = "Create a professional slide about artificial intelligence and machine learning"
        theme = "professional"
        wants_research = False
        client_id = "test_client_123"
        
        logger.info("Testing new slide generation flow...")
        logger.info(f"Description: {description}")
        logger.info(f"Theme: {theme}")
        logger.info(f"Research enabled: {wants_research}")
        
        # Test the complete flow
        result = await slide_service.generate_slide_with_params(
            files=test_files,
            description=description,
            theme=theme,
            wants_research=wants_research,
            client_id=client_id
        )
        
        # Check results
        if "error" in result:
            logger.error(f"Slide generation failed: {result['error']}")
            return
        
        logger.info("Slide generation completed successfully!")
        logger.info(f"Processing time: {result.get('processing_time', 0):.2f} seconds")
        logger.info(f"Files processed: {result.get('files_processed', 0)}")
        logger.info(f"Content extracted: {result.get('content_extracted', 0)}")
        
        # Check HTML generation
        slide_html = result.get("slide_html", "")
        if slide_html:
            logger.info("✅ HTML generation successful")
            logger.info(f"HTML length: {len(slide_html)} characters")
        else:
            logger.warning("❌ HTML generation failed")
        
        # Check PPT generation
        ppt_file_path = result.get("ppt_file_path", "")
        if ppt_file_path:
            logger.info("✅ PPT generation successful")
            logger.info(f"PPT file: {ppt_file_path}")
            
            # Check if file exists
            if Path(ppt_file_path).exists():
                logger.info("✅ PPT file created successfully")
            else:
                logger.warning("❌ PPT file not found")
        else:
            logger.warning("❌ PPT generation failed")
        
        # Check HTML file path
        html_file_path = result.get("html_file_path", "")
        if html_file_path:
            logger.info("✅ HTML file path generated")
            logger.info(f"HTML file: {html_file_path}")
        else:
            logger.warning("❌ HTML file path not generated")
        
        logger.info("Test completed successfully!")
        
    except Exception as e:
        logger.error(f"Error in slide generation test: {e}")
        raise

if __name__ == "__main__":
    asyncio.run(test_new_slide_generation()) 