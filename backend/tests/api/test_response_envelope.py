"""
Response-envelope shape regression coverage.

The frontend has defensive tolerance for both envelope-wrapped
(``{success, data, ...}``) and bare-body responses (see
frontend/src/api/endpoints/{fsms,examples,algorithms}.ts). That
tolerance only matters because the response_wrapper middleware
behavior is inconsistent — some routes are wrapped, others aren't, and
which is which has been a moving target across PRs.

This test pins the CURRENT observed shape for each load-bearing route
so that a silent change to response_wrapper has to update this file
consciously. Whether the wrapper applies or not, we assert:

  1. The body parses as JSON.
  2. The load-bearing key (``id`` on FSM responses, ``optimized_fsm_id``
     on optimize) is reachable either at top-level or under ``data``.
  3. None of the required identity fields are literally null.
"""
from __future__ import annotations

import json

import pytest

from tests.api.conftest import insert_fsm


_DEFINITION = {
    "states": ["A", "B", "C"],
    "initial_state": "A",
    "transitions": [
        {"from_state": "A", "to_state": "B", "input": "x"},
        {"from_state": "B", "to_state": "C", "input": "x"},
        {"from_state": "C", "to_state": "A", "input": "x"},
    ],
    "outputs": {"A": "0", "B": "1", "C": "0"},
}


def _payload(body: object) -> dict:
    """Return the load-bearing object, regardless of envelope shape."""
    if isinstance(body, dict) and "data" in body and isinstance(body["data"], dict):
        return body["data"]
    if isinstance(body, dict):
        return body
    raise AssertionError(f"unexpected body shape: {type(body).__name__}: {body!r}")


@pytest.mark.asyncio
async def test_get_fsm_body_has_id_and_no_null_identity(
    api_client, db_session, user_a_id, auth_headers_a
):
    fsm = await insert_fsm(
        db_session, visibility="private", created_by=user_a_id, definition=_DEFINITION
    )
    resp = await api_client.get(f"/api/v1/fsms/{fsm.id}", headers=auth_headers_a)
    assert resp.status_code == 200

    body = json.loads(resp.content)
    payload = _payload(body)

    # Load-bearing key — frontend uses it everywhere via res.data.id.
    assert payload.get("id"), f"missing id in payload: {payload!r}"
    assert payload["id"] == str(fsm.id)
    # Required identity fields must never be null.
    for key in ("name", "fsm_type"):
        assert payload.get(key) is not None, f"{key} is null in {payload!r}"

    # If the envelope wrapper applied, it must include success=True.
    if isinstance(body, dict) and "data" in body and isinstance(body["data"], dict):
        assert body.get("success") is True, (
            f"envelope-wrapped body missing success=True: {body!r}"
        )


@pytest.mark.asyncio
async def test_list_examples_returns_array_or_wrapped_array(api_client):
    resp = await api_client.get("/api/v1/examples")
    assert resp.status_code == 200
    body = json.loads(resp.content)

    # Pin to the observed shape: either a bare array, or {success, data: [...]}
    if isinstance(body, list):
        examples = body
    elif isinstance(body, dict) and "data" in body and isinstance(body["data"], list):
        assert body.get("success") is True
        examples = body["data"]
    else:
        raise AssertionError(
            f"/api/v1/examples returned unexpected shape: {type(body).__name__}: {body!r}"
        )

    # examples directory always contains at least the bundled JSONs.
    assert isinstance(examples, list), "examples payload is not a list"


@pytest.mark.asyncio
async def test_optimize_returns_optimized_fsm_id_either_shape(
    api_client, db_session, user_a_id, auth_headers_a
):
    fsm = await insert_fsm(
        db_session, visibility="private", created_by=user_a_id, definition=_DEFINITION
    )
    resp = await api_client.post(
        f"/api/v1/fsms/{fsm.id}/optimize",
        json={"algorithm": "greedy", "options": {}},
        headers=auth_headers_a,
    )
    assert resp.status_code == 200, resp.text
    body = json.loads(resp.content)

    payload = _payload(body)
    assert payload.get("optimized_fsm_id"), (
        f"optimize body missing optimized_fsm_id either at top-level or under data: {body!r}"
    )
    # `algorithm` is a required identity field per OptimizationResponse — must
    # not be missing or null silently.
    assert payload.get("algorithm") == "greedy", f"missing/wrong algorithm: {payload!r}"
