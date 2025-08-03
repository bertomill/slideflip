#!/usr/bin/env python3
"""
Test script for slide generation functionality
"""

import asyncio
import sys
import os
from pathlib import Path

# Add the src directory to the Python path
sys.path.append(str(Path(__file__).parent / "src"))

from src.services.slide_service import SlideService
from src.services.file_service import FileService
from src.models.message_models import FileInfo

async def test_slide_generation():
    """Test the slide generation functionality"""
    print("Testing slide generation functionality...")
    
    # Initialize services
    slide_service = SlideService()
    file_service = FileService()
    
    # Create mock file data
    mock_files = [
        FileInfo(
            filename="test_document.pdf",
            file_path="test_files/test_document.pdf",
            file_size=1024,
            file_type="application/pdf",
            upload_time="2024-01-01T00:00:00Z"
        )
    ]
    
    # Test description
    description = "Create a professional slide about quarterly sales results with charts and key insights"
    
    print(f"Testing with description: {description}")
    print(f"Number of files: {len(mock_files)}")
    
    try:
        # Test slide generation with client ID
        test_client_id = "test_client_123"
        result = await slide_service.generate_slide_with_params(
            files=mock_files,
            description=description,
            theme="professional",
            wants_research=True,
            client_id=test_client_id
        )
        
        print("\n=== Generation Result ===")
        print(f"Success: {'error' not in result}")
        
        if 'error' in result:
            print(f"Error: {result['error']}")
        else:
            print(f"Processing time: {result.get('processing_time', 0):.2f} seconds")
            print(f"Files processed: {result.get('files_processed', 0)}")
            print(f"Content extracted: {result.get('content_extracted', 0)}")
            print(f"Theme: {result.get('theme', 'unknown')}")
            print(f"Research enabled: {result.get('wants_research', False)}")
            
            # Check for HTML content
            slide_html = result.get('slide_html', '')
            if slide_html:
                print(f"HTML generated: {len(slide_html)} characters")
                print("HTML preview (first 200 chars):")
                print(slide_html[:200] + "..." if len(slide_html) > 200 else slide_html)
            else:
                print("No HTML content generated")
            
            # Check for HTML file path
            html_file_path = result.get('html_file_path', '')
            if html_file_path:
                print(f"HTML file saved: {html_file_path}")
                if os.path.exists(html_file_path):
                    file_size = os.path.getsize(html_file_path)
                    print(f"HTML file size: {file_size} bytes")
                else:
                    print("HTML file not found on disk")
            else:
                print("No HTML file path returned")
            
            # Check for PPT file
            ppt_file_path = result.get('ppt_file_path', '')
            if ppt_file_path:
                print(f"PPT file generated: {ppt_file_path}")
                if os.path.exists(ppt_file_path):
                    file_size = os.path.getsize(ppt_file_path)
                    print(f"PPT file size: {file_size} bytes")
                else:
                    print("PPT file not found on disk")
            else:
                print("No PPT file path returned")
        
        print("\n=== Test Complete ===")
        
    except Exception as e:
        print(f"Error during testing: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    # Create test directory if it doesn't exist
    os.makedirs("test_files", exist_ok=True)
    os.makedirs("output", exist_ok=True)
    
    # Create a mock test file
    test_file_path = "test_files/test_document.pdf"
    if not os.path.exists(test_file_path):
        with open(test_file_path, 'w') as f:
            f.write("Mock PDF content for testing")
    
    # Run the test
    asyncio.run(test_slide_generation()) 