"""Clean slate: wipe FSMs, algorithm runs, and re-seed categories

Wipes all FSMs and algorithm_results so the per-startup
`_seed_examples_if_empty` hook re-populates from the on-disk example
JSON files (the canonical source of truth). Categories are deleted then
re-inserted with the same fixed UUIDs the original seed used, so any
category-FK round-trip in older bookmarks/screenshots still resolves.

Why a destructive migration? The earlier seed migration
(`a1b2c3d4e5f6_seed_categories_and_examples`) hard-coded only 4
examples and used a slightly different `definition` shape from the
disk-based seeder. Over the course of debugging, the two paths drifted
and the DB ended up with FSMs whose `definition` JSONB occasionally
missed keys the API response model expects. Easier to flush and rebuild
from one canonical source than to write a per-field repair pass.

Revision ID: g7b9d0e1c4f2
Revises: e6a8c9d0b3f1
Create Date: 2026-05-28
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'g7b9d0e1c4f2'
down_revision: Union[str, None] = 'e6a8c9d0b3f1'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


# Same UUIDs as the original seed so any external reference (category
# slug → id mapping) stays stable across the reset.
CAT_DIGITAL_LOGIC = 'c0000001-0000-0000-0000-000000000001'
CAT_COMMUNICATION_PROTOCOLS = 'c0000001-0000-0000-0000-000000000002'
CAT_CONTROL_SYSTEMS = 'c0000001-0000-0000-0000-000000000003'
CAT_SEQUENCE_DETECTORS = 'c0000001-0000-0000-0000-000000000004'
CAT_GAME_LOGIC = 'c0000001-0000-0000-0000-000000000005'


def upgrade() -> None:
    # Wipe FK-dependent rows first. algorithm_results -> fsms (FK).
    op.execute("DELETE FROM algorithm_results")
    op.execute("DELETE FROM fsms")
    op.execute("DELETE FROM categories")

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
    # FSMs are intentionally NOT seeded here. On the next backend boot
    # `app.db.session._seed_examples_if_empty()` notices the empty
    # `fsms` table and inserts every example JSON found in
    # backend/examples/, which is the single canonical source.


def downgrade() -> None:
    # Destructive migration — there's no meaningful inverse beyond
    # "let the seeder repopulate on boot", which is what upgrade already
    # arranges. Categories stay (the prior seed migration's downgrade
    # only removed its 4 known UUIDs; ours match those exactly).
    pass
