"""algorithm_result: persist max_hamming + encoding_map for full snapshot

Revision ID: e6a8c9d0b3f1
Revises: d4e5f6a7b8c9
Create Date: 2026-05-28 12:00:00.000000

The OptimizationPage's seed-on-revisit reconstructs the lab report from the
most recent AlgorithmResult row, but `max_hamming_before/after` and the
final `encoding_map` weren't persisted — so the radar chart rendered zeros
and the hypercube tab had no encoding to display historically. The values
are already computed inside `_record_attempt`; this migration adds the
columns so the row becomes a complete optimization snapshot.
"""

from collections.abc import Sequence
from typing import Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB

# revision identifiers, used by Alembic.
revision: str = "e6a8c9d0b3f1"
down_revision: Union[str, None] = "d4e5f6a7b8c9"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "algorithm_results",
        sa.Column("max_hamming_before", sa.Integer(), nullable=True),
    )
    op.add_column(
        "algorithm_results",
        sa.Column("max_hamming_after", sa.Integer(), nullable=True),
    )
    op.add_column(
        "algorithm_results",
        sa.Column("encoding_map", JSONB(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("algorithm_results", "encoding_map")
    op.drop_column("algorithm_results", "max_hamming_after")
    op.drop_column("algorithm_results", "max_hamming_before")
