# HTML File Support and Image Extraction

This document describes the HTML file support and image extraction features added to the SlideFlip backend.

## Features

### 1. HTML File Upload Support
- **File Types**: `.html`, `.htm`
- **MIME Types**: `text/html`, `application/xhtml+xml`
- **Content Extraction**: Text content is extracted from HTML files using BeautifulSoup
- **Script/Style Removal**: JavaScript and CSS content is automatically removed from extracted text

### 2. Image Extraction from HTML
- **Image Tags**: Extracts all `<img>` tags with their attributes
- **Background Images**: Finds background images in CSS styles
- **URL Resolution**: Automatically resolves relative URLs when base URL is provided
- **Image Information**: Captures alt text, title, dimensions, and other attributes

### 3. URL-Based Content Fetching
- **Webpage URLs**: Can fetch and parse content from web URLs
- **Async Download**: Uses aiohttp for efficient async HTTP requests
- **Timeout Handling**: 30-second timeout for URL requests
- **Error Handling**: Graceful handling of network errors and invalid URLs

### 4. Image Download Capability
- **Local Storage**: Can download images to local temp directory
- **Filename Generation**: Automatic filename generation for downloaded images
- **Format Support**: Supports various image formats (JPEG, PNG, GIF, etc.)

## Backend Implementation

### File Service Methods

#### `extract_content_from_file(file_path: str) -> Optional[Dict]`
Extracts both text and image content from files:
```python
{
    'text': 'extracted text content',
    'images': [
        {
            'src': 'image_url',
            'alt': 'alt text',
            'title': 'title',
            'width': 'width',
            'height': 'height',
            'class': ['class1', 'class2'],
            'id': 'element_id',
            'type': 'background'  # for background images
        }
    ],
    'file_path': 'path/to/file',
    'file_name': 'filename.ext'
}
```

#### `fetch_and_parse_html_from_url(url: str) -> Optional[Dict]`
Fetches HTML from URL and extracts content:
```python
{
    'text': 'extracted text content',
    'images': [image_info_list],
    'url': 'original_url',
    'content_length': 12345
}
```

#### `download_image(image_url: str, save_path: Path = None) -> Optional[Path]`
Downloads an image from URL to local storage.

### Configuration

#### Allowed File Types (config.py)
```python
ALLOWED_FILE_TYPES: list = [
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "text/plain",
    "text/markdown",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    "text/html",                    # Added
    "application/xhtml+xml"         # Added
]
```

#### Dependencies (requirements.txt)
```txt
beautifulsoup4==4.12.2  # HTML parsing
aiohttp==3.9.1          # HTTP requests (already present)
```

## Frontend Implementation

### Upload Step Component

#### File Input
- **Accept Types**: `.pdf,.docx,.txt,.md,.html,.htm`
- **Description**: Updated to mention HTML support

#### URL Input
- **New Feature**: Add webpage URL button
- **URL Validation**: HTML5 URL input validation
- **Virtual File**: Creates virtual HTML file from URL content

#### Image Display
- **Extracted Images**: Shows count of images found in HTML files
- **Image Grid**: Displays image information in a responsive grid
- **Image Details**: Shows alt text, source URL, and dimensions

### Backend Communication

#### File Upload Response
Enhanced file upload success message includes content information:
```json
{
    "type": "file_upload_success",
    "data": {
        "filename": "page.html",
        "file_path": "/path/to/file",
        "file_size": 12345,
        "file_type": "text/html",
        "content_info": {
            "text_length": 1500,
            "images_count": 3,
            "images": [
                {
                    "src": "https://example.com/image.jpg",
                    "alt": "Example Image",
                    "title": "Example",
                    "width": "300",
                    "height": "200"
                }
            ]
        }
    }
}
```

## Testing

### Test Scripts

#### `test_html_parsing.py`
- Tests basic HTML text extraction
- Verifies script/style removal
- Checks text content extraction

#### `test_image_extraction.py`
- Tests image extraction from HTML
- Verifies background image detection
- Tests URL resolution

#### `test_comprehensive_html.py`
- Comprehensive test of all HTML features
- Tests file-based and URL-based extraction
- Tests image downloading functionality

### Running Tests
```bash
cd backend
python test_html_parsing.py
python test_image_extraction.py
python test_comprehensive_html.py
```

## Usage Examples

### 1. Upload HTML File
1. Navigate to the upload step
2. Click "Drop files here or click to upload"
3. Select an HTML file
4. View extracted images in the "Extracted Images" section

### 2. Add Webpage URL
1. Click "Add Webpage URL" button
2. Enter a valid URL (e.g., https://example.com)
3. Click "Add Webpage"
4. Content will be fetched and processed

### 3. View Image Information
- Uploaded HTML files show image count
- Click on file to see detailed image information
- Images are displayed with alt text, source, and dimensions

## Error Handling

### Network Errors
- URL fetching failures are gracefully handled
- Timeout errors are logged and reported
- Invalid URLs are rejected with appropriate messages

### Parsing Errors
- Malformed HTML is handled gracefully
- Missing dependencies (BeautifulSoup) are detected
- Fallback to raw text extraction when parsing fails

### File System Errors
- Disk space issues are handled
- Permission errors are logged
- Temporary file cleanup is automatic

## Future Enhancements

### Potential Improvements
1. **Image Thumbnails**: Generate thumbnails for extracted images
2. **Image Analysis**: Use AI to analyze image content
3. **Slide Integration**: Automatically include relevant images in slides
4. **Caching**: Cache downloaded images to avoid re-downloading
5. **Image Optimization**: Compress and optimize downloaded images

### Additional File Types
1. **XHTML**: Full XHTML support
2. **SVG**: Extract vector graphics
3. **WebP**: Modern image format support
4. **AVIF**: Next-generation image format

## Troubleshooting

### Common Issues

#### BeautifulSoup Not Available
```
Warning: BeautifulSoup not available. HTML parsing will be limited.
```
**Solution**: Install beautifulsoup4: `pip install beautifulsoup4`

#### Network Timeout
```
Error fetching HTML from URL: timeout
```
**Solution**: Check network connection and URL accessibility

#### File Permission Errors
```
Error saving file: Permission denied
```
**Solution**: Check directory permissions and disk space

### Debug Information
- All operations are logged with appropriate log levels
- File paths and URLs are logged for debugging
- Error details are included in log messages
- Network request status codes are logged 