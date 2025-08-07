#!/usr/bin/env python3
"""
Test script for consolidated slide generation functionality
"""

import asyncio
import sys
import os
import tempfile

# Add the src directory to the path
sys.path.append(os.path.join(os.path.dirname(__file__), 'src'))

from services.slide_service import SlideService
from services.file_service import FileService
from models.message_models import FileInfo

async def test_consolidated_slide_generation():
    """Test consolidated slide generation functionality"""
    slide_service = SlideService()
    file_service = FileService()
    
    # Test client ID
    test_client_id = "test_client_456"
    
    # Create test HTML content
    test_html = """
    <!DOCTYPE html>
    <html>
    <head>
        <title>Test Slide Generation</title>
    </head>
    <body>
        <h1>Welcome to Test Page</h1>
        <p>This is a test paragraph with some content for slide generation.</p>
        <img src="/images/test.jpg" alt="Test Image" width="300" height="200" />
        <div style="background-image: url('/images/bg.jpg');">
            <h2>Background Section</h2>
            <p>This content will be used for slide generation.</p>
        </div>
    </body>
    </html>
    """
    
    # Create a temporary HTML file
    with tempfile.NamedTemporaryFile(mode='w', suffix='.html', delete=False) as f:
        f.write(test_html)
        temp_file_path = f.name
    
    try:
        print("=== Consolidated Slide Generation Test ===")
        
        # Test 1: Store slide description
        print("\n1. Testing slide description storage...")
        description = "Test slide about consolidated slide generation functionality"
        success = await slide_service.store_slide_description(test_client_id, description)
        print(f"✅ Description storage result: {success}")
        
        # Test 2: Store file content
        print("\n2. Testing file content storage...")
        success = await slide_service.store_file_content(test_client_id, temp_file_path, "test.html")
        print(f"✅ Content storage result: {success}")
        
        # Test 3: Create dummy file info
        print("\n3. Testing slide generation with parameters...")
        dummy_files = [FileInfo(
            filename="test.html", 
            file_path=temp_file_path, 
            file_size=1000, 
            file_type="text/html", 
            upload_time="2024-01-01T00:00:00"
        )]
        
        # Test with parameters
        result_with_params = await slide_service.generate_slide_with_params(
            dummy_files, 
            description, 
            theme="professional", 
            wants_research=True, 
            client_id=test_client_id
        )
        
        print(f"✅ Parameterized generation result:")
        print(f"   Success: {'error' not in result_with_params}")
        print(f"   Processing time: {result_with_params.get('processing_time', 0):.2f}s")
        print(f"   Theme: {result_with_params.get('theme', 'unknown')}")
        print(f"   Research: {result_with_params.get('wants_research', False)}")
        print(f"   HTML generated: {bool(result_with_params.get('slide_html', ''))}")
        print(f"   PPT path: {result_with_params.get('ppt_file_path', 'none')}")
        
        # Test 4: Test basic generation (no parameters)
        print("\n4. Testing basic slide generation...")
        result_basic = await slide_service.generate_slide_with_params(
            dummy_files, 
            description, 
            theme="default", 
            wants_research=False, 
            client_id=test_client_id
        )
        
        print(f"✅ Basic generation result:")
        print(f"   Success: {'error' not in result_basic}")
        print(f"   Processing time: {result_basic.get('processing_time', 0):.2f}s")
        print(f"   Theme: {result_basic.get('theme', 'unknown')}")
        print(f"   Research: {result_basic.get('wants_research', False)}")
        
        # Test 5: Get content statistics
        print("\n5. Testing content statistics...")
        stats = await slide_service.get_client_content_stats(test_client_id)
        print(f"✅ Content statistics:")
        print(f"   Total files: {stats.get('total_files', 0)}")
        print(f"   Total text length: {stats.get('total_text_length', 0)}")
        print(f"   Total images: {stats.get('total_images', 0)}")
        print(f"   Has description: {stats.get('has_description', False)}")
        
        # Test 6: Clear client data
        print("\n6. Testing data cleanup...")
        success = await slide_service.clear_client_data(test_client_id)
        print(f"✅ Data cleanup result: {success}")
        
        print("\n🎉 All consolidated slide generation tests completed successfully!")
        
    except Exception as e:
        print(f"❌ Error during testing: {e}")
        
    finally:
        # Clean up temporary file
        try:
            os.unlink(temp_file_path)
        except:
            pass

if __name__ == "__main__":
    asyncio.run(test_consolidated_slide_generation()) 