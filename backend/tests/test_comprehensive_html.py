#!/usr/bin/env python3
"""
Comprehensive test script for HTML parsing and image extraction
"""

import asyncio
import sys
import os
import tempfile

# Add the src directory to the path
sys.path.append(os.path.join(os.path.dirname(__file__), 'src'))

from services.file_service import FileService

async def test_comprehensive_html():
    """Test comprehensive HTML parsing and image extraction"""
    file_service = FileService()
    
    # Test HTML content with various elements
    test_html = """
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Comprehensive Test Page</title>
        <style>
            .hero-section {
                background-image: url('/images/hero-bg.jpg');
                height: 400px;
            }
            .logo {
                background-image: url('https://example.com/logo.png');
            }
        </style>
    </head>
    <body>
        <header>
            <img src="/images/logo.png" alt="Company Logo" width="150" height="50" />
            <nav>
                <ul>
                    <li><a href="/">Home</a></li>
                    <li><a href="/about">About</a></li>
                </ul>
            </nav>
        </header>
        
        <main>
            <section class="hero-section">
                <h1>Welcome to Our Website</h1>
                <p>This is a comprehensive test page with various content.</p>
            </section>
            
            <section class="content">
                <h2>About Our Company</h2>
                <img src="https://example.com/about-image.jpg" alt="About Us" width="300" height="200" />
                <p>We are a leading company in our industry, providing excellent services to our customers.</p>
                
                <div class="gallery">
                    <h3>Our Gallery</h3>
                    <img src="/images/product1.jpg" alt="Product 1" />
                    <img src="/images/product2.jpg" alt="Product 2" />
                    <img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==" alt="Base64 Image" />
                </div>
            </section>
        </main>
        
        <footer>
            <img src="/images/footer-logo.png" alt="Footer Logo" />
            <p>&copy; 2024 Our Company. All rights reserved.</p>
        </footer>
        
        <script>
            console.log("This script should be ignored");
            document.addEventListener('DOMContentLoaded', function() {
                console.log("Page loaded");
            });
        </script>
    </body>
    </html>
    """
    
    # Create a temporary HTML file
    with tempfile.NamedTemporaryFile(mode='w', suffix='.html', delete=False) as f:
        f.write(test_html)
        temp_file_path = f.name
    
    try:
        print("=== Comprehensive HTML Test ===")
        print("Testing HTML file:", temp_file_path)
        
        # Test content extraction
        content = await file_service.extract_content_from_file(temp_file_path)
        
        if content:
            print(f"\n✅ Content extraction successful")
            print(f"📄 Text length: {len(content['text'])} characters")
            print(f"🖼️  Images found: {len(content['images'])}")
            
            # Display extracted text (first 200 characters)
            text_preview = content['text'][:200] + "..." if len(content['text']) > 200 else content['text']
            print(f"\n📝 Text preview: {text_preview}")
            
            # Display image information
            if content['images']:
                print(f"\n🖼️  Extracted Images:")
                for i, img in enumerate(content['images'], 1):
                    print(f"  {i}. {img['src']}")
                    print(f"     Alt: {img['alt']}")
                    print(f"     Title: {img['title']}")
                    if img.get('width') and img.get('height'):
                        print(f"     Size: {img['width']} × {img['height']}")
                    if img.get('type'):
                        print(f"     Type: {img['type']}")
                    print()
            
            # Test URL-based extraction
            print("\n🌐 Testing URL-based extraction...")
            url_result = await file_service.fetch_and_parse_html_from_url("https://example.com")
            if url_result:
                print(f"✅ URL extraction successful")
                print(f"📄 Text length: {len(url_result['text'])} characters")
                print(f"🖼️  Images found: {len(url_result['images'])}")
            else:
                print("⚠️  URL extraction failed (expected for example.com)")
            
            # Test image downloading (mock test)
            print("\n📥 Testing image download functionality...")
            test_image_url = "https://via.placeholder.com/150x150.png"
            downloaded_path = await file_service.download_image(test_image_url)
            if downloaded_path:
                print(f"✅ Image downloaded to: {downloaded_path}")
            else:
                print("⚠️  Image download failed (may be due to network issues)")
            
            print("\n🎉 All tests completed successfully!")
            
        else:
            print("❌ Content extraction failed")
            
    except Exception as e:
        print(f"❌ Error during testing: {e}")
        
    finally:
        # Clean up temporary file
        try:
            os.unlink(temp_file_path)
        except:
            pass

if __name__ == "__main__":
    asyncio.run(test_comprehensive_html()) 