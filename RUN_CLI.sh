#!/bin/bash

# Quick script to test the CLI tool with all examples

cd /home/arunupscee/Music/grayFSM/backend
source venv/bin/activate

echo "=========================================="
echo "GrayFSM CLI Tool - Testing All Examples"
echo "=========================================="
echo ""

# Test 1: Traffic Light
echo "1. Testing Traffic Light FSM..."
echo "----------------------------------------"
grayfsm optimize examples/traffic_light.json -a greedy -o /tmp/traffic_light_result.json
echo ""
echo "✅ Result saved to: /tmp/traffic_light_result.json"
echo ""

# Test 2: Vending Machine
echo "2. Testing Vending Machine FSM..."
echo "----------------------------------------"
grayfsm optimize examples/vending_machine.json -a greedy -o /tmp/vending_machine_result.json
echo ""
echo "✅ Result saved to: /tmp/vending_machine_result.json"
echo ""

# Test 3: Sequence Detector
echo "3. Testing Sequence Detector FSM..."
echo "----------------------------------------"
grayfsm optimize examples/sequence_detector.json -a greedy -o /tmp/sequence_detector_result.json
echo ""
echo "✅ Result saved to: /tmp/sequence_detector_result.json"
echo ""

# Test 4: Elevator
echo "4. Testing Elevator FSM..."
echo "----------------------------------------"
grayfsm optimize examples/elevator.json -a greedy -o /tmp/elevator_result.json
echo ""
echo "✅ Result saved to: /tmp/elevator_result.json"
echo ""

echo "=========================================="
echo "All Tests Complete!"
echo "=========================================="
echo ""
echo "View results:"
echo "  cat /tmp/traffic_light_result.json | python3 -m json.tool"
echo "  cat /tmp/vending_machine_result.json | python3 -m json.tool"
echo "  cat /tmp/sequence_detector_result.json | python3 -m json.tool"
echo "  cat /tmp/elevator_result.json | python3 -m json.tool"
echo ""
