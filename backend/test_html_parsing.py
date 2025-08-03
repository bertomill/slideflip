#!/usr/bin/env python3
"""
Test script for HTML parsing functionality
"""

import asyncio
import sys
import os

# Add the src directory to the path
sys.path.append(os.path.join(os.path.dirname(__file__), 'src'))

from services.file_service import FileService

async def test_html_parsing():
    """Test HTML parsing functionality"""
    file_service = FileService()
    
    # Test HTML content
    test_html = """
    <!DOCTYPE html>
    <html>
    <head>
        <title>Test HTML Document</title>
        <style>
            body { font-family: Arial; }
        </style>
    </head>
    <body>
        <h1>Welcome to Our Website</h1>
        <p>This is a <strong>test paragraph</strong> with some content.</p>
        <div>
            <h2>About Us</h2>
            <p>We are a company that provides excellent services.</p>
            <ul>
                <li>Service 1</li>
                <li>Service 2</li>
                <li>Service 3</li>
            </ul>
        </div>
        <script>
            console.log("This should be removed");
        </script>
    </body>
    </html>
    """
    
    # Convert to bytes
    html_bytes = test_html.encode('utf-8')
    
    # Test the HTML parsing
    try:
        extracted_text = await file_service._extract_text_from_html(html_bytes)
        print("=== HTML Parsing Test ===")
        print("Original HTML:")
        print(test_html)
        print("\nExtracted Text:")
        print(extracted_text)
        print("\nTest completed successfully!")
        
        # Check if script and style content was removed
        if "console.log" not in extracted_text and "font-family" not in extracted_text:
            print("✓ Script and style content properly removed")
        else:
            print("✗ Script or style content not properly removed")
            
        # Check if meaningful text was extracted
        if "Welcome to Our Website" in extracted_text and "About Us" in extracted_text:
            print("✓ Meaningful text content properly extracted")
        else:
            print("✗ Meaningful text content not properly extracted")
            
    except Exception as e:
        print(f"Error testing HTML parsing: {e}")

if __name__ == "__main__":
    asyncio.run(test_html_parsing()) 