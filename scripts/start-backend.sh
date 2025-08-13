#!/usr/bin/env bash
set -euo pipefail

# Start SlideFlip backend from repo root
# - Creates a venv if missing
# - Installs/updates dependencies
# - Runs the FastAPI server

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKEND_DIR="$ROOT_DIR/backend"

cd "$BACKEND_DIR"

# Create venv if it doesn't exist
if [ ! -d "venv" ]; then
  echo "[backend] Creating virtual environment..."
  python3 -m venv venv
fi

# shellcheck disable=SC1091
source venv/bin/activate

echo "[backend] Ensuring dependencies are installed..."
python3 -m pip install -r requirements.txt >/dev/null 2>&1 || python3 -m pip install -r requirements.txt

echo "[backend] Starting server (http://0.0.0.0:8000)..."
exec python main.py


