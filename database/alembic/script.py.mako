"""${message}

Revision ID: ${up_revision}
Revises: ${down_revision | comma,n}
Create Date: ${create_date}

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
${imports if imports else ""}

# revision identifiers, used by Alembic.
revision: str = ${repr(up_revision)}
down_revision: Union[str, None] = ${repr(down_revision)}
branch_labels: Union[str, Sequence[str], None] = ${repr(branch_labels)}
depends_on: Union[str, Sequence[str], None] = ${repr(depends_on)}


def upgrade() -> None:
    """
    Upgrade database schema.

    Add your upgrade operations here.
    """
    ${upgrades if upgrades else "pass"}


def downgrade() -> None:
    """
    Downgrade database schema.

    Add your downgrade operations here to reverse the upgrade.
    IMPORTANT: Always implement downgrade to enable rollbacks.
    """
    ${downgrades if downgrades else "pass"}
