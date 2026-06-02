"""
POST /api/v1/fsms/{id}/optimize authorization + derived-FSM ownership.

Pinned scenarios:
  - example FSM optimized by authed user           -> 200    (fix b7a5a2d)
  - re-optimizing an already-optimized FSM         -> 422    (fix 25d2fed)
  - non-owner / non-public                         -> 404
  - derived FSM from example is owned by caller    -> assertion below
"""
from __future__ import annotations

import json
import uuid

import pytest
from sqlalchemy import select

from tests.api.conftest import insert_fsm


# Minimal 3-state Moore FSM the optimizer accepts. Keep tiny so the test
# completes in milliseconds — we are exercising the auth boundary, not
# algorithm correctness (the algorithm itself is unit-tested elsewhere).
_OPTIMIZABLE_DEFINITION = {
    "states": ["A", "B", "C"],
    "initial_state": "A",
    "transitions": [
        {"from_state": "A", "to_state": "B", "input": "x"},
        {"from_state": "B", "to_state": "C", "input": "x"},
        {"from_state": "C", "to_state": "A", "input": "x"},
    ],
    "outputs": {"A": "0", "B": "1", "C": "0"},
}


def _parse(resp_body: bytes) -> dict:
    """Parse JSON response; tolerate either envelope or bare-body shape."""
    return json.loads(resp_body)


@pytest.mark.asyncio
async def test_example_fsm_optimize_returns_200_for_authed_user(
    api_client, db_session, auth_headers_a
):
    """Pins fix at b7a5a2d: optimize must work on example FSMs."""
    fsm = await insert_fsm(
        db_session,
        visibility="example",
        created_by=None,
        definition=_OPTIMIZABLE_DEFINITION,
    )
    resp = await api_client.post(
        f"/api/v1/fsms/{fsm.id}/optimize",
        json={"algorithm": "greedy", "options": {}},
        headers=auth_headers_a,
    )
    assert resp.status_code == 200, resp.text


@pytest.mark.asyncio
async def test_reoptimize_blocked_with_422(
    api_client, db_session, user_a_id, auth_headers_a
):
    """Pins fix at 25d2fed: an is_optimized=True FSM must 422 with the
    'already optimized' message — compounding dummy states is the bug."""
    fsm = await insert_fsm(
        db_session,
        visibility="private",
        created_by=user_a_id,
        is_optimized=True,
        definition=_OPTIMIZABLE_DEFINITION,
    )
    resp = await api_client.post(
        f"/api/v1/fsms/{fsm.id}/optimize",
        json={"algorithm": "greedy", "options": {}},
        headers=auth_headers_a,
    )
    assert resp.status_code == 422
    body = _parse(resp.content)
    # Body may be wrapped by error_handler middleware; look for the
    # message anywhere in the serialized payload (the "already
    # optimized" phrase is the load-bearing signal).
    assert "already" in json.dumps(body).lower() and "optimi" in json.dumps(body).lower()


@pytest.mark.asyncio
async def test_optimize_non_owner_non_public_is_404(
    api_client, db_session, user_a_id, auth_headers_b
):
    fsm = await insert_fsm(
        db_session,
        visibility="private",
        created_by=user_a_id,
        definition=_OPTIMIZABLE_DEFINITION,
    )
    resp = await api_client.post(
        f"/api/v1/fsms/{fsm.id}/optimize",
        json={"algorithm": "greedy", "options": {}},
        headers=auth_headers_b,
    )
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_example_derived_fsm_is_owned_by_caller(
    api_client, db_session, user_a_id, auth_headers_a
):
    """When an example FSM (created_by=NULL) is optimized by USER_A, the
    derived FSM row must have created_by == USER_A — otherwise it lands
    with created_by=NULL and becomes unreachable under strict-ownership."""
    from app.models.fsm import FSM

    fsm = await insert_fsm(
        db_session,
        visibility="example",
        created_by=None,
        definition=_OPTIMIZABLE_DEFINITION,
    )
    resp = await api_client.post(
        f"/api/v1/fsms/{fsm.id}/optimize",
        json={"algorithm": "greedy", "options": {}},
        headers=auth_headers_a,
    )
    assert resp.status_code == 200, resp.text
    body = _parse(resp.content)
    # Tolerate either envelope or bare shape — see test_response_envelope
    # for why we don't pin one or the other here.
    payload = body.get("data", body) if isinstance(body, dict) else body
    optimized_id = payload.get("optimized_fsm_id")
    assert optimized_id, f"no optimized_fsm_id in response: {body!r}"

    # Re-query in a fresh session so we see the committed row.
    result = await db_session.execute(
        select(FSM).where(FSM.id == uuid.UUID(optimized_id))
    )
    derived = result.scalar_one_or_none()
    assert derived is not None, "derived FSM row not found"
    assert str(derived.created_by) == str(user_a_id), (
        f"derived FSM created_by mismatch: got {derived.created_by!r}, "
        f"expected {user_a_id!r}"
    )
