"""
GET /api/v1/fsms/{id} visibility-aware access matrix.

Each scenario pins behavior that was bug-fixed during the recent
debugging cycle. The leading SHA reference identifies the fix; if a
contributor reverts that fix, the matching test below fails.

Covered scenarios:
  - public + created_by=NULL    -> 200 for anyone
  - example + created_by=NULL   -> 200 for anyone (fix 9812a90)
  - private + created_by=NULL   -> 404 (legacy unreachable)
  - private + USER_A vs USER_B  -> 404 (enumeration-safe)
  - private + USER_A vs USER_A  -> 200 (owner can read)
"""
from __future__ import annotations

import pytest

from tests.api.conftest import insert_fsm


@pytest.mark.asyncio
async def test_public_ownerless_is_readable_anonymously(api_client, db_session):
    fsm = await insert_fsm(db_session, visibility="public", created_by=None)
    resp = await api_client.get(f"/api/v1/fsms/{fsm.id}")
    assert resp.status_code == 200, resp.text


@pytest.mark.asyncio
async def test_example_ownerless_is_readable_anonymously(api_client, db_session):
    """Pins fix at 9812a90: visibility=example must be reachable without auth."""
    fsm = await insert_fsm(db_session, visibility="example", created_by=None)
    resp = await api_client.get(f"/api/v1/fsms/{fsm.id}")
    assert resp.status_code == 200, resp.text


@pytest.mark.asyncio
async def test_example_ownerless_is_readable_authed(api_client, db_session, auth_headers_a):
    """Authed callers must also reach example FSMs (the optimize / export
    flows authenticate, so example access has to work both ways)."""
    fsm = await insert_fsm(db_session, visibility="example", created_by=None)
    resp = await api_client.get(f"/api/v1/fsms/{fsm.id}", headers=auth_headers_a)
    assert resp.status_code == 200, resp.text


@pytest.mark.asyncio
async def test_private_ownerless_is_unreachable(api_client, db_session, auth_headers_a):
    """Legacy private rows with no owner must stay unreachable: strict-ownership
    explicitly removed the old 'NULL means public to anyone authed' bypass."""
    fsm = await insert_fsm(db_session, visibility="private", created_by=None)
    resp = await api_client.get(f"/api/v1/fsms/{fsm.id}", headers=auth_headers_a)
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_private_cross_user_is_404(
    api_client, db_session, user_a_id, auth_headers_b
):
    """USER_B requesting USER_A's private FSM must get 404, not 403, so the
    response is indistinguishable from 'does not exist' (enumeration-safe)."""
    fsm = await insert_fsm(db_session, visibility="private", created_by=user_a_id)
    resp = await api_client.get(f"/api/v1/fsms/{fsm.id}", headers=auth_headers_b)
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_private_owner_is_200(api_client, db_session, user_a_id, auth_headers_a):
    fsm = await insert_fsm(db_session, visibility="private", created_by=user_a_id)
    resp = await api_client.get(f"/api/v1/fsms/{fsm.id}", headers=auth_headers_a)
    assert resp.status_code == 200, resp.text
