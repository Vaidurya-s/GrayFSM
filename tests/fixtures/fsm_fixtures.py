"""
FSM Test Fixtures

Comprehensive collection of FSM test data for various testing scenarios.
"""

from typing import Dict, List
import json
import os


class FSMFixtures:
    """Collection of predefined FSM fixtures for testing."""

    @staticmethod
    def traffic_light_moore() -> Dict:
        """Classic traffic light controller (Moore machine)."""
        return {
            "name": "Traffic Light Controller",
            "description": "Standard traffic light with 4 states",
            "fsm_type": "moore",
            "states": ["Red", "Yellow", "Green", "RedYellow"],
            "initial_state": "Red",
            "transitions": [
                {"from_state": "Red", "to_state": "RedYellow", "input": "timer"},
                {"from_state": "RedYellow", "to_state": "Green", "input": "timer"},
                {"from_state": "Green", "to_state": "Yellow", "input": "timer"},
                {"from_state": "Yellow", "to_state": "Red", "input": "timer"}
            ],
            "outputs": {
                "Red": "100",
                "RedYellow": "110",
                "Green": "001",
                "Yellow": "010"
            },
            "visibility": "public",
            "tags": ["example", "traffic", "control", "moore"]
        }

    @staticmethod
    def sequence_detector_mealy() -> Dict:
        """Sequence detector for pattern 1011 (Mealy machine)."""
        return {
            "name": "Sequence Detector 1011",
            "description": "Detects binary sequence 1011",
            "fsm_type": "mealy",
            "states": ["S0", "S1", "S2", "S3", "S4"],
            "initial_state": "S0",
            "transitions": [
                {"from_state": "S0", "to_state": "S1", "input": "1", "output": "0"},
                {"from_state": "S0", "to_state": "S0", "input": "0", "output": "0"},
                {"from_state": "S1", "to_state": "S2", "input": "0", "output": "0"},
                {"from_state": "S1", "to_state": "S1", "input": "1", "output": "0"},
                {"from_state": "S2", "to_state": "S3", "input": "1", "output": "0"},
                {"from_state": "S2", "to_state": "S0", "input": "0", "output": "0"},
                {"from_state": "S3", "to_state": "S4", "input": "1", "output": "1"},
                {"from_state": "S3", "to_state": "S2", "input": "0", "output": "0"},
                {"from_state": "S4", "to_state": "S1", "input": "1", "output": "0"},
                {"from_state": "S4", "to_state": "S2", "input": "0", "output": "0"}
            ],
            "visibility": "public",
            "tags": ["example", "detector", "mealy", "sequence"]
        }

    @staticmethod
    def vending_machine_moore() -> Dict:
        """Vending machine controller (Moore machine)."""
        return {
            "name": "Vending Machine",
            "description": "Simple vending machine accepting coins",
            "fsm_type": "moore",
            "states": ["Idle", "Coin5", "Coin10", "Dispense"],
            "initial_state": "Idle",
            "transitions": [
                {"from_state": "Idle", "to_state": "Coin5", "input": "5cent"},
                {"from_state": "Idle", "to_state": "Coin10", "input": "10cent"},
                {"from_state": "Coin5", "to_state": "Coin10", "input": "5cent"},
                {"from_state": "Coin5", "to_state": "Dispense", "input": "10cent"},
                {"from_state": "Coin10", "to_state": "Dispense", "input": "5cent"},
                {"from_state": "Coin10", "to_state": "Dispense", "input": "10cent"},
                {"from_state": "Dispense", "to_state": "Idle", "input": "reset"}
            ],
            "outputs": {
                "Idle": "00",
                "Coin5": "01",
                "Coin10": "10",
                "Dispense": "11"
            },
            "visibility": "public",
            "tags": ["example", "vending", "moore"]
        }

    @staticmethod
    def elevator_controller() -> Dict:
        """Elevator controller FSM."""
        return {
            "name": "Elevator Controller",
            "description": "3-floor elevator system",
            "fsm_type": "moore",
            "states": ["Floor1", "Floor2", "Floor3", "Moving12", "Moving23", "Moving21", "Moving32"],
            "initial_state": "Floor1",
            "transitions": [
                {"from_state": "Floor1", "to_state": "Moving12", "input": "up"},
                {"from_state": "Moving12", "to_state": "Floor2", "input": "arrived"},
                {"from_state": "Floor2", "to_state": "Moving23", "input": "up"},
                {"from_state": "Floor2", "to_state": "Moving21", "input": "down"},
                {"from_state": "Moving23", "to_state": "Floor3", "input": "arrived"},
                {"from_state": "Moving21", "to_state": "Floor1", "input": "arrived"},
                {"from_state": "Floor3", "to_state": "Moving32", "input": "down"},
                {"from_state": "Moving32", "to_state": "Floor2", "input": "arrived"}
            ],
            "outputs": {
                "Floor1": "001",
                "Floor2": "010",
                "Floor3": "100",
                "Moving12": "011",
                "Moving23": "110",
                "Moving21": "011",
                "Moving32": "110"
            },
            "visibility": "public",
            "tags": ["example", "elevator", "control"]
        }

    @staticmethod
    def uart_receiver() -> Dict:
        """UART receiver state machine."""
        return {
            "name": "UART Receiver",
            "description": "Serial communication receiver",
            "fsm_type": "moore",
            "states": ["Idle", "Start", "Data0", "Data1", "Data2", "Data3",
                      "Data4", "Data5", "Data6", "Data7", "Stop"],
            "initial_state": "Idle",
            "transitions": [
                {"from_state": "Idle", "to_state": "Start", "input": "rx_low"},
                {"from_state": "Start", "to_state": "Data0", "input": "clk"},
                {"from_state": "Data0", "to_state": "Data1", "input": "clk"},
                {"from_state": "Data1", "to_state": "Data2", "input": "clk"},
                {"from_state": "Data2", "to_state": "Data3", "input": "clk"},
                {"from_state": "Data3", "to_state": "Data4", "input": "clk"},
                {"from_state": "Data4", "to_state": "Data5", "input": "clk"},
                {"from_state": "Data5", "to_state": "Data6", "input": "clk"},
                {"from_state": "Data6", "to_state": "Data7", "input": "clk"},
                {"from_state": "Data7", "to_state": "Stop", "input": "clk"},
                {"from_state": "Stop", "to_state": "Idle", "input": "clk"}
            ],
            "outputs": {
                "Idle": "0000",
                "Start": "0001",
                "Data0": "0010",
                "Data1": "0011",
                "Data2": "0100",
                "Data3": "0101",
                "Data4": "0110",
                "Data5": "0111",
                "Data6": "1000",
                "Data7": "1001",
                "Stop": "1010"
            },
            "visibility": "public",
            "tags": ["example", "uart", "communication"]
        }

    @staticmethod
    def minimal_fsm() -> Dict:
        """Minimal FSM with 2 states."""
        return {
            "name": "Minimal FSM",
            "description": "Simplest possible FSM",
            "fsm_type": "moore",
            "states": ["S0", "S1"],
            "initial_state": "S0",
            "transitions": [
                {"from_state": "S0", "to_state": "S1", "input": "toggle"},
                {"from_state": "S1", "to_state": "S0", "input": "toggle"}
            ],
            "outputs": {
                "S0": "0",
                "S1": "1"
            },
            "visibility": "private",
            "tags": ["test", "minimal"]
        }

    @staticmethod
    def large_fsm(num_states: int = 16) -> Dict:
        """Generate a large FSM for performance testing."""
        states = [f"S{i}" for i in range(num_states)]
        transitions = []

        for i in range(num_states):
            # Each state connects to next, skip 2, and skip 4
            transitions.append({
                "from_state": f"S{i}",
                "to_state": f"S{(i + 1) % num_states}",
                "input": "next"
            })
            transitions.append({
                "from_state": f"S{i}",
                "to_state": f"S{(i + 2) % num_states}",
                "input": "skip2"
            })
            transitions.append({
                "from_state": f"S{i}",
                "to_state": f"S{(i + 4) % num_states}",
                "input": "skip4"
            })

        bit_width = (num_states - 1).bit_length()
        outputs = {f"S{i}": format(i, f'0{bit_width}b') for i in range(num_states)}

        return {
            "name": f"Large FSM {num_states} States",
            "description": f"Performance test FSM with {num_states} states",
            "fsm_type": "moore",
            "states": states,
            "initial_state": "S0",
            "transitions": transitions,
            "outputs": outputs,
            "visibility": "private",
            "tags": ["test", "performance", "large"]
        }

    @staticmethod
    def fully_connected_fsm(num_states: int = 6) -> Dict:
        """Generate fully connected FSM (worst case for optimization)."""
        states = [f"S{i}" for i in range(num_states)]
        transitions = []

        for i in range(num_states):
            for j in range(num_states):
                if i != j:
                    transitions.append({
                        "from_state": f"S{i}",
                        "to_state": f"S{j}",
                        "input": f"to_S{j}"
                    })

        bit_width = (num_states - 1).bit_length()
        outputs = {f"S{i}": format(i, f'0{bit_width}b') for i in range(num_states)}

        return {
            "name": f"Fully Connected FSM {num_states} States",
            "description": "Every state connects to every other state",
            "fsm_type": "moore",
            "states": states,
            "initial_state": "S0",
            "transitions": transitions,
            "outputs": outputs,
            "visibility": "private",
            "tags": ["test", "worst-case", "fully-connected"]
        }

    @staticmethod
    def linear_chain_fsm(num_states: int = 8) -> Dict:
        """Generate linear chain FSM (best case for optimization)."""
        states = [f"S{i}" for i in range(num_states)]
        transitions = []

        for i in range(num_states - 1):
            transitions.append({
                "from_state": f"S{i}",
                "to_state": f"S{i + 1}",
                "input": "next"
            })

        # Loop back to start
        transitions.append({
            "from_state": f"S{num_states - 1}",
            "to_state": "S0",
            "input": "reset"
        })

        bit_width = (num_states - 1).bit_length()
        outputs = {f"S{i}": format(i, f'0{bit_width}b') for i in range(num_states)}

        return {
            "name": f"Linear Chain FSM {num_states} States",
            "description": "States in a linear sequence",
            "fsm_type": "moore",
            "states": states,
            "initial_state": "S0",
            "transitions": transitions,
            "outputs": outputs,
            "visibility": "private",
            "tags": ["test", "best-case", "linear"]
        }

    @classmethod
    def get_all_examples(cls) -> List[Dict]:
        """Get all example FSMs."""
        return [
            cls.traffic_light_moore(),
            cls.sequence_detector_mealy(),
            cls.vending_machine_moore(),
            cls.elevator_controller(),
            cls.uart_receiver()
        ]

    @classmethod
    def get_test_fixtures(cls) -> List[Dict]:
        """Get all test fixtures."""
        return [
            cls.minimal_fsm(),
            cls.large_fsm(16),
            cls.fully_connected_fsm(6),
            cls.linear_chain_fsm(8)
        ]

    @classmethod
    def save_fixtures_to_files(cls, output_dir: str = "./fixtures"):
        """Save all fixtures to JSON files."""
        os.makedirs(output_dir, exist_ok=True)

        examples = cls.get_all_examples()
        for fsm in examples:
            filename = f"{fsm['name'].lower().replace(' ', '_')}.json"
            filepath = os.path.join(output_dir, filename)
            with open(filepath, 'w') as f:
                json.dump(fsm, f, indent=2)

        test_fixtures = cls.get_test_fixtures()
        for fsm in test_fixtures:
            filename = f"{fsm['name'].lower().replace(' ', '_')}.json"
            filepath = os.path.join(output_dir, filename)
            with open(filepath, 'w') as f:
                json.dump(fsm, f, indent=2)


if __name__ == "__main__":
    # Generate and save all fixtures
    FSMFixtures.save_fixtures_to_files()
    print("FSM fixtures generated successfully!")
