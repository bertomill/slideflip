#!/usr/bin/env python3
"""
Test script for LLM slide generation with real client data
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

class LLMSlideGenerationTester:
    """Test class for LLM slide generation with real client data"""
    
    def __init__(self, input_directory: str = "uploads"):
        self.slide_service = SlideService()
        self.file_service = FileService()
        self.input_directory = input_directory
        
    async def find_client_folders(self) -> List[str]:
        """Find all client folders in the input directory"""
        input_dir = Path(self.input_directory)
        if not input_dir.exists():
            logger.warning(f"Input directory '{self.input_directory}' not found")
            return []
        
        client_folders = []
        for item in input_dir.iterdir():
            if item.is_dir() and item.name.startswith("client_"):
                client_folders.append(item.name)
        
        logger.info(f"Found {len(client_folders)} client folders in '{self.input_directory}': {client_folders}")
        return client_folders
    
    async def load_client_data(self, client_id: str) -> Dict[str, Any]:
        """Load client data including files and descriptions"""
        client_folder = Path(self.input_directory) / client_id
        
        if not client_folder.exists():
            logger.warning(f"Client folder {client_id} not found in '{self.input_directory}'")
            return {}
        
        # Load client files
        files = []
        for file_path in client_folder.rglob("*"):
            if file_path.is_file() and not file_path.name.startswith("."):
                try:
                    file_info = FileInfo(
                        filename=file_path.name,
                        file_path=str(file_path),
                        file_type=self._get_file_type(file_path),
                        file_size=file_path.stat().st_size,
                        upload_time=datetime.now().isoformat()
                    )
                    files.append(file_info)
                except Exception as e:
                    logger.error(f"Error processing file {file_path}: {e}")
        
        # Load stored content if available
        stored_content = await self.slide_service.get_extracted_content(client_id)
        
        # Load slide description if available
        description = await self.slide_service.get_slide_description(client_id)
        
        # Load HTML files if they exist
        html_files = list(client_folder.glob("*.html"))
        
        return {
            "client_id": client_id,
            "files": files,
            "stored_content": stored_content,
            "description": description,
            "html_files": html_files,
            "folder_path": client_folder
        }
    
    def _get_file_type(self, file_path: Path) -> str:
        """Get MIME type for a file"""
        suffix = file_path.suffix.lower()
        mime_types = {
            ".pdf": "application/pdf",
            ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            ".txt": "text/plain",
            ".md": "text/markdown",
            ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
            ".html": "text/html",
            ".htm": "text/html"
        }
        return mime_types.get(suffix, "application/octet-stream")
    
    async def test_llm_generation_for_client(self, client_id: str) -> Dict[str, Any]:
        """Test LLM slide generation for a specific client"""
        logger.info(f"Testing LLM generation for client: {client_id}")
        
        # Load client data
        client_data = await self.load_client_data(client_id)
        
        if not client_data:
            return {"error": f"No data found for client {client_id}"}
        
        # Check if we have files and description
        files = client_data["files"]
        description = client_data["description"]
        
        if not files:
            return {"error": f"No files found for client {client_id}"}
        
        if not description:
            # Generate a default description based on file names
            file_names = [f.filename for f in files]
            description = f"Create a slide about: {', '.join(file_names)}"
            logger.info(f"Generated default description: {description}")
        
        # Test different themes
        themes = ["professional", "creative", "minimal", "colorful", "default"]
        results = {}
        
        for theme in themes:
            logger.info(f"Testing theme: {theme}")
            
            try:
                # Test with research enabled
                result_with_research = await self.slide_service.generate_slide_with_params(
                    files=files,
                    description=description,
                    theme=theme,
                    wants_research=True,
                    client_id=client_id
                )
                
                # Test without research
                result_without_research = await self.slide_service.generate_slide_with_params(
                    files=files,
                    description=description,
                    theme=theme,
                    wants_research=False,
                    client_id=client_id
                )
                
                results[theme] = {
                    "with_research": result_with_research,
                    "without_research": result_without_research
                }
                
                logger.info(f"✅ Theme {theme} completed successfully")
                
            except Exception as e:
                logger.error(f"❌ Error testing theme {theme}: {e}")
                results[theme] = {"error": str(e)}
        
        return {
            "client_id": client_id,
            "client_data": client_data,
            "results": results
        }
    
    async def analyze_results(self, results: Dict[str, Any]) -> Dict[str, Any]:
        """Analyze the test results"""
        analysis = {
            "total_clients": 0,
            "successful_generations": 0,
            "failed_generations": 0,
            "themes_tested": [],
            "average_processing_time": 0,
            "html_generation_success": 0,
            "ppt_generation_success": 0,
            "llm_availability": 0
        }
        
        total_processing_time = 0
        successful_count = 0
        
        for client_id, client_result in results.items():
            if "error" in client_result:
                analysis["failed_generations"] += 1
                continue
            
            analysis["total_clients"] += 1
            
            for theme, theme_results in client_result["results"].items():
                if theme not in analysis["themes_tested"]:
                    analysis["themes_tested"].append(theme)
                
                for research_mode, result in theme_results.items():
                    if "error" in result:
                        analysis["failed_generations"] += 1
                        continue
                    
                    analysis["successful_generations"] += 1
                    successful_count += 1
                    
                    # Check processing time
                    processing_time = result.get("processing_time", 0)
                    total_processing_time += processing_time
                    
                    # Check HTML generation
                    if result.get("slide_html"):
                        analysis["html_generation_success"] += 1
                    
                    # Check PPT generation
                    if result.get("ppt_file_path"):
                        analysis["ppt_generation_success"] += 1
        
        if successful_count > 0:
            analysis["average_processing_time"] = total_processing_time / successful_count
        
        # Check LLM availability
        if self.slide_service.llm_service.is_available():
            analysis["llm_availability"] = 1
        
        return analysis
    
    async def run_comprehensive_test(self):
        """Run comprehensive test on all client folders"""
        logger.info("Starting comprehensive LLM slide generation test...")
        
        # Find all client folders
        client_folders = await self.find_client_folders()
        
        if not client_folders:
            logger.warning("No client folders found. Creating a test client...")
            await self._create_test_client()
            client_folders = await self.find_client_folders()
        
        # Test each client
        all_results = {}
        for client_id in client_folders:
            logger.info(f"\n{'='*50}")
            logger.info(f"Testing client: {client_id}")
            logger.info(f"{'='*50}")
            
            result = await self.test_llm_generation_for_client(client_id)
            all_results[client_id] = result
        
        # Analyze results
        analysis = await self.analyze_results(all_results)
        
        # Print summary
        logger.info(f"\n{'='*50}")
        logger.info("TEST SUMMARY")
        logger.info(f"{'='*50}")
        logger.info(f"Total clients tested: {analysis['total_clients']}")
        logger.info(f"Successful generations: {analysis['successful_generations']}")
        logger.info(f"Failed generations: {analysis['failed_generations']}")
        logger.info(f"Average processing time: {analysis['average_processing_time']:.2f} seconds")
        logger.info(f"HTML generation success rate: {analysis['html_generation_success']}")
        logger.info(f"PPT generation success rate: {analysis['ppt_generation_success']}")
        logger.info(f"LLM available: {'Yes' if analysis['llm_availability'] else 'No'}")
        logger.info(f"Themes tested: {', '.join(analysis['themes_tested'])}")
        
        # Save detailed results to file
        output_file = "test_results_llm_generation.json"
        with open(output_file, 'w') as f:
            json.dump(all_results, f, indent=2, default=str)
        
        logger.info(f"\nDetailed results saved to: {output_file}")
        
        return all_results, analysis
    
    async def _create_test_client(self):
        """Create a test client with sample data"""
        test_client_id = "client_test_llm"
        test_folder = Path(self.input_directory) / test_client_id
        test_folder.mkdir(parents=True, exist_ok=True)
        
        # Create a sample text file
        sample_file = test_folder / "sample_ai_document.txt"
        sample_content = """
        Artificial Intelligence and Machine Learning
        
        This document discusses the key concepts and applications of AI and ML in modern technology.
        
        Key Topics:
        1. Machine Learning Algorithms
           - Supervised Learning
           - Unsupervised Learning
           - Reinforcement Learning
        
        2. Deep Learning Frameworks
           - TensorFlow
           - PyTorch
           - Keras
        
        3. Natural Language Processing
           - Text Analysis
           - Language Models
           - Sentiment Analysis
        
        4. Computer Vision
           - Image Recognition
           - Object Detection
           - Facial Recognition
        
        Applications:
        - Healthcare: Medical diagnosis and drug discovery
        - Finance: Fraud detection and algorithmic trading
        - Transportation: Autonomous vehicles and traffic optimization
        - Education: Personalized learning and assessment
        """
        
        with open(sample_file, 'w') as f:
            f.write(sample_content)
        
        # Store a sample description
        await self.slide_service.store_slide_description(
            test_client_id, 
            "Create a professional slide about AI and machine learning with key concepts and applications"
        )
        
        # Store sample content
        sample_content_data = {
            "file_name": "sample_ai_document.txt",
            "text": sample_content,
            "images": []
        }
        
        await self.slide_service.store_extracted_content(test_client_id, sample_content_data)
        
        logger.info(f"Created test client: {test_client_id}")

async def main():
    """Main test function"""
    import sys
    
    # Get input directory from command line argument or use default
    input_directory = sys.argv[1] if len(sys.argv) > 1 else "uploads"
    
    logger.info(f"Using input directory: {input_directory}")
    
    tester = LLMSlideGenerationTester(input_directory)
    
    try:
        results, analysis = await tester.run_comprehensive_test()
        
        logger.info("\n✅ Test completed successfully!")
        
        # Print some sample results
        for client_id, result in results.items():
            if "error" not in result:
                logger.info(f"\nClient {client_id} results:")
                for theme, theme_results in result["results"].items():
                    if "error" not in theme_results:
                        with_research = theme_results["with_research"]
                        without_research = theme_results["without_research"]
                        
                        logger.info(f"  Theme {theme}:")
                        logger.info(f"    With research: {with_research.get('processing_time', 0):.2f}s")
                        logger.info(f"    Without research: {without_research.get('processing_time', 0):.2f}s")
        
    except Exception as e:
        logger.error(f"Test failed: {e}")
        raise

if __name__ == "__main__":
    asyncio.run(main()) 