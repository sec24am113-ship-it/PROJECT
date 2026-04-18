#!/bin/bash

# SafeEscape Quick Start Script for macOS/Linux

echo ""
echo "============================================"
echo "  SafeEscape - Fire & Evacuation Simulator"
echo "============================================"
echo ""

cd "$(dirname "$0")"

echo "[1/2] Installing Backend Dependencies..."
cd backend

# Create virtual environment if it doesn't exist
if [ ! -d "venv" ]; then
    echo "Creating virtual environment..."
    python3 -m venv venv
fi

# Activate virtual environment and install dependencies
. venv/bin/activate
pip install --upgrade pip setuptools wheel
pip install -r requirements.txt
if [ $? -ne 0 ]; then
    echo "ERROR: Backend installation failed"
    exit 1
fi
deactivate

echo "[2/2] Installing Frontend Dependencies..."
cd ../frontend
npm install
if [ $? -ne 0 ]; then
    echo "ERROR: Frontend installation failed"
    exit 1
fi

echo ""
echo "============================================"
echo "  Installation Complete!"
echo "============================================"
echo ""
echo "Next steps:"
echo ""
echo "Terminal 1 - Run Backend:"
echo "  cd backend"
echo "  . venv/bin/activate"
echo "  uvicorn main:app --reload --port 8000"
echo ""
echo "Terminal 2 - Run Frontend:"
echo "  cd frontend"
echo "  npm run dev"
echo ""
echo "Then open http://localhost:5173 in your browser"
echo ""
