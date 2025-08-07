#!/usr/bin/env python3
"""
Test script for image extraction functionality
"""

import asyncio
import sys
import os

# Add the src directory to the path
sys.path.append(os.path.join(os.path.dirname(__file__), 'src'))

from services.file_service import FileService

async def test_image_extraction():
    """Test image extraction functionality"""
    file_service = FileService()
    
    # Test HTML content with images
    test_html = """
    <!DOCTYPE html>
    <html>
    <head>
        <title>Test HTML Document with Images</title>
        <style>
            .hero-bg {
                background-image: url('/images/hero-bg.jpg');
            }
        </style>
    </head>
    <body>
        <h1>Welcome to Our Website</h1>
        
        <div class="hero-bg">
            <h2>Hero Section</h2>
        </div>
        
        <img src="/images/logo.png" alt="Company Logo" width="200" height="100" />
        
        <p>This is a <strong>test paragraph</strong> with some content.</p>
        
        <div>
            <h2>About Us</h2>
            <img src="https://example.com/about-image.jpg" alt="About Us Image" />
            <p>We are a company that provides excellent services.</p>
            
            <img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==" alt="Base64 Image" />
        </div>
        
        <script>
            console.log("This should be ignored");
        </script>
    </body>
    </html>
    """
    
    # Convert to bytes
    html_bytes = test_html.encode('utf-8')
    
    # Test the image extraction
    try:
        print("=== Image Extraction Test ===")
        print("Original HTML:")
        print(test_html)
        
        # Test image extraction
        images = await file_service._extract_images_from_html(html_bytes, "https://example.com")
        
        print(f"\nExtracted {len(images)} images:")
        for i, img in enumerate(images, 1):
            print(f"\nImage {i}:")
            print(f"  Source: {img['src']}")
            print(f"  Alt: {img['alt']}")
            print(f"  Title: {img['title']}")
            print(f"  Width: {img['width']}")
            print(f"  Height: {img['height']}")
            if 'type' in img:
                print(f"  Type: {img['type']}")
        
        # Test content extraction
        content = await file_service.extract_content_from_file("test.html")
        if content:
            print(f"\nContent extraction result:")
            print(f"  Text length: {len(content['text']) if content['text'] else 0}")
            print(f"  Images found: {len(content['images'])}")
        
        print("\nTest completed successfully!")
        
        # Check if images were properly extracted
        image_sources = [img['src'] for img in images]
        expected_sources = [
            '/images/hero-bg.jpg',  # Background image
            '/images/logo.png',     # Logo image
            'https://example.com/about-image.jpg',  # External image
            'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='  # Base64 image
        ]
        
        for expected in expected_sources:
            if expected in image_sources:
                print(f"✓ Found expected image: {expected}")
            else:
                print(f"✗ Missing expected image: {expected}")
                
    except Exception as e:
        print(f"Error testing image extraction: {e}")

if __name__ == "__main__":
    asyncio.run(test_image_extraction()) 