#!/bin/bash

# SlideFlip Backend Stop Script

echo "🛑 Stopping SlideFlip Backend..."

# Check if PID file exists
if [ -f backend.pid ]; then
    PID=$(cat backend.pid)
    
    # Check if process is running
    if ps -p $PID > /dev/null 2>&1; then
        echo "Stopping process with PID: $PID"
        kill $PID
        
        # Wait for process to stop
        sleep 2
        
        # Force kill if still running
        if ps -p $PID > /dev/null 2>&1; then
            echo "Force stopping process..."
            kill -9 $PID
        fi
        
        echo "✅ Backend stopped"
    else
        echo "⚠️ Process with PID $PID is not running"
    fi
    
    # Remove PID file
    rm backend.pid
else
    echo "⚠️ No PID file found. Searching for uvicorn processes..."
    
    # Try to find and kill any uvicorn processes
    pkill -f "uvicorn main:app"
    
    if [ $? -eq 0 ]; then
        echo "✅ Stopped uvicorn processes"
    else
        echo "ℹ️ No running backend processes found"
    fi
fi