#!/usr/bin/env python3
"""
Test script for LLM slide generation using existing HTML files from client folders
"""

import asyncio
import logging
import json
from pathlib import Path
from typing import List, Dict, Any
from datetime import datetime
from src.services.slide_service import SlideService
from src.models.message_models import FileInfo

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

async def find_html_files_in_client_folders(input_directory: str = "uploads") -> List[Dict[str, Any]]:
    """Find all HTML files in client folders"""
    input_dir = Path(input_directory)
    html_files = []
    
    if not input_dir.exists():
        logger.warning(f"Input directory '{input_directory}' not found")
        return html_files
    
    # Search for HTML files in client folders
    for client_folder in input_dir.iterdir():
        if client_folder.is_dir() and client_folder.name.startswith("client_"):
            client_id = client_folder.name
            
            # Find HTML files in this client folder
            for html_file in client_folder.glob("*.html"):
                try:
                    # Read HTML content
                    with open(html_file, 'r', encoding='utf-8') as f:
                        html_content = f.read()
                    
                    # Get file info
                    file_info = FileInfo(
                        filename=html_file.name,
                        file_path=str(html_file),
                        file_type="text/html",
                        file_size=html_file.stat().st_size,
                        upload_time=datetime.now().isoformat()
                    )
                    
                    html_files.append({
                        "client_id": client_id,
                        "file_info": file_info,
                        "html_content": html_content,
                        "file_path": str(html_file)
                    })
                    
                    logger.info(f"Found HTML file: {html_file} (size: {html_file.stat().st_size} bytes)")
                    
                except Exception as e:
                    logger.error(f"Error reading HTML file {html_file}: {e}")
    
    logger.info(f"Found {len(html_files)} HTML files in client folders from '{input_directory}'")
    return html_files

async def test_llm_generation_with_html_files(input_directory: str = "uploads"):
    """Test LLM slide generation using existing HTML files"""
    logger.info(f"Starting LLM generation test with existing HTML files from '{input_directory}'...")
    
    # Find HTML files
    html_files = await find_html_files_in_client_folders(input_directory)
    
    if not html_files:
        logger.warning("No HTML files found in client folders")
        return
    
    # Initialize slide service
    slide_service = SlideService()
    
    # Test each HTML file
    results = {}
    
    for html_file_data in html_files:
        client_id = html_file_data["client_id"]
        file_info = html_file_data["file_info"]
        html_content = html_file_data["html_content"]
        
        logger.info(f"\n{'='*50}")
        logger.info(f"Testing with HTML file: {file_info.filename}")
        logger.info(f"Client: {client_id}")
        logger.info(f"File size: {file_info.file_size} bytes")
        logger.info(f"{'='*50}")
        
        # Create a description based on the HTML content
        description = f"Create a slide based on the content from {file_info.filename}"
        
        # Test with different themes
        themes = ["professional", "creative", "minimal"]
        theme_results = {}
        
        for theme in themes:
            logger.info(f"Testing theme: {theme}")
            
            try:
                # Test slide generation
                result = await slide_service.generate_slide_with_params(
                    files=[file_info],
                    description=description,
                    theme=theme,
                    wants_research=False,
                    client_id=client_id
                )
                
                if "error" in result:
                    logger.error(f"❌ Error with theme {theme}: {result['error']}")
                    theme_results[theme] = {"error": result["error"]}
                else:
                    logger.info(f"✅ Theme {theme} completed successfully")
                    logger.info(f"   Processing time: {result.get('processing_time', 0):.2f}s")
                    logger.info(f"   HTML length: {len(result.get('slide_html', ''))} chars")
                    logger.info(f"   PPT file: {result.get('ppt_file_path', 'N/A')}")
                    
                    theme_results[theme] = result
                    
            except Exception as e:
                logger.error(f"❌ Exception with theme {theme}: {e}")
                theme_results[theme] = {"error": str(e)}
        
        results[file_info.filename] = {
            "client_id": client_id,
            "original_html_size": len(html_content),
            "theme_results": theme_results
        }
    
    # Analyze results
    total_tests = len(html_files) * len(themes)
    successful_tests = 0
    failed_tests = 0
    total_processing_time = 0
    
    for filename, result in results.items():
        for theme, theme_result in result["theme_results"].items():
            if "error" in theme_result:
                failed_tests += 1
            else:
                successful_tests += 1
                total_processing_time += theme_result.get("processing_time", 0)
    
    # Print summary
    logger.info(f"\n{'='*50}")
    logger.info("TEST SUMMARY")
    logger.info(f"{'='*50}")
    logger.info(f"HTML files tested: {len(html_files)}")
    logger.info(f"Total tests: {total_tests}")
    logger.info(f"Successful tests: {successful_tests}")
    logger.info(f"Failed tests: {failed_tests}")
    logger.info(f"Success rate: {(successful_tests/total_tests)*100:.1f}%")
    
    if successful_tests > 0:
        avg_processing_time = total_processing_time / successful_tests
        logger.info(f"Average processing time: {avg_processing_time:.2f} seconds")
    
    # Check LLM availability
    llm_available = slide_service.llm_service.is_available()
    logger.info(f"LLM available: {'Yes' if llm_available else 'No'}")
    
    # Save results
    output_file = "test_results_html_files.json"
    with open(output_file, 'w') as f:
        json.dump(results, f, indent=2, default=str)
    
    logger.info(f"\nDetailed results saved to: {output_file}")
    
    return results

async def compare_html_generation():
    """Compare HTML generation with and without LLM"""
    logger.info("\nComparing HTML generation methods...")
    
    slide_service = SlideService()
    
    # Test content
    test_content = "This is a test document about artificial intelligence and machine learning."
    test_description = "Create a slide about AI and ML"
    test_theme = "professional"
    
    # Test with LLM (if available)
    if slide_service.llm_service.is_available():
        logger.info("Testing HTML generation with LLM...")
        try:
            # Generate layout and content
            layout = await slide_service.llm_service.generate_slide_layout(
                test_content, test_description, test_theme, False
            )
            content = await slide_service.llm_service.generate_slide_content(
                test_content, test_description, layout
            )
            
            # Generate HTML with LLM
            html_with_llm = await slide_service._generate_html_with_llm(
                layout, content, test_theme, False
            )
            
            logger.info(f"✅ LLM HTML generation successful")
            logger.info(f"   HTML length: {len(html_with_llm)} characters")
            
        except Exception as e:
            logger.error(f"❌ LLM HTML generation failed: {e}")
            html_with_llm = None
    else:
        logger.info("LLM not available, skipping LLM HTML generation test")
        html_with_llm = None
    
    # Test fallback HTML generation
    logger.info("Testing fallback HTML generation...")
    try:
        # Create a simple layout for testing
        test_layout = {
            "layout_type": "content_slide",
            "title": "AI and Machine Learning",
            "sections": [
                {
                    "type": "text",
                    "content": "Test content",
                    "position": {"x": 10, "y": 30, "width": 80, "height": 60},
                    "style": {"font_size": "16px", "color": "#333", "alignment": "left"}
                }
            ],
            "background_style": "gradient",
            "color_scheme": "professional"
        }
        
        test_content_data = {
            "section_0": {
                "type": "text",
                "content": "This is test content for AI and machine learning concepts.",
                "style": {"font_size": "16px", "color": "#333"}
            }
        }
        
        html_fallback = await slide_service._generate_html_fallback(
            test_layout, test_content_data, test_theme, False
        )
        
        logger.info(f"✅ Fallback HTML generation successful")
        logger.info(f"   HTML length: {len(html_fallback)} characters")
        
    except Exception as e:
        logger.error(f"❌ Fallback HTML generation failed: {e}")
        html_fallback = None
    
    # Compare results
    if html_with_llm and html_fallback:
        logger.info("\nHTML Generation Comparison:")
        logger.info(f"LLM HTML length: {len(html_with_llm)} characters")
        logger.info(f"Fallback HTML length: {len(html_fallback)} characters")
        logger.info(f"Difference: {abs(len(html_with_llm) - len(html_fallback))} characters")
    
    return {
        "llm_html": html_with_llm,
        "fallback_html": html_fallback
    }

async def main():
    """Main test function"""
    import sys
    
    # Get input directory from command line argument or use default
    input_directory = sys.argv[1] if len(sys.argv) > 1 else "uploads"
    
    logger.info(f"Using input directory: {input_directory}")
    
    try:
        # Test with existing HTML files
        results = await test_llm_generation_with_html_files(input_directory)
        
        # Compare HTML generation methods
        html_comparison = await compare_html_generation()
        
        logger.info("\n✅ All tests completed successfully!")
        
    except Exception as e:
        logger.error(f"Test failed: {e}")
        raise

if __name__ == "__main__":
    asyncio.run(main()) 