"""
File service for handling file uploads and storage
"""

import asyncio
import aiofiles
import base64
import hashlib
import logging
import os
from pathlib import Path
from typing import List, Dict, Optional
from datetime import datetime
import mimetypes

# Add BeautifulSoup for HTML parsing
try:
    from bs4 import BeautifulSoup
    BEAUTIFULSOUP_AVAILABLE = True
except ImportError:
    BEAUTIFULSOUP_AVAILABLE = False
    logging.warning("BeautifulSoup not available. HTML parsing will be limited.")

# Add aiohttp for URL fetching
try:
    import aiohttp
    AIOHTTP_AVAILABLE = True
except ImportError:
    AIOHTTP_AVAILABLE = False
    logging.warning("aiohttp not available. URL fetching will not be supported.")

from src.core.config import Settings
from src.models.message_models import FileInfo

logger = logging.getLogger(__name__)

class FileService:
    """Service for handling file operations"""
    
    def __init__(self):
        self.settings = Settings()
        self.client_files: Dict[str, List[FileInfo]] = {}
        
        # Create necessary directories
        os.makedirs(self.settings.UPLOAD_DIR, exist_ok=True)
        os.makedirs(self.settings.TEMP_DIR, exist_ok=True)
    
    async def save_uploaded_file(
        self, 
        filename: str, 
        content: str, 
        file_type: str,
        client_id: Optional[str] = None
    ) -> Path:
        """Save an uploaded file to disk"""
        try:
            # Decode base64 content
            file_content = base64.b64decode(content)
            
            # Validate file size
            if len(file_content) > self.settings.MAX_FILE_SIZE:
                raise ValueError(f"File size exceeds maximum allowed size of {self.settings.MAX_FILE_SIZE} bytes")
            
            # Validate file type
            if file_type not in self.settings.ALLOWED_FILE_TYPES:
                raise ValueError(f"File type {file_type} is not allowed")
            
            # Create client-specific folder
            if client_id:
                client_folder = Path(self.settings.UPLOAD_DIR) / f"client_{client_id}"
                client_folder.mkdir(parents=True, exist_ok=True)
                logger.info(f"Created/accessed folder for client {client_id}: {client_folder}")
            else:
                client_folder = Path(self.settings.UPLOAD_DIR)
            
            # Generate unique filename
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            file_hash = hashlib.md5(file_content).hexdigest()[:8]
            safe_filename = self._sanitize_filename(filename)
            unique_filename = f"{timestamp}_{file_hash}_{safe_filename}"
            
            # Create file path within client folder
            file_path = client_folder / unique_filename
            
            # Save file
            async with aiofiles.open(file_path, 'wb') as f:
                await f.write(file_content)
            
            # Create file info
            file_info = FileInfo(
                filename=filename,
                file_path=str(file_path),
                file_size=len(file_content),
                file_type=file_type,
                upload_time=datetime.now().isoformat()
            )
            
            # Store file info for client
            if client_id:
                if client_id not in self.client_files:
                    self.client_files[client_id] = []
                self.client_files[client_id].append(file_info)
                logger.info(f"Associated file {filename} with client {client_id}")
            
            logger.info(f"File saved successfully: {file_path}")
            return file_path
            
        except Exception as e:
            logger.error(f"Error saving file {filename}: {e}")
            raise
    
    def _sanitize_filename(self, filename: str) -> str:
        """Sanitize filename for safe storage"""
        # Remove or replace unsafe characters
        unsafe_chars = ['<', '>', ':', '"', '|', '?', '*', '\\', '/']
        safe_filename = filename
        for char in unsafe_chars:
            safe_filename = safe_filename.replace(char, '_')
        
        # Limit length
        if len(safe_filename) > 100:
            name, ext = os.path.splitext(safe_filename)
            safe_filename = name[:100-len(ext)] + ext
        
        return safe_filename
    
    async def get_client_files(self, client_id: str) -> List[FileInfo]:
        """Get all files uploaded by a specific client"""
        return self.client_files.get(client_id, [])
    
    async def delete_client_files(self, client_id: str) -> bool:
        """Delete all files for a specific client"""
        try:
            if client_id in self.client_files:
                # Get the client folder path
                client_folder = Path(self.settings.UPLOAD_DIR) / f"client_{client_id}"
                
                # Remove all files in the client folder
                for file_info in self.client_files[client_id]:
                    file_path = Path(file_info.file_path)
                    if file_path.exists():
                        file_path.unlink()
                        logger.info(f"Deleted file: {file_path}")
                
                # Remove the client folder if it exists and is empty
                if client_folder.exists():
                    try:
                        client_folder.rmdir()  # This will only remove if folder is empty
                        logger.info(f"Removed client folder: {client_folder}")
                    except OSError:
                        # Folder not empty, leave it for now
                        logger.info(f"Client folder not empty, leaving: {client_folder}")
                
                # Remove from memory
                del self.client_files[client_id]
                logger.info(f"Deleted all files for client {client_id}")
                return True
            return False
        except Exception as e:
            logger.error(f"Error deleting files for client {client_id}: {e}")
            return False
    
    async def get_file_content(self, file_path: str) -> Optional[bytes]:
        """Get file content as bytes"""
        try:
            path = Path(file_path)
            if not path.exists():
                return None
            
            async with aiofiles.open(path, 'rb') as f:
                return await f.read()
        except Exception as e:
            logger.error(f"Error reading file {file_path}: {e}")
            return None
    
    async def extract_text_from_file(self, file_path: str) -> Optional[str]:
        """Extract text content from various file types"""
        try:
            file_content = await self.get_file_content(file_path)
            if not file_content:
                return None
            
            path = Path(file_path)
            file_extension = path.suffix.lower()
            
            if file_extension == '.txt':
                return file_content.decode('utf-8', errors='ignore')
            elif file_extension == '.md':
                return file_content.decode('utf-8', errors='ignore')
            elif file_extension == '.html' or file_extension == '.htm':
                return await self._extract_text_from_html(file_content)
            elif file_extension == '.pdf':
                # For PDF files, we would need a PDF library
                # For now, return a placeholder
                return f"[PDF Content from {path.name}]"
            elif file_extension == '.docx':
                # For DOCX files, we would need a DOCX library
                # For now, return a placeholder
                return f"[DOCX Content from {path.name}]"
            else:
                # Try to decode as text
                return file_content.decode('utf-8', errors='ignore')
                
        except Exception as e:
            logger.error(f"Error extracting text from {file_path}: {e}")
            return None
    
    async def extract_content_from_file(self, file_path: str) -> Optional[Dict]:
        """Extract both text and image content from various file types"""
        try:
            file_content = await self.get_file_content(file_path)
            if not file_content:
                return None
            
            path = Path(file_path)
            file_extension = path.suffix.lower()
            
            result = {
                'text': None,
                'images': [],
                'file_path': str(file_path),
                'file_name': path.name
            }
            
            if file_extension == '.txt':
                result['text'] = file_content.decode('utf-8', errors='ignore')
            elif file_extension == '.md':
                result['text'] = file_content.decode('utf-8', errors='ignore')
            elif file_extension == '.html' or file_extension == '.htm':
                result['text'] = await self._extract_text_from_html(file_content)
                result['images'] = await self._extract_images_from_html(file_content)
            elif file_extension == '.pdf':
                # For PDF files, we would need a PDF library
                result['text'] = f"[PDF Content from {path.name}]"
            elif file_extension == '.docx':
                # For DOCX files, we would need a DOCX library
                result['text'] = f"[DOCX Content from {path.name}]"
            else:
                # Try to decode as text
                result['text'] = file_content.decode('utf-8', errors='ignore')
            
            return result
                
        except Exception as e:
            logger.error(f"Error extracting content from {file_path}: {e}")
            return None
    
    async def _extract_text_from_html(self, html_content: bytes) -> str:
        """Extract text content from HTML using BeautifulSoup"""
        try:
            if not BEAUTIFULSOUP_AVAILABLE:
                # Fallback: try to decode as text and return raw content
                return html_content.decode('utf-8', errors='ignore')
            
            # Decode HTML content
            html_text = html_content.decode('utf-8', errors='ignore')
            
            # Parse HTML with BeautifulSoup
            soup = BeautifulSoup(html_text, 'html.parser')
            
            # Remove script and style elements
            for script in soup(["script", "style"]):
                script.decompose()
            
            # Get text content
            text = soup.get_text()
            
            # Clean up whitespace
            lines = (line.strip() for line in text.splitlines())
            chunks = (phrase.strip() for line in lines for phrase in line.split("  "))
            text = ' '.join(chunk for chunk in chunks if chunk)
            
            # If no meaningful text found, return a fallback
            if not text.strip():
                # Try to get title
                title = soup.find('title')
                if title:
                    text = f"HTML Document: {title.get_text()}"
                else:
                    text = "HTML Document (no text content found)"
            
            return text
            
        except Exception as e:
            logger.error(f"Error parsing HTML content: {e}")
            # Fallback: return raw decoded content
            return html_content.decode('utf-8', errors='ignore')
    
    async def _extract_images_from_html(self, html_content: bytes, base_url: str = None) -> List[Dict]:
        """Extract image information from HTML content"""
        try:
            if not BEAUTIFULSOUP_AVAILABLE:
                logger.warning("BeautifulSoup not available for image extraction")
                return []
            
            # Decode HTML content
            html_text = html_content.decode('utf-8', errors='ignore')
            
            # Parse HTML with BeautifulSoup
            soup = BeautifulSoup(html_text, 'html.parser')
            
            images = []
            
            # Find all img tags
            for img in soup.find_all('img'):
                image_info = {
                    'src': img.get('src', ''),
                    'alt': img.get('alt', ''),
                    'title': img.get('title', ''),
                    'width': img.get('width', ''),
                    'height': img.get('height', ''),
                    'class': img.get('class', []),
                    'id': img.get('id', '')
                }
                
                # Resolve relative URLs if base_url is provided
                if base_url and image_info['src']:
                    if not image_info['src'].startswith(('http://', 'https://', 'data:')):
                        from urllib.parse import urljoin
                        image_info['src'] = urljoin(base_url, image_info['src'])
                
                # Only add if we have a valid src
                if image_info['src']:
                    images.append(image_info)
            
            # Also look for background images in CSS
            for element in soup.find_all(style=True):
                style_content = element.get_text()
                # Simple regex to find background-image URLs
                import re
                bg_images = re.findall(r'background-image:\s*url\(["\']?([^"\')\s]+)["\']?\)', style_content)
                for bg_src in bg_images:
                    if bg_src and not bg_src.startswith('data:'):
                        image_info = {
                            'src': bg_src,
                            'alt': 'Background image',
                            'title': 'Background image from CSS',
                            'width': '',
                            'height': '',
                            'class': [],
                            'id': '',
                            'type': 'background'
                        }
                        
                        # Resolve relative URLs if base_url is provided
                        if base_url:
                            if not image_info['src'].startswith(('http://', 'https://')):
                                from urllib.parse import urljoin
                                image_info['src'] = urljoin(base_url, image_info['src'])
                        
                        images.append(image_info)
            
            logger.info(f"Extracted {len(images)} images from HTML")
            return images
            
        except Exception as e:
            logger.error(f"Error extracting images from HTML: {e}")
            return []
    
    async def download_image(self, image_url: str, save_path: Path = None) -> Optional[Path]:
        """Download an image from URL"""
        try:
            if not AIOHTTP_AVAILABLE:
                logger.error("aiohttp not available for image downloading")
                return None
            
            async with aiohttp.ClientSession() as session:
                async with session.get(image_url, timeout=30) as response:
                    if response.status == 200:
                        image_content = await response.read()
                        
                        # Generate filename if not provided
                        if not save_path:
                            filename = image_url.split('/')[-1]
                            if '?' in filename:
                                filename = filename.split('?')[0]
                            if not filename or '.' not in filename:
                                filename = f"image_{hash(image_url) % 10000}.jpg"
                            
                            save_path = Path(self.settings.TEMP_DIR) / filename
                        
                        # Save image
                        async with aiofiles.open(save_path, 'wb') as f:
                            await f.write(image_content)
                        
                        logger.info(f"Downloaded image: {save_path}")
                        return save_path
                    else:
                        logger.error(f"Failed to download image {image_url}: HTTP {response.status}")
                        return None
                        
        except Exception as e:
            logger.error(f"Error downloading image {image_url}: {e}")
            return None
    
    async def fetch_and_parse_html_from_url(self, url: str) -> Optional[Dict]:
        """Fetch HTML content from a URL and extract text and images"""
        try:
            if not AIOHTTP_AVAILABLE:
                logger.error("aiohttp not available for URL fetching")
                return None
            
            async with aiohttp.ClientSession() as session:
                async with session.get(url, timeout=30) as response:
                    if response.status == 200:
                        html_content = await response.read()
                        
                        # Extract text
                        text_content = await self._extract_text_from_html(html_content)
                        
                        # Extract images
                        images = await self._extract_images_from_html(html_content, url)
                        
                        return {
                            'text': text_content,
                            'images': images,
                            'url': url,
                            'content_length': len(html_content)
                        }
                    else:
                        logger.error(f"Failed to fetch URL {url}: HTTP {response.status}")
                        return None
                        
        except Exception as e:
            logger.error(f"Error fetching HTML from URL {url}: {e}")
            return None
    
    async def get_file_info(self, file_path: str) -> Optional[Dict]:
        """Get detailed information about a file"""
        try:
            path = Path(file_path)
            if not path.exists():
                return None
            
            stat = path.stat()
            return {
                "filename": path.name,
                "file_path": str(path),
                "file_size": stat.st_size,
                "file_type": mimetypes.guess_type(str(path))[0] or "application/octet-stream",
                "created_time": datetime.fromtimestamp(stat.st_ctime).isoformat(),
                "modified_time": datetime.fromtimestamp(stat.st_mtime).isoformat()
            }
        except Exception as e:
            logger.error(f"Error getting file info for {file_path}: {e}")
            return None
    
    async def cleanup_temp_files(self, max_age_hours: int = 24) -> int:
        """Clean up temporary files older than specified age"""
        try:
            temp_dir = Path(self.settings.TEMP_DIR)
            if not temp_dir.exists():
                return 0
            
            cutoff_time = datetime.now().timestamp() - (max_age_hours * 3600)
            deleted_count = 0
            
            for file_path in temp_dir.rglob('*'):
                if file_path.is_file():
                    if file_path.stat().st_mtime < cutoff_time:
                        file_path.unlink()
                        deleted_count += 1
            
            logger.info(f"Cleaned up {deleted_count} temporary files")
            return deleted_count
            
        except Exception as e:
            logger.error(f"Error cleaning up temp files: {e}")
            return 0
    
    def get_storage_stats(self) -> Dict:
        """Get storage statistics"""
        try:
            upload_dir = Path(self.settings.UPLOAD_DIR)
            temp_dir = Path(self.settings.TEMP_DIR)
            
            upload_size = sum(f.stat().st_size for f in upload_dir.rglob('*') if f.is_file()) if upload_dir.exists() else 0
            temp_size = sum(f.stat().st_size for f in temp_dir.rglob('*') if f.is_file()) if temp_dir.exists() else 0
            
            # Get client folder statistics
            client_folders = self.list_client_folders()
            client_folder_count = len(client_folders)
            total_client_files = sum(len(self.client_files.get(client_id, [])) for client_id in client_folders)
            
            return {
                "upload_directory_size": upload_size,
                "temp_directory_size": temp_size,
                "total_size": upload_size + temp_size,
                "client_files_count": len(self.client_files),
                "total_files_count": sum(len(files) for files in self.client_files.values()),
                "client_folders_count": client_folder_count,
                "client_folders": client_folders,
                "total_client_files": total_client_files
            }
        except Exception as e:
            logger.error(f"Error getting storage stats: {e}")
            return {}
    
    def get_client_folder_path(self, client_id: str) -> Path:
        """Get the folder path for a specific client"""
        return Path(self.settings.UPLOAD_DIR) / f"client_{client_id}"
    
    def get_client_folder_size(self, client_id: str) -> int:
        """Get the total size of files in a client folder"""
        try:
            client_folder = self.get_client_folder_path(client_id)
            if not client_folder.exists():
                return 0
            
            total_size = 0
            for file_path in client_folder.rglob('*'):
                if file_path.is_file():
                    total_size += file_path.stat().st_size
            
            return total_size
        except Exception as e:
            logger.error(f"Error getting folder size for client {client_id}: {e}")
            return 0
    
    def list_client_folders(self) -> List[str]:
        """List all client folders"""
        try:
            upload_dir = Path(self.settings.UPLOAD_DIR)
            if not upload_dir.exists():
                return []
            
            client_folders = []
            for item in upload_dir.iterdir():
                if item.is_dir() and item.name.startswith('client_'):
                    client_id = item.name[7:]  # Remove 'client_' prefix
                    client_folders.append(client_id)
            
            return client_folders
        except Exception as e:
            logger.error(f"Error listing client folders: {e}")
            return []
    
    def cleanup_old_client_folders(self, max_age_hours: int = 24) -> int:
        """Clean up client folders older than specified age"""
        try:
            upload_dir = Path(self.settings.UPLOAD_DIR)
            if not upload_dir.exists():
                return 0
            
            cutoff_time = datetime.now().timestamp() - (max_age_hours * 3600)
            deleted_count = 0
            
            for client_folder in upload_dir.iterdir():
                if client_folder.is_dir() and client_folder.name.startswith('client_'):
                    # Check if folder is old (use modification time of any file in folder)
                    folder_age = 0
                    for file_path in client_folder.rglob('*'):
                        if file_path.is_file():
                            folder_age = max(folder_age, file_path.stat().st_mtime)
                    
                    if folder_age < cutoff_time:
                        # Remove folder and all contents
                        import shutil
                        shutil.rmtree(client_folder)
                        deleted_count += 1
                        logger.info(f"Cleaned up old client folder: {client_folder}")
            
            return deleted_count
        except Exception as e:
            logger.error(f"Error cleaning up old client folders: {e}")
            return 0 