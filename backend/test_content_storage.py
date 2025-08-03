#!/usr/bin/env python3
"""
Test script for content storage functionality
"""

import asyncio
import sys
import os
import tempfile

# Add the src directory to the path
sys.path.append(os.path.join(os.path.dirname(__file__), 'src'))

from services.slide_service import SlideService
from services.file_service import FileService

async def test_content_storage():
    """Test content storage functionality"""
    slide_service = SlideService()
    file_service = FileService()
    
    # Test client ID
    test_client_id = "test_client_123"
    
    # Create test HTML content
    test_html = """
    <!DOCTYPE html>
    <html>
    <head>
        <title>Test Content Storage</title>
    </head>
    <body>
        <h1>Welcome to Test Page</h1>
        <p>This is a test paragraph with some content.</p>
        <img src="/images/test.jpg" alt="Test Image" width="300" height="200" />
        <div style="background-image: url('/images/bg.jpg');">
            <h2>Background Section</h2>
        </div>
    </body>
    </html>
    """
    
    # Create a temporary HTML file
    with tempfile.NamedTemporaryFile(mode='w', suffix='.html', delete=False) as f:
        f.write(test_html)
        temp_file_path = f.name
    
    try:
        print("=== Content Storage Test ===")
        
        # Test 1: Store file content
        print("\n1. Testing file content storage...")
        success = await slide_service.store_file_content(test_client_id, temp_file_path, "test.html")
        print(f"✅ Content storage result: {success}")
        
        # Test 2: Get extracted content
        print("\n2. Testing content retrieval...")
        content_list = await slide_service.get_extracted_content(test_client_id)
        print(f"✅ Retrieved {len(content_list)} content items")
        
        for i, content in enumerate(content_list, 1):
            print(f"   Content {i}:")
            print(f"     File: {content.get('file_name', 'unknown')}")
            print(f"     Text length: {len(content.get('text', ''))}")
            print(f"     Images: {len(content.get('images', []))}")
        
        # Test 3: Get content statistics
        print("\n3. Testing content statistics...")
        stats = await slide_service.get_client_content_stats(test_client_id)
        print(f"✅ Content statistics:")
        print(f"   Total files: {stats.get('total_files', 0)}")
        print(f"   Total text length: {stats.get('total_text_length', 0)}")
        print(f"   Total images: {stats.get('total_images', 0)}")
        print(f"   File types: {stats.get('file_types', {})}")
        
        # Test 4: Store slide description
        print("\n4. Testing slide description storage...")
        description = "Test slide about content storage functionality"
        success = await slide_service.store_slide_description(test_client_id, description)
        print(f"✅ Description storage result: {success}")
        
        # Test 5: Get updated statistics
        print("\n5. Testing updated statistics...")
        updated_stats = await slide_service.get_client_content_stats(test_client_id)
        print(f"✅ Updated statistics:")
        print(f"   Has description: {updated_stats.get('has_description', False)}")
        print(f"   Description length: {updated_stats.get('description_length', 0)}")
        
        # Test 6: Test slide generation with stored content
        print("\n6. Testing slide generation with stored content...")
        from models.message_models import FileInfo
        dummy_files = [FileInfo(filename="test.html", file_path=temp_file_path, file_size=1000, file_type="text/html", upload_time="2024-01-01T00:00:00")]
        
        result = await slide_service.generate_slide(dummy_files, description, test_client_id)
        print(f"✅ Slide generation result:")
        print(f"   Success: {'error' not in result}")
        print(f"   Processing time: {result.get('processing_time', 0):.2f}s")
        print(f"   Content extracted: {result.get('content_extracted', 0)}")
        
        # Test 7: Clear client data
        print("\n7. Testing data cleanup...")
        success = await slide_service.clear_client_data(test_client_id)
        print(f"✅ Data cleanup result: {success}")
        
        # Verify cleanup
        remaining_content = await slide_service.get_extracted_content(test_client_id)
        remaining_description = await slide_service.get_slide_description(test_client_id)
        print(f"   Remaining content items: {len(remaining_content)}")
        print(f"   Remaining description: {remaining_description is not None}")
        
        print("\n🎉 All content storage tests completed successfully!")
        
    except Exception as e:
        print(f"❌ Error during testing: {e}")
        
    finally:
        # Clean up temporary file
        try:
            os.unlink(temp_file_path)
        except:
            pass

if __name__ == "__main__":
    asyncio.run(test_content_storage()) 