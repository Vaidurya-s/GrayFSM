# GrayFSM CLI Tool - Usage Guide

## ✅ CORRECT Syntax

The CLI uses **subcommands** with **positional arguments**, not flags like `--input`.

### Optimize FSM

```bash
# Basic syntax
grayfsm optimize <input_file> -a <algorithm> -o <output_file>

# Example
grayfsm optimize examples/traffic_light.json -a greedy -o result.json
```

### List Available Algorithms

```bash
grayfsm list-algorithms
```

---

## 📋 Command Reference

### `grayfsm optimize`

Optimize an FSM using Gray code encoding.

**Syntax**:
```bash
grayfsm optimize INPUT_FILE [-a ALGORITHM] [-o OUTPUT_FILE]
```

**Arguments**:
- `INPUT_FILE` - Path to input FSM JSON file (required, positional)
- `-a, --algorithm` - Algorithm to use (default: greedy)
- `-o, --output` - Output file for results (optional)

**Examples**:
```bash
# Use default algorithm (greedy)
grayfsm optimize examples/traffic_light.json

# Specify algorithm
grayfsm optimize examples/traffic_light.json -a greedy

# Save results to file
grayfsm optimize examples/traffic_light.json -a greedy -o optimized.json

# Full path
grayfsm optimize /home/arunupscee/Music/grayFSM/backend/examples/traffic_light.json -o /tmp/result.json
```

### `grayfsm list-algorithms`

List all available optimization algorithms.

**Syntax**:
```bash
grayfsm list-algorithms
```

**Example**:
```bash
grayfsm list-algorithms
```

**Output**:
```
Available Algorithms:
--------------------------------------------------
  greedy               Greedy optimization with dummy state insertion
  bfs_optimal          BFS-based optimal path finding
```

---

## ❌ Common Mistakes

### Mistake 1: Using `--input` flag

**Wrong**:
```bash
grayfsm optimize --input examples/traffic_light.json --algorithm greedy
```

**Right**:
```bash
grayfsm optimize examples/traffic_light.json -a greedy
```

### Mistake 2: No subcommand

**Wrong**:
```bash
grayfsm examples/traffic_light.json -a greedy
```

**Right**:
```bash
grayfsm optimize examples/traffic_light.json -a greedy
```

### Mistake 3: Wrong order

**Wrong**:
```bash
grayfsm -a greedy optimize examples/traffic_light.json
```

**Right**:
```bash
grayfsm optimize examples/traffic_light.json -a greedy
```

---

## 🎯 Quick Test

Test the CLI tool with the traffic light example:

```bash
cd /home/arunupscee/Music/grayFSM/backend
source venv/bin/activate

# Run optimization
grayfsm optimize examples/traffic_light.json -a greedy -o test_output.json

# View results
cat test_output.json | python3 -m json.tool
```

**Expected Output**:
```
Loading FSM from: examples/traffic_light.json
Loaded: FSM(name='Traffic Light', type=moore, states=3, transitions=3)
Running optimization with: greedy

======================================================================
OPTIMIZATION RESULT
======================================================================
Algorithm:            greedy
Execution time:       X.XX ms
Original states:      3
Final states:         X
Dummy states added:   X
Compression ratio:    X.XX%
Total transitions:    X
...
======================================================================

Result saved to: test_output.json
```

---

## 📁 Example FSM Files

Located in: `/home/arunupscee/Music/grayFSM/backend/examples/`

| File | Description | States | Type |
|------|-------------|--------|------|
| `traffic_light.json` | Simple traffic light controller | 3 | Moore |
| `vending_machine.json` | Coin-operated vending machine | ~5 | Moore |
| `sequence_detector.json` | Pattern detection FSM | ~4 | Mealy |
| `elevator.json` | Multi-floor elevator controller | ~6 | Moore |

**Test all examples**:
```bash
cd /home/arunupscee/Music/grayFSM/backend
source venv/bin/activate

for file in examples/*.json; do
    echo "Testing: $file"
    grayfsm optimize "$file" -a greedy
    echo ""
done
```

---

## 🔍 Understanding the Output

### Console Output

The CLI prints detailed optimization results:

```
======================================================================
OPTIMIZATION RESULT
======================================================================
Algorithm:            greedy
Execution time:       2.45 ms          # How long optimization took
Original states:      3                # Input FSM state count
Final states:         5                # After adding dummy states
Dummy states added:   2                # Number of dummy states inserted
Compression ratio:    60.00%           # Efficiency metric
Total transitions:    3                # Number of transitions

Dummy States Inserted:
  - D_S0_S2: encoding=10, output=00, for=S0→S2    # Details of each dummy state

State Encodings:
  - Red: 00          # Gray code assigned to each state
  - Yellow: 01
  - Green: 11
======================================================================
```

### JSON Output File

When using `-o`, the result is saved as JSON:

```json
{
  "algorithm": "greedy",
  "execution_time_ms": 2.45,
  "original_state_count": 3,
  "final_state_count": 5,
  "dummy_state_count": 2,
  "states": ["Red", "Yellow", "Green", "D_Red_Green", "D_Yellow_Red"],
  "transitions": [...],
  "encoding": {
    "Red": "00",
    "Yellow": "01",
    "Green": "11"
  },
  "dummy_states": [...],
  "metrics": {...},
  "original_fsm": {...}
}
```

---

## 🛠️ Troubleshooting

### Error: "No module named 'grayfsm'"

**Problem**: Package not installed

**Solution**:
```bash
cd /home/arunupscee/Music/grayFSM/backend
source venv/bin/activate
pip install -e .
```

### Error: "File not found"

**Problem**: Wrong path to input file

**Solution**: Use full path or navigate to backend directory
```bash
cd /home/arunupscee/Music/grayFSM/backend
grayfsm optimize examples/traffic_light.json
```

### Error: "unrecognized arguments: --input"

**Problem**: Using old syntax with flags

**Solution**: Use positional argument
```bash
# Wrong
grayfsm optimize --input file.json

# Right
grayfsm optimize file.json
```

### Error: "Algorithm 'xyz' not found"

**Problem**: Invalid algorithm name

**Solution**: List available algorithms
```bash
grayfsm list-algorithms
```

---

## 📊 Input FSM JSON Format

Your input file should follow this structure:

```json
{
  "name": "My FSM",
  "type": "moore",
  "states": [
    {
      "name": "S0",
      "output": "00"
    },
    {
      "name": "S1",
      "output": "01"
    }
  ],
  "transitions": [
    {
      "from": "S0",
      "to": "S1",
      "input": "a"
    }
  ],
  "initial_state": "S0"
}
```

**Required Fields**:
- `name` - FSM name (string)
- `type` - "moore" or "mealy"
- `states` - Array of state objects
- `transitions` - Array of transition objects
- `initial_state` - Name of initial state

---

## 🎓 Available Algorithms

### Greedy Algorithm (`greedy`)

**Description**: Fast, locally optimized algorithm that processes each transition independently and inserts dummy states along the shortest hypercube path.

**Complexity**: O(T × log N) where T = transitions, N = states

**Best For**: Quick optimization, most FSMs

**Usage**:
```bash
grayfsm optimize input.json -a greedy
```

### BFS Optimal (`bfs_optimal`)

**Description**: Uses breadth-first search to find optimal paths with encoding reuse.

**Complexity**: Higher than greedy

**Best For**: When you need guaranteed optimal results

**Usage**:
```bash
grayfsm optimize input.json -a bfs_optimal
```

---

## 💡 Tips

1. **Always use full paths** if you're not in the backend directory
2. **Test with small examples first** (traffic_light.json)
3. **Save results** with `-o` for later analysis
4. **Compare algorithms** by running multiple times with different `-a` values
5. **Use `list-algorithms`** to see what's available

---

## 📞 Getting Help

```bash
# General help
grayfsm --help

# Optimize command help
grayfsm optimize --help

# List algorithms help
grayfsm list-algorithms --help
```

---

## 🎯 Quick Reference

```bash
# List algorithms
grayfsm list-algorithms

# Optimize with default algorithm
grayfsm optimize examples/traffic_light.json

# Optimize with specific algorithm
grayfsm optimize examples/traffic_light.json -a greedy

# Save results
grayfsm optimize examples/traffic_light.json -a greedy -o result.json

# Full example
cd /home/arunupscee/Music/grayFSM/backend
source venv/bin/activate
grayfsm optimize examples/traffic_light.json -a greedy -o /tmp/result.json
cat /tmp/result.json | python3 -m json.tool
```

---

**Remember**: The first argument after `optimize` is ALWAYS the input file path (no `--input` flag needed)!

Good luck! 🚀
