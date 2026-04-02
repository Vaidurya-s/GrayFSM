-- ================================================================
-- GrayFSM Database - Seed Data
-- Initial data for categories and example FSMs
-- Kept in sync with Alembic migration a1b2c3d4e5f6
-- ================================================================

\echo 'Loading seed data...'

-- ----------------------------------------------------------------
-- CATEGORIES
-- Uses same UUIDs as Alembic migration for consistency
-- ----------------------------------------------------------------

INSERT INTO categories (id, name, slug, description, level, display_order, fsm_count) VALUES
('c0000001-0000-0000-0000-000000000001', 'Digital Logic', 'digital-logic',
 'Basic digital logic FSM designs', 0, 1, 0),
('c0000001-0000-0000-0000-000000000002', 'Communication Protocols', 'communication-protocols',
 'Protocol state machines (UART, SPI, I2C, etc.)', 0, 2, 0),
('c0000001-0000-0000-0000-000000000003', 'Control Systems', 'control-systems',
 'Real-world control system FSMs', 0, 3, 0),
('c0000001-0000-0000-0000-000000000004', 'Sequence Detectors', 'sequence-detectors',
 'Pattern recognition and sequence detection FSMs', 0, 4, 0),
('c0000001-0000-0000-0000-000000000005', 'Game Logic', 'game-logic',
 'Game and entertainment state machines', 0, 5, 0)
ON CONFLICT (id) DO NOTHING;

\echo 'Categories loaded: 5 categories'

-- ----------------------------------------------------------------
-- EXAMPLE FSM 1: Elevator Controller
-- Category: Control Systems | 7 states, 8 transitions, bit_width=3
-- ----------------------------------------------------------------

INSERT INTO fsms (
    id, name, description, fsm_type, definition,
    state_count, transition_count, initial_state, bit_width,
    encoding_type, category_id, tags, visibility,
    is_optimized, dummy_state_count, view_count, fork_count, export_count
) VALUES (
    'f0000001-0000-0000-0000-000000000001',
    'Elevator Controller',
    '3-floor elevator with explicit moving states',
    'moore',
    '{
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
    }'::jsonb,
    7, 8, 'Floor1', 3,
    'binary',
    'c0000001-0000-0000-0000-000000000003',
    ARRAY['elevator', 'controller', 'moore', 'control-systems'],
    'public',
    FALSE, 0, 0, 0, 0
)
ON CONFLICT (id) DO NOTHING;

\echo 'Example FSM 1 loaded: Elevator Controller'

-- ----------------------------------------------------------------
-- EXAMPLE FSM 2: Sequence Detector 101
-- Category: Sequence Detectors | 4 states, 8 transitions, bit_width=2
-- ----------------------------------------------------------------

INSERT INTO fsms (
    id, name, description, fsm_type, definition,
    state_count, transition_count, initial_state, bit_width,
    encoding_type, category_id, tags, visibility,
    is_optimized, dummy_state_count, view_count, fork_count, export_count
) VALUES (
    'f0000001-0000-0000-0000-000000000002',
    'Sequence Detector 101',
    'Mealy machine that detects the sequence ''101'' in binary input',
    'mealy',
    '{
        "name": "Sequence Detector 101",
        "description": "Mealy machine that detects the sequence ''101'' in binary input",
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
    }'::jsonb,
    4, 8, 'S0', 2,
    'binary',
    'c0000001-0000-0000-0000-000000000004',
    ARRAY['sequence', 'detector', 'mealy', 'digital-logic'],
    'public',
    FALSE, 0, 0, 0, 0
)
ON CONFLICT (id) DO NOTHING;

\echo 'Example FSM 2 loaded: Sequence Detector 101'

-- ----------------------------------------------------------------
-- EXAMPLE FSM 3: Traffic Light Controller
-- Category: Control Systems | 4 states, 4 transitions, bit_width=2
-- ----------------------------------------------------------------

INSERT INTO fsms (
    id, name, description, fsm_type, definition,
    state_count, transition_count, initial_state, bit_width,
    encoding_type, category_id, tags, visibility,
    is_optimized, dummy_state_count, view_count, fork_count, export_count
) VALUES (
    'f0000001-0000-0000-0000-000000000003',
    'Traffic Light Controller',
    'Simple 4-state traffic light with standard cycle',
    'moore',
    '{
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
    }'::jsonb,
    4, 4, 'Red', 2,
    'binary',
    'c0000001-0000-0000-0000-000000000003',
    ARRAY['traffic', 'controller', 'moore', 'safety-critical'],
    'public',
    FALSE, 0, 0, 0, 0
)
ON CONFLICT (id) DO NOTHING;

\echo 'Example FSM 3 loaded: Traffic Light Controller'

-- ----------------------------------------------------------------
-- EXAMPLE FSM 4: Vending Machine
-- Category: Digital Logic | 4 states, 6 transitions, bit_width=2
-- ----------------------------------------------------------------

INSERT INTO fsms (
    id, name, description, fsm_type, definition,
    state_count, transition_count, initial_state, bit_width,
    encoding_type, category_id, tags, visibility,
    is_optimized, dummy_state_count, view_count, fork_count, export_count
) VALUES (
    'f0000001-0000-0000-0000-000000000004',
    'Vending Machine',
    'Accepts 5 cent and 10 cent coins, dispenses item at 15 cents',
    'moore',
    '{
        "name": "Vending Machine",
        "description": "Accepts 5 cent and 10 cent coins, dispenses item at 15 cents",
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
    }'::jsonb,
    4, 6, 'S0_0c', 2,
    'binary',
    'c0000001-0000-0000-0000-000000000001',
    ARRAY['vending', 'machine', 'moore', 'digital-logic'],
    'public',
    FALSE, 0, 0, 0, 0
)
ON CONFLICT (id) DO NOTHING;

\echo 'Example FSM 4 loaded: Vending Machine'

-- ----------------------------------------------------------------
-- Update category FSM counts
-- ----------------------------------------------------------------

UPDATE categories c
SET fsm_count = (
    SELECT COUNT(*)
    FROM fsms f
    WHERE f.category_id = c.id
);

\echo 'Category counts updated'

-- ----------------------------------------------------------------
-- Statistics
-- ----------------------------------------------------------------

\echo ''
\echo '================================================================'
\echo 'Seed Data Summary'
\echo '================================================================'

SELECT
    'Categories' as entity,
    COUNT(*)::text as count
FROM categories
UNION ALL
SELECT
    'Example FSMs' as entity,
    COUNT(*)::text as count
FROM fsms
WHERE visibility = 'public';

\echo '================================================================'
\echo 'Seed data loaded successfully!'
\echo '================================================================'
