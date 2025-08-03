# Slide Generation Functionality

This document describes the slide generation functionality that has been added to the SlideFlip backend.

## Overview

The slide generation system now supports generating both HTML content for preview and PPT files for download. The system includes placeholder functions that can be easily replaced with actual implementation.

## Key Components

### 1. Slide Service (`src/services/slide_service.py`)

#### Main Function: `generate_slide_with_params()`
- **Input**: Files, description, theme, research preference
- **Output**: Dictionary containing:
  - `slide_html`: HTML content for preview
  - `ppt_file_path`: Path to generated PPT file
  - `slide_data`: Structured slide data
  - `processing_time`: Generation time
  - `files_processed`: Number of files processed
  - `content_extracted`: Number of content items extracted

#### New Functions Added:

##### `_generate_ppt_file()`
- Generates PPT files from content
- Creates unique filenames based on timestamp and description
- Returns file path for download
- **Placeholder**: Currently creates text files with .pptx extension

##### `_create_placeholder_ppt_file()`
- Creates placeholder PPT files for testing
- Includes metadata about generation parameters
- **Future**: Will be replaced with actual PPT generation using python-pptx

### 2. Backend API (`main.py`)

#### WebSocket Message Updates:
- `slide_generation_complete` now includes `ppt_file_path`
- Enhanced error handling for file generation

#### New Download Endpoint:
- `GET /download/{file_path:path}`
- Serves generated PPT files for download
- Includes security checks to prevent directory traversal
- Returns files with proper MIME type

### 3. Frontend Updates

#### SlideData Type (`app/builder/page.tsx`):
- Added `pptFilePath?: string` property
- Updated websocket message handling to store PPT file path

#### Download Step (`components/builder/download-step.tsx`):
- Updated to use actual PPT file path from backend
- Falls back to mock download if file not available
- Downloads from `/download/{file_path}` endpoint

## File Structure

```
backend/
├── output/                    # Generated PPT files
│   └── slide_YYYYMMDD_HHMMSS_description.pptx
├── test_files/               # Test files for development
├── src/services/slide_service.py
├── main.py
├── test_slide_generation.py  # Test script
└── SLIDE_GENERATION_README.md
```

## Testing

### Run the Test Script:
```bash
cd backend
python test_slide_generation.py
```

### Expected Output:
```
Testing slide generation functionality...
Testing with description: Create a professional slide about quarterly sales results...
Number of files: 1

=== Generation Result ===
Success: True
Processing time: 0.XX seconds
Files processed: 1
Content extracted: 1
Theme: professional
Research enabled: True
HTML generated: XXXX characters
HTML preview (first 200 chars): ...
PPT file generated: output/slide_YYYYMMDD_HHMMSS_description.pptx
PPT file size: XXX bytes

=== Test Complete ===
```

## Future Implementation

### PPT Generation Libraries:
1. **python-pptx**: For creating actual PowerPoint files
2. **python-docx**: For Word document generation
3. **reportlab**: For PDF generation

### Example Implementation:
```python
from pptx import Presentation
from pptx.util import Inches

def create_actual_ppt_file(self, file_path: str, content: str, theme: str):
    prs = Presentation()
    
    # Add slide
    slide_layout = prs.slide_layouts[1]  # Title and Content
    slide = prs.slides.add_slide(slide_layout)
    
    # Add title
    title = slide.shapes.title
    title.text = "Generated Presentation"
    
    # Add content
    content_placeholder = slide.placeholders[1]
    content_placeholder.text = content
    
    # Save presentation
    prs.save(file_path)
```

## API Endpoints

### WebSocket Messages:
- `slide_generation_started`: Generation begins
- `slide_generation_status`: Progress updates
- `slide_generation_complete`: Generation finished (includes PPT path)
- `slide_generation_error`: Error occurred

### HTTP Endpoints:
- `GET /download/{file_path}`: Download generated PPT files

## Security Considerations

1. **File Path Validation**: Download endpoint prevents directory traversal
2. **File Type Validation**: Only serves files from output directory
3. **Error Handling**: Graceful fallbacks for missing files

## Configuration

### Environment Variables:
- `UPLOAD_DIR`: Directory for uploaded files
- `OUTPUT_DIR`: Directory for generated files
- `TEMP_DIR`: Directory for temporary files

### File Naming Convention:
- Format: `slide_YYYYMMDD_HHMMSS_description.pptx`
- Safe characters only in filename
- Unique timestamps prevent conflicts

## Next Steps

1. **Implement actual PPT generation** using python-pptx
2. **Add more themes and layouts** for variety
3. **Implement file cleanup** for old generated files
4. **Add file compression** for large presentations
5. **Implement caching** for frequently generated content 