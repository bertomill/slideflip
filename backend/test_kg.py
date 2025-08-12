#!/usr/bin/env python3
"""
Test script for knowledge graph functionality with tokenizer-based chunking
"""

import asyncio
import logging
from pathlib import Path
import sys

# Add src to path
sys.path.append(str(Path(__file__).parent / "src"))

from src.services.knowledge_graph_service import KnowledgeGraphService
from src.models.message_models import FileInfo

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)

async def test_knowledge_graph():
    """Test the knowledge graph functionality"""
    print("Testing Knowledge Graph Service with Tokenizer-Based Chunking...")

    # Create a test client ID
    client_id = "test_client_001"

    # Initialize the knowledge graph service
    kg_service = KnowledgeGraphService(client_id)

    # Create test file info
    test_file = FileInfo(
        filename="test_document.txt",
        file_path="/tmp/test_document.txt",
        file_size=1024,
        file_type="text/plain",
        upload_time="2024-01-01T00:00:00"
    )

    # Test content with multiple sentences to test chunking
    test_content = """
    Apple Inc. is a technology company headquartered in Cupertino, California. 
    The company was founded by Steve Jobs, Steve Wozniak, and Ronald Wayne in 1976. 
    Apple designs, develops, and sells consumer electronics, computer software, and online services. 
    The company's hardware products include the iPhone smartphone, the iPad tablet computer, the Mac personal computer, the Apple Watch smartwatch, and the Apple TV digital media player.

    Microsoft Corporation is an American multinational technology company. 
    Bill Gates and Paul Allen founded Microsoft in 1975. 
    The company develops, manufactures, licenses, supports, and sells computer software, consumer electronics, and related services. 
    Microsoft's best-known software products are the Microsoft Windows line of operating systems, the Microsoft Office suite, and the Internet Explorer and Edge web browsers.

    Both Apple and Microsoft are major competitors in the personal computer market. 
    Apple's macOS and Microsoft's Windows are the two dominant operating systems. 
    The rivalry between these companies has shaped the technology industry for decades. 
    Steve Jobs and Bill Gates had a complex relationship, both as competitors and collaborators.

    Google LLC is an American multinational technology company that specializes in Internet-related services and products. 
    These include online advertising technologies, search engine, cloud computing, software, and hardware. 
    Google was founded by Larry Page and Sergey Brin while they were Ph.D. students at Stanford University.

    The relationship between these tech giants is complex. 
    Apple and Google compete in mobile operating systems with iOS and Android. 
    Microsoft and Google compete in cloud services and productivity software. 
    However, they also collaborate on various projects and standards.
    """

    print(f"Processing test content: {len(test_content)} characters")
    print(f"Expected chunks: ~{len(test_content) // 512} (based on 512 token chunks)")

    try:
        # Process the file for knowledge graph
        await kg_service._process_file_for_knowledge_graph(test_file, test_content)

        print("✅ Knowledge graph processing completed successfully!")

        # Get statistics
        stats = kg_service.get_graph_statistics()
        print(f"Graph Statistics: {stats}")

        # Check if files were created
        base_dir = Path("kg") / client_id
        graph_data_dir = base_dir / "graph_data"
        graphs_dir = base_dir / "graphs"

        print(f"Checking output directories...")
        print(f"Graph data directory exists: {graph_data_dir.exists()}")
        print(f"Graphs directory exists: {graphs_dir.exists()}")

        if graph_data_dir.exists():
            json_files = list(graph_data_dir.glob("*.json"))
            print(f"JSON files created: {len(json_files)}")
            for json_file in json_files:
                print(f"  - {json_file.name}")

        if graphs_dir.exists():
            graph_files = list(graphs_dir.glob("*.gml"))
            print(f"Graph files created: {len(graph_files)}")
            for graph_file in graph_files:
                print(f"  - {graph_file.name}")

        # Test the chunking functionality
        print("\nTesting chunking functionality...")
        chunks = kg_service._chunk_content_with_tokenizer(test_content)
        print(f"Created {len(chunks)} chunks:")
        for i, chunk in enumerate(chunks):
            print(f"  Chunk {i+1}: {len(chunk)} characters")
            if len(chunk) > 100:
                print(f"    Preview: {chunk[:100]}...")
            else:
                print(f"    Content: {chunk}")

    except Exception as e:
        print(f"❌ Error in knowledge graph processing: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(test_knowledge_graph())
