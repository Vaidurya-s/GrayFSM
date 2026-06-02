"""
Disk-seed + optimize round-trip regression coverage.

The disk-seed path (``_seed_examples_if_empty``) used to drop
``initial_state`` from the FSM's JSONB ``definition`` because it stored
``initial_state`` only as a top-level column, not inside the JSONB blob.
The optimizer reads ``original_fsm.definition["initial_state"]`` when
persisting an optimized FSM, so optimizing a freshly-seeded example
raised KeyError mid-transaction.

Pinned at fix 87f4c18: the seeder now includes ``initial_state`` in the
JSONB definition. This test exercises the real seeder (not a mock) and
then optimizes one of the seeded rows to confirm the round-trip.
"""
from __future__ import annotations

import pytest
from sqlalchemy import select


@pytest.mark.asyncio
async def test_seeded_example_can_be_optimized_without_keyerror(
    api_client, db_engine, db_session, db_session_factory, auth_headers_a, monkeypatch
):
    """Run the real seeder against the test DB and then optimize one of the
    seeded examples. The bug surface is KeyError('initial_state') inside
    OptimizationService._persist_optimized_fsm — that path is exercised
    only when the seeded FSM is the source.
    """
    from app.db import session as db_session_module
    from app.models.fsm import FSM
    from app.db.session import _seed_examples_if_empty

    # The seeder uses AsyncSessionLocal at the module level — point it at
    # our per-test SQLite factory so the rows it inserts are visible to
    # the API client's overridden get_db.
    monkeypatch.setattr(db_session_module, "AsyncSessionLocal", db_session_factory)

    await _seed_examples_if_empty()

    # Confirm seeding actually wrote something and `initial_state` is in
    # the JSONB definition. Failing here means the seeder regressed back
    # to the pre-87f4c18 shape.
    result = await db_session.execute(select(FSM).where(FSM.visibility == "example"))
    seeded = result.scalars().all()
    assert seeded, "seeder did not produce any example rows"
    for row in seeded:
        assert "initial_state" in (row.definition or {}), (
            f"seeded row {row.name!r} is missing initial_state in definition "
            f"(regression of 87f4c18): {row.definition!r}"
        )

    # Pick one example with a small state count so optimization is quick.
    smallest = min(seeded, key=lambda f: f.state_count)
    resp = await api_client.post(
        f"/api/v1/fsms/{smallest.id}/optimize",
        json={"algorithm": "greedy", "options": {}},
        headers=auth_headers_a,
    )
    assert resp.status_code == 200, (
        f"optimize on a seeded example failed — pre-87f4c18 this would "
        f"KeyError mid-transaction. Status={resp.status_code} body={resp.text}"
    )
