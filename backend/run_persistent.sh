#!/bin/bash

# SlideFlip Backend Persistent Runner Script
# This script ensures the backend stays running even after terminal closure

echo "🚀 Starting SlideFlip Backend in persistent mode..."

# Check if Python is installed
if ! command -v python3 &> /dev/null; then
    echo "❌ Python 3 is not installed"
    exit 1
fi

# Navigate to backend directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

# Install dependencies if needed
if [ ! -d "venv" ]; then
    echo "📦 Creating virtual environment..."
    python3 -m venv venv
fi

# Activate virtual environment
source venv/bin/activate

# Install requirements
echo "📦 Installing dependencies..."
pip install -q -r requirements.txt

# Create necessary directories
mkdir -p uploads temp output kg logs

# Kill any existing instances
echo "🔍 Checking for existing backend processes..."
pkill -f "uvicorn main:app" 2>/dev/null

# Start the backend with nohup to persist after terminal closure
echo "🎯 Starting backend server..."
nohup uvicorn main:app \
    --host 0.0.0.0 \
    --port 8000 \
    --workers 1 \
    --log-level info \
    > logs/backend.log 2>&1 &

# Get the process ID
BACKEND_PID=$!

# Save PID to file for later management
echo $BACKEND_PID > backend.pid

echo "✅ Backend started with PID: $BACKEND_PID"
echo "📡 Server running at: http://localhost:8000"
echo "📚 API Documentation: http://localhost:8000/docs"
echo "📝 Logs are being written to: logs/backend.log"
echo ""
echo "To stop the backend, run: ./stop_backend.sh"
echo "To view logs, run: tail -f logs/backend.log"