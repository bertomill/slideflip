#!/usr/bin/env python3
"""
Startup script for the SlideFlip Backend
"""

import os
import sys
import subprocess
import time
import signal
from pathlib import Path


def check_dependencies():
    """Check if required dependencies are installed"""
    try:
        import fastapi
        import uvicorn
        import websockets
        import aiofiles
        import pydantic
        print("✅ All dependencies are installed")
        return True
    except ImportError as e:
        print(f"❌ Missing dependency: {e}")
        print("Please run: pip install -r requirements.txt")
        return False


def create_directories():
    """Create necessary directories"""
    directories = ['uploads', 'temp', 'output']
    for directory in directories:
        Path(directory).mkdir(exist_ok=True)
        print(f"✅ Created directory: {directory}")


def start_backend():
    """Start the backend server"""
    print("🚀 Starting SlideFlip Backend...")

    # Check if we're in the right directory
    if not Path("main.py").exists():
        print("❌ main.py not found. Please run this script from the backend directory.")
        return False

    # Check dependencies
    if not check_dependencies():
        return False

    # Create directories
    create_directories()

    # Start the server
    try:
        print("📡 Starting server on http://localhost:8000")
        print("🔌 WebSocket endpoint: ws://localhost:8000/ws/{client_id}")
        print("📚 API Documentation: http://localhost:8000/docs")
        print("🛑 Press Ctrl+C to stop the server")
        print("-" * 50)

        # Run the server
        subprocess.run([
            sys.executable, "-m", "uvicorn",
            "main:app",
            "--host", "0.0.0.0",
            "--port", "8000",
            "--reload"
        ])

    except KeyboardInterrupt:
        print("\n🛑 Server stopped by user")
        return True
    except Exception as e:
        print(f"❌ Failed to start server: {e}")
        return False


def main():
    """Main function"""
    print("🎯 SlideFlip Backend Startup")
    print("=" * 40)

    success = start_backend()

    if success:
        print("✅ Backend stopped successfully")
    else:
        print("❌ Backend failed to start")
        sys.exit(1)


if __name__ == "__main__":
    main()
