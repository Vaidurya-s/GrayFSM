-- ================================================================
-- GrayFSM Database - Seed Data
-- Initial data for categories and example FSMs
-- ================================================================

\echo 'Loading seed data...'

-- ----------------------------------------------------------------
-- CATEGORIES
-- ----------------------------------------------------------------

INSERT INTO categories (id, name, slug, description, level, display_order, color) VALUES
('550e8400-e29b-41d4-a716-446655440001', 'Controllers', 'controllers',
 'Control logic FSMs for digital systems', 0, 1, '#3B82F6'),
('550e8400-e29b-41d4-a716-446655440002', 'Processors', 'processors',
 'CPU and microcontroller state machines', 0, 2, '#8B5CF6'),
('550e8400-e29b-41d4-a716-446655440003', 'Protocols', 'protocols',
 'Communication protocol implementations', 0, 3, '#10B981'),
('550e8400-e29b-41d4-a716-446655440004', 'Academic', 'academic',
 'Educational and textbook examples', 0, 4, '#F59E0B'),
('550e8400-e29b-41d4-a716-446655440005', 'Safety-Critical', 'safety-critical',
 'Safety-critical system FSMs', 0, 5, '#EF4444')
ON CONFLICT (id) DO NOTHING;

-- Update category paths
UPDATE categories SET full_path = name WHERE parent_category_id IS NULL;

\echo 'Categories loaded: 5 categories'

-- ----------------------------------------------------------------
-- SYSTEM USER
-- ----------------------------------------------------------------

INSERT INTO users (
    id, username, email, password_hash, display_name, role, email_verified, status
) VALUES (
    '00000000-0000-0000-0000-000000000000',
    'system',
    'system@grayfsm.com',
    '$2b$12$dummy.hash.for.system.user.only.not.used.for.login',
    'GrayFSM System',
    'admin',
    TRUE,
    'active'
)
ON CONFLICT (id) DO NOTHING;

\echo 'System user created'

-- ----------------------------------------------------------------
-- EXAMPLE FSM 1: Traffic Light Controller
-- ----------------------------------------------------------------

INSERT INTO fsms (
    id,
    name,
    description,
    fsm_type,
    definition,
    state_count,
    transition_count,
    initial_state,
    bit_width,
    encoding_type,
    category_id,
    visibility,
    is_optimized,
    tags,
    created_by
) VALUES (
    '550e8400-e29b-41d4-a716-446655440100',
    'Traffic Light Controller',
    'Simple 4-state traffic light FSM with timer-based transitions. Uses Gray code encoding to minimize glitches.',
    'moore',
    '{
        "type": "moore",
        "states": [
            {
                "id": "S0",
                "label": "Red",
                "output": "100",
                "encoding": "00",
                "position": {"x": 100, "y": 100},
                "isDummy": false
            },
            {
                "id": "S1",
                "label": "Red+Yellow",
                "output": "110",
                "encoding": "01",
                "position": {"x": 300, "y": 100},
                "isDummy": false
            },
            {
                "id": "S2",
                "label": "Green",
                "output": "001",
                "encoding": "11",
                "position": {"x": 500, "y": 100},
                "isDummy": false
            },
            {
                "id": "S3",
                "label": "Yellow",
                "output": "010",
                "encoding": "10",
                "position": {"x": 300, "y": 300},
                "isDummy": false
            }
        ],
        "transitions": [
            {
                "id": "T0",
                "from": "S0",
                "to": "S1",
                "input": "timer",
                "label": "30s elapsed",
                "output": null
            },
            {
                "id": "T1",
                "from": "S1",
                "to": "S2",
                "input": "timer",
                "label": "3s elapsed",
                "output": null
            },
            {
                "id": "T2",
                "from": "S2",
                "to": "S3",
                "input": "timer",
                "label": "25s elapsed",
                "output": null
            },
            {
                "id": "T3",
                "from": "S3",
                "to": "S0",
                "input": "timer",
                "label": "5s elapsed",
                "output": null
            }
        ],
        "initial_state": "S0",
        "metadata": {
            "author": "GrayFSM System",
            "date_created": "2025-11-29",
            "tool_version": "1.0.0",
            "description": "Classic traffic light example with 4 states"
        }
    }'::jsonb,
    4,
    4,
    'S0',
    2,
    'gray',
    '550e8400-e29b-41d4-a716-446655440001',
    'example',
    FALSE,
    ARRAY['traffic', 'controller', 'safety-critical', 'moore'],
    '00000000-0000-0000-0000-000000000000'
)
ON CONFLICT (id) DO NOTHING;

\echo 'Example FSM 1 loaded: Traffic Light Controller'

-- ----------------------------------------------------------------
-- EXAMPLE FSM 2: Vending Machine
-- ----------------------------------------------------------------

INSERT INTO fsms (
    id,
    name,
    description,
    fsm_type,
    definition,
    state_count,
    transition_count,
    initial_state,
    bit_width,
    encoding_type,
    category_id,
    visibility,
    is_optimized,
    tags,
    created_by
) VALUES (
    '550e8400-e29b-41d4-a716-446655440101',
    'Vending Machine Controller',
    'Mealy machine for coin-operated vending machine. Accepts nickels (5¢) and dispenses item at 15¢.',
    'mealy',
    '{
        "type": "mealy",
        "states": [
            {
                "id": "S0",
                "label": "0 cents",
                "encoding": "00",
                "position": {"x": 100, "y": 200},
                "isDummy": false
            },
            {
                "id": "S1",
                "label": "5 cents",
                "encoding": "01",
                "position": {"x": 300, "y": 200},
                "isDummy": false
            },
            {
                "id": "S2",
                "label": "10 cents",
                "encoding": "11",
                "position": {"x": 500, "y": 200},
                "isDummy": false
            }
        ],
        "transitions": [
            {
                "id": "T0",
                "from": "S0",
                "to": "S1",
                "input": "nickel",
                "output": "dispense_nothing",
                "label": "Insert 5¢"
            },
            {
                "id": "T1",
                "from": "S1",
                "to": "S2",
                "input": "nickel",
                "output": "dispense_nothing",
                "label": "Insert 5¢"
            },
            {
                "id": "T2",
                "from": "S2",
                "to": "S0",
                "input": "nickel",
                "output": "dispense_item",
                "label": "Insert 5¢, dispense"
            }
        ],
        "initial_state": "S0",
        "metadata": {
            "author": "GrayFSM System",
            "date_created": "2025-11-29",
            "tool_version": "1.0.0",
            "description": "Simple vending machine accepting nickels"
        }
    }'::jsonb,
    3,
    3,
    'S0',
    2,
    'gray',
    '550e8400-e29b-41d4-a716-446655440001',
    'example',
    FALSE,
    ARRAY['vending', 'machine', 'mealy', 'commercial'],
    '00000000-0000-0000-0000-000000000000'
)
ON CONFLICT (id) DO NOTHING;

\echo 'Example FSM 2 loaded: Vending Machine Controller'

-- ----------------------------------------------------------------
-- EXAMPLE FSM 3: Sequence Detector
-- ----------------------------------------------------------------

INSERT INTO fsms (
    id,
    name,
    description,
    fsm_type,
    definition,
    state_count,
    transition_count,
    initial_state,
    bit_width,
    encoding_type,
    category_id,
    visibility,
    is_optimized,
    tags,
    created_by
) VALUES (
    '550e8400-e29b-41d4-a716-446655440102',
    'Sequence Detector (1011)',
    'Moore machine that detects the binary sequence 1011 in an input stream.',
    'moore',
    '{
        "type": "moore",
        "states": [
            {
                "id": "S0",
                "label": "Start",
                "output": "0",
                "encoding": "000",
                "position": {"x": 100, "y": 200},
                "isDummy": false
            },
            {
                "id": "S1",
                "label": "Got 1",
                "output": "0",
                "encoding": "001",
                "position": {"x": 250, "y": 100},
                "isDummy": false
            },
            {
                "id": "S2",
                "label": "Got 10",
                "output": "0",
                "encoding": "011",
                "position": {"x": 400, "y": 100},
                "isDummy": false
            },
            {
                "id": "S3",
                "label": "Got 101",
                "output": "0",
                "encoding": "010",
                "position": {"x": 550, "y": 200},
                "isDummy": false
            },
            {
                "id": "S4",
                "label": "Got 1011 (Match)",
                "output": "1",
                "encoding": "110",
                "position": {"x": 400, "y": 300},
                "isDummy": false
            }
        ],
        "transitions": [
            {
                "id": "T0",
                "from": "S0",
                "to": "S1",
                "input": "1",
                "label": "Input: 1"
            },
            {
                "id": "T1",
                "from": "S0",
                "to": "S0",
                "input": "0",
                "label": "Input: 0"
            },
            {
                "id": "T2",
                "from": "S1",
                "to": "S2",
                "input": "0",
                "label": "Input: 0"
            },
            {
                "id": "T3",
                "from": "S1",
                "to": "S1",
                "input": "1",
                "label": "Input: 1"
            },
            {
                "id": "T4",
                "from": "S2",
                "to": "S3",
                "input": "1",
                "label": "Input: 1"
            },
            {
                "id": "T5",
                "from": "S2",
                "to": "S0",
                "input": "0",
                "label": "Input: 0"
            },
            {
                "id": "T6",
                "from": "S3",
                "to": "S4",
                "input": "1",
                "label": "Input: 1"
            },
            {
                "id": "T7",
                "from": "S3",
                "to": "S2",
                "input": "0",
                "label": "Input: 0"
            },
            {
                "id": "T8",
                "from": "S4",
                "to": "S1",
                "input": "1",
                "label": "Input: 1"
            },
            {
                "id": "T9",
                "from": "S4",
                "to": "S2",
                "input": "0",
                "label": "Input: 0"
            }
        ],
        "initial_state": "S0",
        "metadata": {
            "author": "GrayFSM System",
            "date_created": "2025-11-29",
            "tool_version": "1.0.0",
            "description": "Sequence detector for pattern 1011"
        }
    }'::jsonb,
    5,
    10,
    'S0',
    3,
    'gray',
    '550e8400-e29b-41d4-a716-446655440004',
    'example',
    FALSE,
    ARRAY['sequence', 'detector', 'moore', 'digital-design'],
    '00000000-0000-0000-0000-000000000000'
)
ON CONFLICT (id) DO NOTHING;

\echo 'Example FSM 3 loaded: Sequence Detector'

-- ----------------------------------------------------------------
-- Update category FSM counts
-- ----------------------------------------------------------------

UPDATE categories c
SET fsm_count = (
    SELECT COUNT(*)
    FROM fsms f
    WHERE f.category_id = c.id
    AND f.visibility = 'example'
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
    'Users' as entity,
    COUNT(*)::text as count
FROM users
UNION ALL
SELECT
    'Example FSMs' as entity,
    COUNT(*)::text as count
FROM fsms
WHERE visibility = 'example';

\echo '================================================================'
\echo 'Seed data loaded successfully!'
\echo '================================================================'
