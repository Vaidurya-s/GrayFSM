#!/bin/bash

# Quick test script to verify everything works

set -e  # Exit on error

echo "=========================================="
echo "GrayFSM - Quick Test Script"
echo "=========================================="
echo ""

# Test 1: Backend CLI
echo "TEST 1: Backend CLI Tool"
echo "----------------------------------------"
cd /home/arunupscee/Music/grayFSM/backend
source venv/bin/activate

echo "Testing: grayfsm optimize examples/traffic_light.json -a greedy -o /tmp/test_result.json"
grayfsm optimize examples/traffic_light.json -a greedy -o /tmp/test_result.json

if [ -f /tmp/test_result.json ]; then
    echo ""
    echo "✅ CLI tool works! Result saved to /tmp/test_result.json"
    echo ""
    echo "Sample output (first 30 lines):"
    head -30 /tmp/test_result.json
    echo "..."
else
    echo "❌ CLI test failed!"
    exit 1
fi

echo ""
echo "=========================================="
echo "TEST 2: Frontend Dev Server"
echo "=========================================="
echo ""
echo "Starting frontend dev server..."
echo "Visit: http://localhost:5173"
echo ""
echo "Press Ctrl+C to stop"
echo ""

cd /home/arunupscee/Music/grayFSM/frontend
npm run dev
