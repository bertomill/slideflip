"""
Document Parser Service using LangChain
Handles parsing of PDF, DOCX, and other document formats for slide generation
"""

import logging
from typing import List, Dict, Any, Optional
from pathlib import Path

from langchain_community.document_loaders import (
    PyPDFLoader,
    UnstructuredWordDocumentLoader,
    TextLoader,
    UnstructuredMarkdownLoader,
    UnstructuredHTMLLoader
)
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain.schema import Document

logger = logging.getLogger(__name__)


class DocumentParserService:
    """Service for parsing various document formats using LangChain"""

    def __init__(self):
        self.text_splitter = RecursiveCharacterTextSplitter(
            chunk_size=2000,
            chunk_overlap=200,
            length_function=len,
            separators=["\n\n", "\n", " ", ""]
        )

        # File type to loader mapping
        self.loader_mapping = {
            "application/pdf": self._load_pdf,
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document": self._load_docx,
            "text/plain": self._load_text,
            "text/markdown": self._load_markdown,
            "text/html": self._load_html,
            "application/xhtml+xml": self._load_html,
        }

    async def parse_document(
        self,
        file_path: str,
        file_type: str,
        filename: str
    ) -> Dict[str, Any]:
        """
        Parse a document and return structured content for slide generation

        Args:
            file_path: Path to the uploaded file
            file_type: MIME type of the file
            filename: Original filename

        Returns:
            Dict containing parsed content, metadata, and structured data
        """
        try:
            logger.info(
                f"📄 Starting document parsing for {filename} (type: {file_type})")

            # Load document using appropriate loader
            documents = await self._load_document(file_path, file_type)

            if not documents:
                logger.warning(f"No content extracted from {filename}")
                return self._create_empty_result(filename, file_path)

            # Split documents into chunks
            chunks = self.text_splitter.split_documents(documents)

            # Extract and structure content
            parsed_content = self._structure_content(chunks, filename)

            logger.info(
                f"✅ Successfully parsed {filename}: {len(chunks)} chunks, {len(parsed_content['full_text'])} characters")

            return parsed_content

        except Exception as e:
            logger.error(f"❌ Error parsing document {filename}: {e}")
            return self._create_error_result(filename, file_path, str(e))

    async def _load_document(self, file_path: str, file_type: str) -> List[Document]:
        """Load document using appropriate LangChain loader"""
        loader_func = self.loader_mapping.get(file_type)

        if not loader_func:
            logger.warning(f"No loader available for file type: {file_type}")
            return []

        return await loader_func(file_path)

    async def _load_pdf(self, file_path: str) -> List[Document]:
        """Load PDF using PyPDFLoader"""
        try:
            loader = PyPDFLoader(file_path)
            return loader.load()
        except Exception as e:
            logger.error(f"Error loading PDF: {e}")
            return []

    async def _load_docx(self, file_path: str) -> List[Document]:
        """Load DOCX using UnstructuredWordDocumentLoader"""
        try:
            loader = UnstructuredWordDocumentLoader(file_path)
            return loader.load()
        except Exception as e:
            logger.error(f"Error loading DOCX: {e}")
            return []

    async def _load_text(self, file_path: str) -> List[Document]:
        """Load plain text files"""
        try:
            loader = TextLoader(file_path, encoding='utf-8')
            return loader.load()
        except Exception as e:
            logger.error(f"Error loading text file: {e}")
            return []

    async def _load_markdown(self, file_path: str) -> List[Document]:
        """Load Markdown files"""
        try:
            loader = UnstructuredMarkdownLoader(file_path)
            return loader.load()
        except Exception as e:
            logger.error(f"Error loading Markdown file: {e}")
            return []

    async def _load_html(self, file_path: str) -> List[Document]:
        """Load HTML files"""
        try:
            loader = UnstructuredHTMLLoader(file_path)
            return loader.load()
        except Exception as e:
            logger.error(f"Error loading HTML file: {e}")
            return []

    def _structure_content(self, chunks: List[Document], filename: str) -> Dict[str, Any]:
        """Structure the parsed content for slide generation"""

        # Combine all text
        full_text = "\n\n".join([chunk.page_content for chunk in chunks])

        # Extract key information
        structured_content = {
            "filename": filename,
            "full_text": full_text,
            "chunks": [
                {
                    "content": chunk.page_content,
                    "metadata": chunk.metadata,
                    "chunk_index": i
                }
                for i, chunk in enumerate(chunks)
            ],
            "total_chunks": len(chunks),
            "total_characters": len(full_text),
            "summary": self._create_content_summary(chunks),
            "key_sections": self._extract_key_sections(chunks),
            "parsed_successfully": True,
            "parser_type": "langchain"
        }

        return structured_content

    def _create_content_summary(self, chunks: List[Document]) -> Dict[str, Any]:
        """Create a summary of the document content"""
        total_chars = sum(len(chunk.page_content) for chunk in chunks)

        # Basic content analysis
        content_preview = ""
        if chunks:
            content_preview = chunks[0].page_content[:500] + "..." if len(
                chunks[0].page_content) > 500 else chunks[0].page_content

        return {
            "total_chunks": len(chunks),
            "total_characters": total_chars,
            "average_chunk_size": total_chars // len(chunks) if chunks else 0,
            "content_preview": content_preview,
            "has_multiple_pages": len(chunks) > 1
        }

    def _extract_key_sections(self, chunks: List[Document]) -> List[Dict[str, Any]]:
        """Extract key sections from the document"""
        sections = []

        for i, chunk in enumerate(chunks):
            # Look for potential headings or important sections
            lines = chunk.page_content.split('\n')
            section_title = None

            # Try to identify section titles (simple heuristic)
            for line in lines[:3]:  # Check first few lines
                line = line.strip()
                if line and (len(line) < 100 and (line.isupper() or line.title() == line)):
                    section_title = line
                    break

            sections.append({
                "section_index": i,
                "title": section_title or f"Section {i + 1}",
                "content": chunk.page_content[:200] + "..." if len(chunk.page_content) > 200 else chunk.page_content,
                "full_content": chunk.page_content,
                "character_count": len(chunk.page_content),
                "metadata": chunk.metadata
            })

        return sections

    def _create_empty_result(self, filename: str, file_path: str) -> Dict[str, Any]:
        """Create empty result for failed parsing"""
        return {
            "filename": filename,
            "full_text": "",
            "chunks": [],
            "total_chunks": 0,
            "total_characters": 0,
            "summary": {"error": "No content extracted"},
            "key_sections": [],
            "parsed_successfully": False,
            "parser_type": "langchain",
            "error": "No content could be extracted from the document"
        }

    def _create_error_result(self, filename: str, file_path: str, error: str) -> Dict[str, Any]:
        """Create error result for failed parsing"""
        return {
            "filename": filename,
            "full_text": "",
            "chunks": [],
            "total_chunks": 0,
            "total_characters": 0,
            "summary": {"error": error},
            "key_sections": [],
            "parsed_successfully": False,
            "parser_type": "langchain",
            "error": error
        }

    def format_for_slide_generation(self, parsed_content: Dict[str, Any]) -> str:
        """
        Format parsed content for use in slide generation prompts

        Returns a structured string optimized for OpenAI prompts
        """
        if not parsed_content.get("parsed_successfully", False):
            return f"Document: {parsed_content.get('filename', 'Unknown')}\nError: {parsed_content.get('error', 'Failed to parse')}"

        formatted_content = []

        # Add document header
        formatted_content.append(
            f"=== DOCUMENT: {parsed_content['filename']} ===")
        formatted_content.append(
            f"Total sections: {parsed_content['total_chunks']}")
        formatted_content.append(
            f"Total characters: {parsed_content['total_characters']}")
        formatted_content.append("")

        # Add content summary
        summary = parsed_content.get('summary', {})
        if 'content_preview' in summary:
            formatted_content.append("=== CONTENT PREVIEW ===")
            formatted_content.append(summary['content_preview'])
            formatted_content.append("")

        # Add key sections
        formatted_content.append("=== DOCUMENT SECTIONS ===")
        for section in parsed_content.get('key_sections', []):
            formatted_content.append(f"## {section['title']}")
            formatted_content.append(section['full_content'])
            formatted_content.append("")

        # If no sections, add full text
        if not parsed_content.get('key_sections'):
            formatted_content.append("=== FULL CONTENT ===")
            formatted_content.append(parsed_content.get('full_text', ''))

        return "\n".join(formatted_content)
