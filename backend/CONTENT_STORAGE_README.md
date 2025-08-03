# Content Storage and Management

This document describes the content storage functionality that allows the SlideFlip backend to store and manage extracted content (text and images) from uploaded files for use in slide generation.

## Overview

The content storage system automatically extracts and stores content from uploaded files, making it available for later stages of slide generation without needing to re-process files.

## Features

### 1. Automatic Content Extraction
- **Text Extraction**: Extracts text content from all supported file types
- **Image Extraction**: Extracts image information from HTML files
- **Metadata Storage**: Stores file information, upload time, and content statistics
- **Client Isolation**: Each client's content is stored separately

### 2. Content Storage
- **In-Memory Storage**: Content is stored in memory for fast access
- **Client-Specific**: Each client has their own content storage
- **Automatic Cleanup**: Content is cleared when client data is cleaned up

### 3. Content Retrieval
- **Get All Content**: Retrieve all stored content for a client
- **Content Statistics**: Get detailed statistics about stored content
- **File-Specific Content**: Get content from specific files

## Backend Implementation

### SlideService Methods

#### `store_extracted_content(client_id: str, content_data: Dict) -> bool`
Stores extracted content for a client:
```python
content_data = {
    'text': 'extracted text content',
    'images': [image_info_list],
    'file_path': 'path/to/file',
    'file_name': 'filename.ext',
    'client_id': 'client_123',
    'upload_time': '2024-01-01T00:00:00'
}
```

#### `get_extracted_content(client_id: str) -> List[Dict]`
Retrieves all stored content for a client.

#### `store_file_content(client_id: str, file_path: str, filename: str) -> bool`
Extracts and stores content from a specific file.

#### `get_client_content_stats(client_id: str) -> Dict`
Gets content statistics for a client:
```python
{
    'client_id': 'client_123',
    'total_files': 3,
    'total_text_length': 1500,
    'total_images': 5,
    'file_types': {'html': 2, 'txt': 1},
    'has_description': True,
    'description_length': 100
}
```

### Integration with File Upload

The content storage is automatically integrated with the file upload process:

1. **File Upload**: When a file is uploaded, it's saved to disk
2. **Content Extraction**: Content is extracted using FileService methods
3. **Content Storage**: Extracted content is stored in SlideService
4. **Success Response**: File upload success includes content information

### Integration with Slide Generation

Slide generation now uses stored content instead of re-extracting:

1. **Content Retrieval**: Get stored content for the client
2. **Content Processing**: Process stored content for slide generation
3. **Performance**: Faster slide generation using pre-extracted content

## API Endpoints

### Debug Endpoint
`GET /debug/client-folders`
Returns detailed information about client folders including content statistics:
```json
{
    "total_clients": 2,
    "client_folders": [
        {
            "client_id": "client_123",
            "folder_path": "/uploads/client_client_123",
            "folder_size": 1024,
            "file_count": 3,
            "files": [...],
            "content_stats": {
                "total_files": 3,
                "total_text_length": 1500,
                "total_images": 5,
                "file_types": {"html": 2, "txt": 1},
                "has_description": true,
                "description_length": 100
            }
        }
    ]
}
```

## Content Format

### Stored Content Structure
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
    'file_name': 'filename.ext',
    'client_id': 'client_123',
    'upload_time': '2024-01-01T00:00:00'
}
```

### Slide Generation Integration
The slide generation methods now handle both old and new content formats:

- **Old Format**: `{'filename': 'file.txt', 'content': 'text content'}`
- **New Format**: `{'file_name': 'file.html', 'text': 'text content', 'images': [...]}`

## Testing

### Test Script
`test_content_storage.py` provides comprehensive testing:

1. **Content Storage**: Tests storing file content
2. **Content Retrieval**: Tests retrieving stored content
3. **Statistics**: Tests content statistics generation
4. **Slide Generation**: Tests slide generation with stored content
5. **Cleanup**: Tests data cleanup functionality

### Running Tests
```bash
cd backend
python test_content_storage.py
```

## Usage Examples

### 1. Automatic Storage
Content is automatically stored when files are uploaded:
```python
# File upload automatically triggers content storage
await slide_service.store_file_content(client_id, file_path, filename)
```

### 2. Manual Storage
Content can be manually stored:
```python
# Extract and store content from a file
success = await slide_service.store_file_content(client_id, file_path, filename)
```

### 3. Content Retrieval
Get stored content for slide generation:
```python
# Get all stored content
content_list = await slide_service.get_extracted_content(client_id)

# Get content statistics
stats = await slide_service.get_client_content_stats(client_id)
```

### 4. Slide Generation
Generate slides using stored content:
```python
# Generate slide with stored content
result = await slide_service.generate_slide(files, description, client_id)
```

## Benefits

### 1. Performance
- **Faster Slide Generation**: No need to re-extract content
- **Reduced I/O**: Content is stored in memory
- **Efficient Processing**: Pre-processed content is ready for use

### 2. Reliability
- **Content Persistence**: Content is available throughout the session
- **Error Recovery**: Stored content survives temporary file issues
- **Consistency**: Same content used for all slide generation attempts

### 3. Analytics
- **Content Statistics**: Track content usage and file types
- **Client Insights**: Understand client content patterns
- **Performance Metrics**: Monitor content processing efficiency

## Error Handling

### Storage Errors
- **Memory Issues**: Graceful handling of memory constraints
- **File Access**: Fallback to file-based extraction if storage fails
- **Data Corruption**: Validation of stored content integrity

### Retrieval Errors
- **Missing Content**: Fallback to file-based extraction
- **Format Issues**: Backward compatibility with old formats
- **Client Issues**: Proper error reporting for client-specific problems

## Future Enhancements

### Potential Improvements
1. **Persistent Storage**: Database storage for content persistence
2. **Content Caching**: Redis-based caching for better performance
3. **Content Compression**: Compress stored content to save memory
4. **Content Versioning**: Track content changes and versions
5. **Content Analytics**: Advanced analytics on content usage

### Additional Features
1. **Content Search**: Search through stored content
2. **Content Tagging**: Tag content for better organization
3. **Content Sharing**: Share content between clients
4. **Content Backup**: Backup stored content to external storage
5. **Content Migration**: Migrate content between storage systems

## Troubleshooting

### Common Issues

#### Content Not Stored
```
Error storing file content for client client_123, file test.html
```
**Solution**: Check file permissions and file service availability

#### Content Not Retrieved
```
No content found for client client_123
```
**Solution**: Verify content was stored and client ID is correct

#### Memory Issues
```
MemoryError: Unable to store content
```
**Solution**: Implement content compression or persistent storage

### Debug Information
- All storage operations are logged with appropriate log levels
- Content statistics are available via debug endpoints
- Error details are included in log messages
- Client-specific information is tracked for debugging 