#!/bin/bash

# Robust SlideFlip App Startup Script
# This script starts the backend service and waits for it to be actually ready

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to check if a port is actually listening
check_port_listening() {
    local port=$1
    if netstat -tln 2>/dev/null | grep -q ":$port[[:space:]]"; then
        return 0
    else
        return 1
    fi
}

# Function to wait for port to be listening
wait_for_port() {
    local port=$1
    local max_attempts=120  # Increased to 2 minutes for backend startup
    local attempt=1
    
    print_status "Waiting for port $port to be listening..."
    
    while [ $attempt -le $max_attempts ]; do
        if check_port_listening $port; then
            print_success "Port $port is now listening!"
            return 0
        fi
        
        echo -n "."
        sleep 1
        attempt=$((attempt + 1))
    done
    
    print_error "Port $port failed to start listening within expected time"
    return 1
}

# Function to wait for service to be ready
wait_for_service() {
    local url=$1
    local service_name=$2
    local max_attempts=30  # Increased attempts for service readiness
    local attempt=1
    
    print_status "Testing $service_name endpoint..."
    
    while [ $attempt -le $max_attempts ]; do
        if curl -s --max-time 10 "$url" >/dev/null 2>&1; then
            print_success "$service_name endpoint is responding!"
            return 0
        fi
        
        echo -n "."
        sleep 2
        attempt=$((attempt + 1))
    done
    
    print_error "$service_name endpoint failed to respond within expected time"
    return 1
}

# Function to kill processes using specific ports
kill_port_processes() {
    local port=$1
    local service_name=$2
    
    # Find processes using the port
    local pids=$(lsof -ti :$port 2>/dev/null)
    
    if [ ! -z "$pids" ]; then
        print_status "Killing $service_name processes on port $port..."
        for pid in $pids; do
            if kill -TERM $pid 2>/dev/null; then
                print_status "Sent TERM signal to PID $pid"
                sleep 2
                # If process still exists, force kill it
                if kill -0 $pid 2>/dev/null; then
                    if kill -KILL $pid 2>/dev/null; then
                        print_status "Force killed PID $pid"
                    fi
                fi
            fi
        done
        return 0
    else
        return 1
    fi
}

# Function to cleanup background processes on exit
cleanup() {
    print_status "Shutting down services..."
    
    local services_stopped=0
    
    # Kill backend process only if we started it
    if [ ! -z "$BACKEND_PID" ] && [ "$BACKEND_PID" != "existing" ]; then
        if kill $BACKEND_PID 2>/dev/null; then
            print_status "Backend stopped (PID: $BACKEND_PID)"
            services_stopped=1
        else
            print_warning "Backend process may have already stopped"
        fi
    elif [ "$BACKEND_PID" = "existing" ]; then
        print_status "Backend was already running when script started - leaving it running"
    fi
    
    # Kill frontend process only if we started it
    if [ ! -z "$FRONTEND_PID" ] && [ "$FRONTEND_PID" != "existing" ]; then
        if kill $FRONTEND_PID 2>/dev/null; then
            print_status "Frontend stopped (PID: $FRONTEND_PID)"
            services_stopped=1
        else
            print_warning "Frontend process may have already stopped"
        fi
    elif [ "$FRONTEND_PID" = "existing" ]; then
        print_status "Frontend was already running when script started - leaving it running"
    fi
    
    # Always clean up ports to prevent conflicts on next run
    print_status "Cleaning up ports to prevent future conflicts..."
    
    if kill_port_processes 8000 "backend"; then
        print_success "Cleaned up port 8000"
        services_stopped=1
    fi
    
    if kill_port_processes 3000 "frontend"; then
        print_success "Cleaned up port 3000"
        services_stopped=1
    fi
    
    # Also check other common Next.js ports
    for port in 3001 3002 3003; do
        if kill_port_processes $port "frontend"; then
            print_success "Cleaned up port $port"
            services_stopped=1
        fi
    done
    
    if [ $services_stopped -eq 1 ]; then
        print_success "All services and ports have been cleaned up"
    else
        print_status "No cleanup was necessary"
    fi
    
    exit 0
}

# Set up signal handlers
trap cleanup SIGINT SIGTERM

# Check if we're in the right directory
if [ ! -f "package.json" ] || [ ! -d "backend" ]; then
    print_error "Please run this script from the slideflip directory"
    exit 1
fi

# Check if uv is available
if ! command -v uv &> /dev/null; then
    print_error "uv is not installed. Please install uv first: https://docs.astral.sh/uv/getting-started/installation/"
    exit 1
fi

# Check if lsof is available (needed for port cleanup)
if ! command -v lsof &> /dev/null; then
    print_error "lsof is not installed. Please install lsof first: sudo apt-get install lsof"
    exit 1
fi

print_status "Starting SlideFlip Backend..."
echo "=========================================="

# Clean up any leftover processes from previous runs
print_status "Checking for leftover processes from previous runs..."
if kill_port_processes 8000 "backend" 2>/dev/null; then
    print_warning "Cleaned up leftover backend processes on port 8000"
    sleep 2  # Give processes time to fully terminate
fi

if kill_port_processes 3000 "frontend" 2>/dev/null; then
    print_warning "Cleaned up leftover frontend processes on port 3000"
    sleep 2  # Give processes time to fully terminate
fi

# Check if backend is already running
BACKEND_PID=""

if check_port_listening 8000; then
    print_warning "Port 8000 is already listening. Checking if backend is responding..."
    
    # Test if the existing backend is actually working
    if curl -s --max-time 5 "http://localhost:8000/" >/dev/null 2>&1; then
        print_success "Backend is already running and responding on port 8000"
        BACKEND_PID="existing"
    else
        print_warning "Port 8000 is listening but backend is not responding. You may need to stop the existing process."
        print_status "Attempting to start a new backend instance..."
        BACKEND_PID=""
    fi
else
    print_status "Port 8000 is not listening, will start new backend"
fi

# Check if frontend is already running
FRONTEND_PID=""
FRONTEND_PORT=""

# Check for existing frontend on ports 3000-3010
for port in {3000..3010}; do
    if check_port_listening $port; then
        # Test if this port has a responding frontend
        if curl -s --max-time 5 "http://localhost:$port" >/dev/null 2>&1; then
            print_success "Frontend is already running and responding on port $port"
            FRONTEND_PID="existing"
            FRONTEND_PORT=$port
            break
        fi
    fi
done

if [ -z "$FRONTEND_PORT" ]; then
    print_status "No existing frontend found, will start new frontend on port 3000"
fi

# Start Backend only if not already running
if [ "$BACKEND_PID" != "existing" ]; then
    print_status "Starting Backend (Python FastAPI)..."
    cd backend

    # Check if virtual environment exists
    if [ -d ".venv" ]; then
        print_status "Using existing .venv virtual environment"
    else
        print_status "No virtual environment found. Creating new one with uv..."
        uv venv
        print_success "Virtual environment created"
    fi

    # Install dependencies if needed
    print_status "Installing dependencies..."
    uv sync

    # Start backend using uv run
    print_status "Starting backend with uv run..."
    print_status "Note: Backend startup may take 1-2 minutes to initialize all services..."
    uv run python main.py &
    BACKEND_PID=$!
    cd ..
    
    print_status "Backend process started with PID: $BACKEND_PID"
    
    # Wait for the port to actually be listening
    if wait_for_port 8000; then
        print_success "Backend is now listening on port 8000"
        # Give the backend a moment to fully initialize
        sleep 2
    else
        print_error "Backend failed to start listening on port 8000"
        exit 1
    fi
else
    print_status "Using existing backend instance"
fi

# Test backend readiness
print_status "Testing backend endpoints..."
if wait_for_service "http://localhost:8000/" "Backend root"; then
    print_success "Backend root endpoint is responding"
    
    # Test API docs endpoint
    if wait_for_service "http://localhost:8000/docs" "Backend API docs"; then
        print_success "Backend API documentation is accessible"
    else
        print_warning "Backend is running but /docs endpoint may have issues"
    fi
else
    print_error "Backend failed to respond properly"
    exit 1
fi

# Start Frontend only if not already running
if [ "$FRONTEND_PID" != "existing" ]; then
    print_status "Starting Frontend (Next.js)..."
    
    # Check if node_modules exists
    if [ ! -d "node_modules" ]; then
        print_status "Installing frontend dependencies..."
        npm install
    fi
    
    # Start frontend
    print_status "Starting frontend with npm run dev..."
    npm run dev &
    FRONTEND_PID=$!
    FRONTEND_PORT=3000
    
    print_status "Frontend process started with PID: $FRONTEND_PID"
    
    # Wait for frontend to be ready
    print_status "Waiting for frontend to initialize..."
    print_status "Note: Frontend startup may take 30-60 seconds..."
    sleep 15  # Give frontend more time to start
    
    if wait_for_service "http://localhost:$FRONTEND_PORT" "Frontend"; then
        print_success "Frontend is now running on port $FRONTEND_PORT"
    else
        print_warning "Frontend may still be starting up, but backend is ready"
        print_status "You can check frontend status at http://localhost:$FRONTEND_PORT"
    fi
else
    print_status "Using existing frontend instance on port $FRONTEND_PORT"
fi

echo ""
echo "=========================================="
print_success "SlideFlip Application is now running!"
echo ""
if [ "$FRONTEND_PID" = "existing" ]; then
    echo "🌐 Frontend: http://localhost:$FRONTEND_PORT (pre-existing)"
else
    echo "🌐 Frontend: http://localhost:$FRONTEND_PORT (started by script)"
fi

if [ "$BACKEND_PID" = "existing" ]; then
    echo "🔧 Backend:  http://localhost:8000 (pre-existing)"
else
    echo "🔧 Backend:  http://localhost:8000 (started by script)"
fi

echo "📚 API Docs: http://localhost:8000/docs"
echo ""
echo "ℹ️  Monitoring: Script will monitor services every 30 seconds"
echo "ℹ️  Tolerance: Allows 3 consecutive failures before shutdown"
echo "ℹ️  Cleanup: ALL processes on ports 8000 and 3000 will be killed on exit"
echo "⚠️  Warning: This ensures clean startup but will stop ALL services on these ports"
echo ""
echo "Press Ctrl+C to stop monitoring and cleanup all port processes"
echo "=========================================="

# Keep script running and monitor services
consecutive_backend_failures=0
consecutive_frontend_failures=0
max_consecutive_failures=3  # Allow 3 consecutive failures before giving up

while true; do
    sleep 30  # Check less frequently to avoid spam
    
    # Check if backend is still running (only for processes we started)
    if [ "$BACKEND_PID" != "existing" ]; then
        if ! kill -0 $BACKEND_PID 2>/dev/null; then
            print_error "Backend process has stopped unexpectedly"
            break
        fi
    else
        # For existing backend, be more tolerant of temporary issues
        if ! curl -s --max-time 10 "http://localhost:8000/" >/dev/null 2>&1; then
            consecutive_backend_failures=$((consecutive_backend_failures + 1))
            if [ $consecutive_backend_failures -ge $max_consecutive_failures ]; then
                print_error "Backend has been unresponsive for $((max_consecutive_failures * 30)) seconds"
                break
            fi
            print_warning "Backend temporarily unresponsive (attempt $consecutive_backend_failures/$max_consecutive_failures)"
        else
            consecutive_backend_failures=0  # Reset counter on success
        fi
    fi
    
    # Check if frontend is still running (only for processes we started)
    if [ "$FRONTEND_PID" != "existing" ]; then
        if ! kill -0 $FRONTEND_PID 2>/dev/null; then
            print_error "Frontend process has stopped unexpectedly"
            break
        fi
    else
        # For existing frontend, be more tolerant of temporary issues
        if [ ! -z "$FRONTEND_PORT" ]; then
            if ! curl -s --max-time 10 "http://localhost:$FRONTEND_PORT" >/dev/null 2>&1; then
                consecutive_frontend_failures=$((consecutive_frontend_failures + 1))
                if [ $consecutive_frontend_failures -ge $max_consecutive_failures ]; then
                    print_error "Frontend has been unresponsive for $((max_consecutive_failures * 30)) seconds"
                    break
                fi
                print_warning "Frontend temporarily unresponsive (attempt $consecutive_frontend_failures/$max_consecutive_failures)"
            else
                consecutive_frontend_failures=0  # Reset counter on success
            fi
        fi
    fi
done

cleanup
