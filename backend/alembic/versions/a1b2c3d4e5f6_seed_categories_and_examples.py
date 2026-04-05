"""Seed categories and example FSMs

Revision ID: a1b2c3d4e5f6
Revises: 5c754bee004e
Create Date: 2026-03-27 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
import json
import math
from uuid import uuid4
from datetime import datetime, timezone

# revision identifiers, used by Alembic.
revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, None] = '5c754bee004e'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

# ----------------------------------------------------------------
# Fixed UUIDs for seed data (allows deterministic downgrade)
# ----------------------------------------------------------------

# Category UUIDs
CAT_DIGITAL_LOGIC = 'c0000001-0000-0000-0000-000000000001'
CAT_COMMUNICATION_PROTOCOLS = 'c0000001-0000-0000-0000-000000000002'
CAT_CONTROL_SYSTEMS = 'c0000001-0000-0000-0000-000000000003'
CAT_SEQUENCE_DETECTORS = 'c0000001-0000-0000-0000-000000000004'
CAT_GAME_LOGIC = 'c0000001-0000-0000-0000-000000000005'

# FSM UUIDs
FSM_ELEVATOR = 'f0000001-0000-0000-0000-000000000001'
FSM_SEQUENCE_DETECTOR = 'f0000001-0000-0000-0000-000000000002'
FSM_TRAFFIC_LIGHT = 'f0000001-0000-0000-0000-000000000003'
FSM_VENDING_MACHINE = 'f0000001-0000-0000-0000-000000000004'

# ----------------------------------------------------------------
# Example FSM definitions (inline JSON)
# ----------------------------------------------------------------

ELEVATOR_DEFINITION = {
    "name": "Elevator Controller",
    "description": "3-floor elevator with explicit moving states",
    "type": "moore",
    "states": ["Floor1", "Moving1to2", "Floor2", "Moving2to3", "Floor3", "Moving3to2", "Moving2to1"],
    "initial_state": "Floor1",
    "transitions": [
        {"from_state": "Floor1", "to_state": "Moving1to2", "input": "up"},
        {"from_state": "Moving1to2", "to_state": "Floor2"},
        {"from_state": "Floor2", "to_state": "Moving2to3", "input": "up"},
        {"from_state": "Floor2", "to_state": "Moving2to1", "input": "down"},
        {"from_state": "Moving2to3", "to_state": "Floor3"},
        {"from_state": "Floor3", "to_state": "Moving3to2", "input": "down"},
        {"from_state": "Moving3to2", "to_state": "Floor2"},
        {"from_state": "Moving2to1", "to_state": "Floor1"}
    ],
    "outputs": {
        "Floor1": "001",
        "Moving1to2": "010",
        "Floor2": "011",
        "Moving2to3": "100",
        "Floor3": "101",
        "Moving3to2": "110",
        "Moving2to1": "111"
    }
}

SEQUENCE_DETECTOR_DEFINITION = {
    "name": "Sequence Detector 101",
    "description": "Mealy machine that detects the sequence '101' in binary input",
    "type": "mealy",
    "states": ["S0", "S1", "S2", "S3"],
    "initial_state": "S0",
    "transitions": [
        {"from_state": "S0", "to_state": "S0", "input": "0", "output": "0"},
        {"from_state": "S0", "to_state": "S1", "input": "1", "output": "0"},
        {"from_state": "S1", "to_state": "S2", "input": "0", "output": "0"},
        {"from_state": "S1", "to_state": "S1", "input": "1", "output": "0"},
        {"from_state": "S2", "to_state": "S0", "input": "0", "output": "0"},
        {"from_state": "S2", "to_state": "S3", "input": "1", "output": "1"},
        {"from_state": "S3", "to_state": "S2", "input": "0", "output": "0"},
        {"from_state": "S3", "to_state": "S1", "input": "1", "output": "0"}
    ]
}

TRAFFIC_LIGHT_DEFINITION = {
    "name": "Traffic Light Controller",
    "description": "Simple 4-state traffic light with standard cycle",
    "type": "moore",
    "states": ["Red", "RedYellow", "Green", "Yellow"],
    "initial_state": "Red",
    "transitions": [
        {"from_state": "Red", "to_state": "RedYellow"},
        {"from_state": "RedYellow", "to_state": "Green"},
        {"from_state": "Green", "to_state": "Yellow"},
        {"from_state": "Yellow", "to_state": "Red"}
    ],
    "outputs": {
        "Red": "100",
        "RedYellow": "110",
        "Green": "001",
        "Yellow": "010"
    }
}

VENDING_MACHINE_DEFINITION = {
    "name": "Vending Machine",
    "description": "Accepts 5\u00a2 and 10\u00a2 coins, dispenses item at 15\u00a2",
    "type": "moore",
    "states": ["S0_0c", "S1_5c", "S2_10c", "S3_15c"],
    "initial_state": "S0_0c",
    "transitions": [
        {"from_state": "S0_0c", "to_state": "S1_5c", "input": "nickel"},
        {"from_state": "S0_0c", "to_state": "S2_10c", "input": "dime"},
        {"from_state": "S1_5c", "to_state": "S2_10c", "input": "nickel"},
        {"from_state": "S1_5c", "to_state": "S3_15c", "input": "dime"},
        {"from_state": "S2_10c", "to_state": "S3_15c", "input": "nickel"},
        {"from_state": "S3_15c", "to_state": "S0_0c", "input": "dispense"}
    ],
    "outputs": {
        "S0_0c": "00",
        "S1_5c": "00",
        "S2_10c": "00",
        "S3_15c": "01"
    }
}


def _calc_bit_width(state_count: int) -> int:
    """Calculate bit width from state count using ceil(log2(state_count)), minimum 1."""
    if state_count <= 1:
        return 1
    return math.ceil(math.log2(state_count))


def upgrade() -> None:
    # ----------------------------------------------------------
    # Insert categories
    # ----------------------------------------------------------
    categories_table = sa.table(
        'categories',
        sa.column('id', sa.UUID),
        sa.column('name', sa.String),
        sa.column('slug', sa.String),
        sa.column('description', sa.Text),
        sa.column('level', sa.Integer),
        sa.column('display_order', sa.Integer),
        sa.column('fsm_count', sa.Integer),
    )

    op.bulk_insert(categories_table, [
        {
            'id': CAT_DIGITAL_LOGIC,
            'name': 'Digital Logic',
            'slug': 'digital-logic',
            'description': 'Basic digital logic FSM designs',
            'level': 0,
            'display_order': 1,
            'fsm_count': 0,
        },
        {
            'id': CAT_COMMUNICATION_PROTOCOLS,
            'name': 'Communication Protocols',
            'slug': 'communication-protocols',
            'description': 'Protocol state machines (UART, SPI, I2C, etc.)',
            'level': 0,
            'display_order': 2,
            'fsm_count': 0,
        },
        {
            'id': CAT_CONTROL_SYSTEMS,
            'name': 'Control Systems',
            'slug': 'control-systems',
            'description': 'Real-world control system FSMs',
            'level': 0,
            'display_order': 3,
            'fsm_count': 0,
        },
        {
            'id': CAT_SEQUENCE_DETECTORS,
            'name': 'Sequence Detectors',
            'slug': 'sequence-detectors',
            'description': 'Pattern recognition and sequence detection FSMs',
            'level': 0,
            'display_order': 4,
            'fsm_count': 0,
        },
        {
            'id': CAT_GAME_LOGIC,
            'name': 'Game Logic',
            'slug': 'game-logic',
            'description': 'Game and entertainment state machines',
            'level': 0,
            'display_order': 5,
            'fsm_count': 0,
        },
    ])

    # ----------------------------------------------------------
    # Insert example FSMs
    # ----------------------------------------------------------
    fsms_table = sa.table(
        'fsms',
        sa.column('id', sa.UUID),
        sa.column('name', sa.String),
        sa.column('description', sa.Text),
        sa.column('fsm_type', sa.Enum('moore', 'mealy', name='fsm_type')),
        sa.column('definition', sa.JSON),
        sa.column('state_count', sa.Integer),
        sa.column('transition_count', sa.Integer),
        sa.column('initial_state', sa.String),
        sa.column('bit_width', sa.Integer),
        sa.column('encoding_type', sa.String),
        sa.column('category_id', sa.UUID),
        sa.column('tags', sa.ARRAY(sa.String)),
        sa.column('visibility', sa.Enum('private', 'public', 'unlisted', 'example', name='fsm_visibility')),
        sa.column('is_optimized', sa.Boolean),
        sa.column('dummy_state_count', sa.Integer),
        sa.column('view_count', sa.Integer),
        sa.column('fork_count', sa.Integer),
        sa.column('export_count', sa.Integer),
    )

    # Elevator: 7 states, 8 transitions, bit_width = ceil(log2(7)) = 3
    elevator_states = ELEVATOR_DEFINITION['states']
    elevator_transitions = ELEVATOR_DEFINITION['transitions']
    elevator_state_count = len(elevator_states)
    elevator_transition_count = len(elevator_transitions)
    elevator_bit_width = _calc_bit_width(elevator_state_count)

    # Sequence Detector: 4 states, 8 transitions, bit_width = ceil(log2(4)) = 2
    seq_states = SEQUENCE_DETECTOR_DEFINITION['states']
    seq_transitions = SEQUENCE_DETECTOR_DEFINITION['transitions']
    seq_state_count = len(seq_states)
    seq_transition_count = len(seq_transitions)
    seq_bit_width = _calc_bit_width(seq_state_count)

    # Traffic Light: 4 states, 4 transitions, bit_width = ceil(log2(4)) = 2
    tl_states = TRAFFIC_LIGHT_DEFINITION['states']
    tl_transitions = TRAFFIC_LIGHT_DEFINITION['transitions']
    tl_state_count = len(tl_states)
    tl_transition_count = len(tl_transitions)
    tl_bit_width = _calc_bit_width(tl_state_count)

    # Vending Machine: 4 states, 6 transitions, bit_width = ceil(log2(4)) = 2
    vm_states = VENDING_MACHINE_DEFINITION['states']
    vm_transitions = VENDING_MACHINE_DEFINITION['transitions']
    vm_state_count = len(vm_states)
    vm_transition_count = len(vm_transitions)
    vm_bit_width = _calc_bit_width(vm_state_count)

    op.bulk_insert(fsms_table, [
        {
            'id': FSM_ELEVATOR,
            'name': 'Elevator Controller',
            'description': '3-floor elevator with explicit moving states',
            'fsm_type': 'moore',
            'definition': json.dumps(ELEVATOR_DEFINITION),
            'state_count': elevator_state_count,
            'transition_count': elevator_transition_count,
            'initial_state': 'Floor1',
            'bit_width': elevator_bit_width,
            'encoding_type': 'binary',
            'category_id': CAT_CONTROL_SYSTEMS,
            'tags': ['elevator', 'controller', 'moore', 'control-systems'],
            'visibility': 'public',
            'is_optimized': False,
            'dummy_state_count': 0,
            'view_count': 0,
            'fork_count': 0,
            'export_count': 0,
        },
        {
            'id': FSM_SEQUENCE_DETECTOR,
            'name': 'Sequence Detector 101',
            'description': "Mealy machine that detects the sequence '101' in binary input",
            'fsm_type': 'mealy',
            'definition': json.dumps(SEQUENCE_DETECTOR_DEFINITION),
            'state_count': seq_state_count,
            'transition_count': seq_transition_count,
            'initial_state': 'S0',
            'bit_width': seq_bit_width,
            'encoding_type': 'binary',
            'category_id': CAT_SEQUENCE_DETECTORS,
            'tags': ['sequence', 'detector', 'mealy', 'digital-logic'],
            'visibility': 'public',
            'is_optimized': False,
            'dummy_state_count': 0,
            'view_count': 0,
            'fork_count': 0,
            'export_count': 0,
        },
        {
            'id': FSM_TRAFFIC_LIGHT,
            'name': 'Traffic Light Controller',
            'description': 'Simple 4-state traffic light with standard cycle',
            'fsm_type': 'moore',
            'definition': json.dumps(TRAFFIC_LIGHT_DEFINITION),
            'state_count': tl_state_count,
            'transition_count': tl_transition_count,
            'initial_state': 'Red',
            'bit_width': tl_bit_width,
            'encoding_type': 'binary',
            'category_id': CAT_CONTROL_SYSTEMS,
            'tags': ['traffic', 'controller', 'moore', 'safety-critical'],
            'visibility': 'public',
            'is_optimized': False,
            'dummy_state_count': 0,
            'view_count': 0,
            'fork_count': 0,
            'export_count': 0,
        },
        {
            'id': FSM_VENDING_MACHINE,
            'name': 'Vending Machine',
            'description': 'Accepts 5\u00a2 and 10\u00a2 coins, dispenses item at 15\u00a2',
            'fsm_type': 'moore',
            'definition': json.dumps(VENDING_MACHINE_DEFINITION),
            'state_count': vm_state_count,
            'transition_count': vm_transition_count,
            'initial_state': 'S0_0c',
            'bit_width': vm_bit_width,
            'encoding_type': 'binary',
            'category_id': CAT_DIGITAL_LOGIC,
            'tags': ['vending', 'machine', 'moore', 'digital-logic'],
            'visibility': 'public',
            'is_optimized': False,
            'dummy_state_count': 0,
            'view_count': 0,
            'fork_count': 0,
            'export_count': 0,
        },
    ])

    # ----------------------------------------------------------
    # Update category FSM counts
    # ----------------------------------------------------------
    op.execute(
        "UPDATE categories SET fsm_count = ("
        "  SELECT COUNT(*) FROM fsms WHERE fsms.category_id = categories.id"
        ")"
    )


def downgrade() -> None:
    # Delete seeded FSMs by known IDs
    op.execute(
        f"DELETE FROM fsms WHERE id IN ("
        f"  '{FSM_ELEVATOR}',"
        f"  '{FSM_SEQUENCE_DETECTOR}',"
        f"  '{FSM_TRAFFIC_LIGHT}',"
        f"  '{FSM_VENDING_MACHINE}'"
        f")"
    )

    # Delete seeded categories by known IDs
    op.execute(
        f"DELETE FROM categories WHERE id IN ("
        f"  '{CAT_DIGITAL_LOGIC}',"
        f"  '{CAT_COMMUNICATION_PROTOCOLS}',"
        f"  '{CAT_CONTROL_SYSTEMS}',"
        f"  '{CAT_SEQUENCE_DETECTORS}',"
        f"  '{CAT_GAME_LOGIC}'"
        f")"
    )
