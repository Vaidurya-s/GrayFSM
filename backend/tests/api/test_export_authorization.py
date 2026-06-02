"""
Export endpoint authorization + CSV-None-output regression coverage.

Pinned scenarios:
  - public + example FSMs may be exported by any authed user (mirrors
    optimize at fix b7a5a2d).
  - CSV export after optimizing a sequence_detector with greedy: body
    must be non-empty and must not contain literal "None" — that was the
    Moore-output `str.join(None)` crash fixed at 71d08ce.
  - Verilog and JSON export sanity for the same setup (200 + non-empty).
"""
from __future__ import annotations

import json
import re

import pytest

from tests.api.conftest import insert_fsm


_SEQUENCE_DETECTOR_DEFINITION = {
    # 4-state Mealy 101 detector. Moore would be cleaner but the CSV bug
    # was specifically about Moore transitions whose `output` is None, so
    # we use a Moore variant with deliberately-None outputs on transitions.
    "states": ["S0", "S1", "S2", "S3"],
    "initial_state": "S0",
    "transitions": [
        # Mix outputs and Nones on Moore transitions — Moore transitions
        # don't typically have an output, so None here is the bug shape.
        {"from_state": "S0", "to_state": "S1", "input": "1", "output": None},
        {"from_state": "S0", "to_state": "S0", "input": "0", "output": None},
        {"from_state": "S1", "to_state": "S1", "input": "1", "output": None},
        {"from_state": "S1", "to_state": "S2", "input": "0", "output": None},
        {"from_state": "S2", "to_state": "S3", "input": "1", "output": None},
        {"from_state": "S2", "to_state": "S0", "input": "0", "output": None},
        {"from_state": "S3", "to_state": "S1", "input": "1", "output": None},
        {"from_state": "S3", "to_state": "S2", "input": "0", "output": None},
    ],
    "outputs": {"S0": "0", "S1": "0", "S2": "0", "S3": "1"},
}


@pytest.mark.asyncio
async def test_export_public_fsm_for_any_authed_user(
    api_client, db_session, auth_headers_a
):
    fsm = await insert_fsm(
        db_session,
        visibility="public",
        created_by=None,
        definition=_SEQUENCE_DETECTOR_DEFINITION,
    )
    resp = await api_client.get(
        f"/api/v1/fsms/{fsm.id}/export/verilog", headers=auth_headers_a
    )
    assert resp.status_code == 200, resp.text


@pytest.mark.asyncio
async def test_export_example_fsm_for_any_authed_user(
    api_client, db_session, auth_headers_a
):
    fsm = await insert_fsm(
        db_session,
        visibility="example",
        created_by=None,
        definition=_SEQUENCE_DETECTOR_DEFINITION,
    )
    resp = await api_client.get(
        f"/api/v1/fsms/{fsm.id}/export/verilog", headers=auth_headers_a
    )
    assert resp.status_code == 200, resp.text


@pytest.mark.asyncio
async def test_csv_export_after_greedy_has_no_none_strings(
    api_client, db_session, auth_headers_a
):
    """Pins fix at 71d08ce: Moore transitions with `output: None` used to
    crash CSV export inside `",".join(...)` (None is not iterable). The
    derived FSM is what gets exported here so we go through the full
    optimize -> export pipeline.
    """
    fsm = await insert_fsm(
        db_session,
        visibility="example",
        created_by=None,
        definition=_SEQUENCE_DETECTOR_DEFINITION,
    )
    opt = await api_client.post(
        f"/api/v1/fsms/{fsm.id}/optimize",
        json={"algorithm": "greedy", "options": {}},
        headers=auth_headers_a,
    )
    assert opt.status_code == 200, opt.text
    body = json.loads(opt.content)
    payload = body.get("data", body) if isinstance(body, dict) else body
    optimized_id = payload["optimized_fsm_id"]

    # CSV export of the derived FSM. This is the path that used to crash.
    csv_resp = await api_client.get(
        f"/api/v1/fsms/{optimized_id}/export/csv", headers=auth_headers_a
    )
    assert csv_resp.status_code == 200, csv_resp.text
    csv_text = csv_resp.text
    assert csv_text.strip(), "CSV body is empty"
    # The bug surface: Python's None coerced to the literal string "None"
    # via str(None) in a join. The CSV must not contain that token.
    assert not re.search(r"\bNone\b", csv_text), (
        f"CSV body contains literal 'None' token (regression of 71d08ce):\n{csv_text}"
    )


@pytest.mark.asyncio
async def test_verilog_and_json_export_sanity(
    api_client, db_session, auth_headers_a
):
    """Sanity check that fixing CSV did not break the other export paths."""
    fsm = await insert_fsm(
        db_session,
        visibility="example",
        created_by=None,
        definition=_SEQUENCE_DETECTOR_DEFINITION,
    )
    opt = await api_client.post(
        f"/api/v1/fsms/{fsm.id}/optimize",
        json={"algorithm": "greedy", "options": {}},
        headers=auth_headers_a,
    )
    assert opt.status_code == 200, opt.text
    body = json.loads(opt.content)
    payload = body.get("data", body) if isinstance(body, dict) else body
    optimized_id = payload["optimized_fsm_id"]

    for fmt in ("verilog", "json"):
        r = await api_client.get(
            f"/api/v1/fsms/{optimized_id}/export/{fmt}", headers=auth_headers_a
        )
        assert r.status_code == 200, f"{fmt}: {r.text}"
        assert r.text.strip(), f"{fmt} body is empty"
