#!/usr/bin/env python3
"""
Test script for HTML parsing and LLM generation
Reads HTML files from input directory, parses content, and runs LLM
"""

import asyncio
import logging
import json
from pathlib import Path
from typing import List, Dict, Any
from datetime import datetime
from src.services.slide_service import SlideService
from src.services.file_service import FileService
from src.models.message_models import FileInfo

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class HTMLParsingAndLLMTester:
    """Test class for HTML parsing and LLM generation"""
    
    def __init__(self, input_directory: str = "uploads"):
        self.slide_service = SlideService()
        self.file_service = FileService()
        self.input_directory = input_directory
        
    async def find_html_files(self) -> List[Dict[str, Any]]:
        """Find all HTML files in the input directory"""
        input_dir = Path(self.input_directory)
        html_files = []
        
        if not input_dir.exists():
            logger.warning(f"Input directory '{self.input_directory}' not found")
            return html_files
        
        # Search for HTML files recursively
        for html_file in input_dir.rglob("*.html"):
            try:
                # Get file info
                file_info = FileInfo(
                    filename=html_file.name,
                    file_path=str(html_file),
                    file_type="text/html",
                    file_size=html_file.stat().st_size,
                    upload_time=datetime.now().isoformat()
                )
                
                html_files.append({
                    "file_info": file_info,
                    "file_path": str(html_file),
                    "relative_path": html_file.relative_to(input_dir)
                })
                
                logger.info(f"Found HTML file: {html_file} (size: {html_file.stat().st_size} bytes)")
                
            except Exception as e:
                logger.error(f"Error processing HTML file {html_file}: {e}")
        
        logger.info(f"Found {len(html_files)} HTML files in '{self.input_directory}'")
        return html_files
    
    async def parse_html_content(self, html_file_data: Dict[str, Any]) -> Dict[str, Any]:
        """Parse HTML content using file service functions"""
        file_info = html_file_data["file_info"]
        file_path = html_file_data["file_path"]
        
        logger.info(f"Parsing HTML content from: {file_info.filename}")
        
        try:
            # Use the file service to extract content
            content = await self.file_service.extract_content_from_file(file_path)
            
            if content:
                logger.info(f"✅ Successfully parsed HTML content")
                logger.info(f"   Text length: {len(content.get('text', ''))} characters")
                logger.info(f"   Images found: {len(content.get('images', []))}")
                
                # Add parsed content to the file data
                html_file_data["parsed_content"] = content
                return html_file_data
            else:
                logger.error(f"❌ Failed to parse HTML content from {file_info.filename}")
                return html_file_data
                
        except Exception as e:
            logger.error(f"❌ Error parsing HTML content from {file_info.filename}: {e}")
            return html_file_data
    
    async def test_llm_generation_with_parsed_content(self, html_file_data: Dict[str, Any]) -> Dict[str, Any]:
        """Test LLM generation using parsed HTML content"""
        file_info = html_file_data["file_info"]
        parsed_content = html_file_data.get("parsed_content")
        
        if not parsed_content:
            logger.warning(f"Skipping LLM test for {file_info.filename} - no parsed content")
            return {"error": "No parsed content available"}
        
        logger.info(f"Testing LLM generation with parsed content from: {file_info.filename}")
        
        # Create a description based on the HTML content
        text_content = parsed_content.get('text', '')
        if len(text_content) > 200:
            preview = text_content[:200] + "..."
        else:
            preview = text_content
        
        description = f"Create a slide based on the HTML content from {file_info.filename}. Content preview: {preview}"
        
        # Test with single theme (professional)
        theme = "professional"
        logger.info(f"Testing LLM generation with theme: {theme}")
        
        try:
            # Test slide generation with parsed content
            result = await self.slide_service.generate_slide_with_params(
                files=[file_info],
                description=description,
                theme=theme,
                wants_research=False,
                client_id="test_html_parsing"
            )
            
            if "error" in result:
                logger.error(f"❌ Error with theme {theme}: {result['error']}")
                return {
                    "file_info": file_info,
                    "parsed_content": parsed_content,
                    "error": result["error"]
                }
            else:
                logger.info(f"✅ LLM generation completed successfully")
                logger.info(f"   Processing time: {result.get('processing_time', 0):.2f}s")
                logger.info(f"   HTML length: {len(result.get('slide_html', ''))} chars")
                logger.info(f"   PPT file: {result.get('ppt_file_path', 'N/A')}")
                logger.info(f"   HTML file: {result.get('html_file_path', 'N/A')}")
                
                return {
                    "file_info": file_info,
                    "parsed_content": parsed_content,
                    "result": result
                }
                
        except Exception as e:
            logger.error(f"❌ Exception with theme {theme}: {e}")
            return {
                "file_info": file_info,
                "parsed_content": parsed_content,
                "error": str(e)
            }
    
    async def analyze_parsed_content(self, html_file_data: Dict[str, Any]) -> Dict[str, Any]:
        """Analyze the parsed HTML content"""
        parsed_content = html_file_data.get("parsed_content")
        
        if not parsed_content:
            return {"error": "No parsed content to analyze"}
        
        text_content = parsed_content.get('text', '')
        images = parsed_content.get('images', [])
        
        analysis = {
            "text_length": len(text_content),
            "text_preview": text_content[:500] + "..." if len(text_content) > 500 else text_content,
            "image_count": len(images),
            "has_images": len(images) > 0,
            "word_count": len(text_content.split()),
            "line_count": len(text_content.split('\n')),
            "images": images[:3] if images else []  # Show first 3 images
        }
        
        logger.info(f"Content Analysis:")
        logger.info(f"   Text length: {analysis['text_length']} characters")
        logger.info(f"   Word count: {analysis['word_count']} words")
        logger.info(f"   Line count: {analysis['line_count']} lines")
        logger.info(f"   Images: {analysis['image_count']} found")
        
        return analysis
    
    async def run_comprehensive_test(self) -> Dict[str, Any]:
        """Run comprehensive HTML parsing and LLM test"""
        logger.info("Starting comprehensive HTML parsing and LLM test...")
        logger.info(f"Input directory: {self.input_directory}")
        
        # Find HTML files
        html_files = await self.find_html_files()
        
        if not html_files:
            logger.warning("No HTML files found in the input directory.")
            logger.info("Please add HTML files to the input directory and run the test again.")
            return {"error": "No HTML files found in the input directory"}
        
        # Parse each HTML file
        parsed_files = []
        for html_file_data in html_files:
            logger.info(f"\n{'='*60}")
            logger.info(f"Processing: {html_file_data['file_info'].filename}")
            logger.info(f"{'='*60}")
            
            # Parse HTML content
            parsed_file = await self.parse_html_content(html_file_data)
            
            # Analyze parsed content
            analysis = await self.analyze_parsed_content(parsed_file)
            parsed_file["analysis"] = analysis
            
            # Test LLM generation
            llm_result = await self.test_llm_generation_with_parsed_content(parsed_file)
            parsed_file["llm_result"] = llm_result
            
            parsed_files.append(parsed_file)
        
        # Analyze overall results
        overall_analysis = await self._analyze_overall_results(parsed_files)
        
        # Save results
        output_file = "test_results_html_parsing_llm.json"
        with open(output_file, 'w') as f:
            json.dump({
                "input_directory": self.input_directory,
                "files_processed": len(parsed_files),
                "overall_analysis": overall_analysis,
                "detailed_results": parsed_files
            }, f, indent=2, default=str)
        
        logger.info(f"\nDetailed results saved to: {output_file}")
        
        return {
            "input_directory": self.input_directory,
            "files_processed": len(parsed_files),
            "overall_analysis": overall_analysis,
            "detailed_results": parsed_files
        }
    
    async def _analyze_overall_results(self, parsed_files: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Analyze overall test results"""
        total_files = len(parsed_files)
        successful_parses = 0
        successful_llm_tests = 0
        total_processing_time = 0
        total_text_length = 0
        
        for parsed_file in parsed_files:
            if parsed_file.get("parsed_content"):
                successful_parses += 1
                total_text_length += len(parsed_file["parsed_content"].get("text", ""))
            
            llm_result = parsed_file.get("llm_result", {})
            if "error" not in llm_result:
                successful_llm_tests += 1
                # Get processing time from the single result
                result = llm_result.get("result", {})
                if "error" not in result:
                    total_processing_time += result.get("processing_time", 0)
        
        return {
            "total_files": total_files,
            "successful_parses": successful_parses,
            "successful_llm_tests": successful_llm_tests,
            "parse_success_rate": (successful_parses / total_files * 100) if total_files > 0 else 0,
            "llm_success_rate": (successful_llm_tests / total_files * 100) if total_files > 0 else 0,
            "average_processing_time": (total_processing_time / successful_llm_tests) if successful_llm_tests > 0 else 0,
            "total_text_length": total_text_length,
            "llm_available": self.slide_service.llm_service.is_available()
        }
    


async def main():
    """Main test function"""
    import sys
    
    # Get input directory from command line argument or use default
    input_directory = sys.argv[1] if len(sys.argv) > 1 else "uploads"
    
    logger.info(f"Using input directory: {input_directory}")
    
    tester = HTMLParsingAndLLMTester(input_directory)
    
    try:
        results = await tester.run_comprehensive_test()
        
        # Print summary
        if "error" not in results:
            analysis = results["overall_analysis"]
            logger.info(f"\n{'='*60}")
            logger.info("TEST SUMMARY")
            logger.info(f"{'='*60}")
            logger.info(f"Input directory: {results['input_directory']}")
            logger.info(f"Files processed: {results['files_processed']}")
            logger.info(f"Successful parses: {analysis['successful_parses']}/{analysis['total_files']}")
            logger.info(f"Successful LLM tests: {analysis['successful_llm_tests']}/{analysis['total_files']}")
            logger.info(f"Parse success rate: {analysis['parse_success_rate']:.1f}%")
            logger.info(f"LLM success rate: {analysis['llm_success_rate']:.1f}%")
            logger.info(f"Average processing time: {analysis['average_processing_time']:.2f} seconds")
            logger.info(f"Total text processed: {analysis['total_text_length']} characters")
            logger.info(f"LLM available: {'Yes' if analysis['llm_available'] else 'No'}")
        
        logger.info("\n✅ Test completed successfully!")
        
    except Exception as e:
        logger.error(f"Test failed: {e}")
        raise

if __name__ == "__main__":
    asyncio.run(main()) 