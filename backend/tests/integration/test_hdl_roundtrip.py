"""
HDL round-trip tests.

For each example FSM, export to Verilog and VHDL and verify that real HDL
toolchains accept the generated source. Catches regressions where the
exporters start emitting syntactically broken output that would otherwise
only surface when a user runs synthesis.

Requires `iverilog` (Icarus Verilog) and `ghdl` on PATH. Tests are skipped
cleanly when either binary is missing so local runs without the tools
installed still pass.
"""
from __future__ import annotations

import json
import math
import os
import shutil
import subprocess
import tempfile
from pathlib import Path

import pytest

from app.core.exporters.verilog import VerilogExporter
from app.core.exporters.vhdl import VHDLExporter
from app.core.gray_code import int_to_gray

EXAMPLES_DIR = Path(__file__).resolve().parent.parent.parent / "examples"
EXAMPLE_FILES = sorted(EXAMPLES_DIR.glob("*.json"))

HAS_IVERILOG = shutil.which("iverilog") is not None
HAS_GHDL = shutil.which("ghdl") is not None


def _build_definition(raw: dict) -> dict:
    """Construct an exporter-ready definition with binary encodings."""
    states = raw["states"]
    bit_width = max(math.ceil(math.log2(max(len(states), 2))), 1)
    return {
        "states": states,
        "transitions": raw["transitions"],
        "outputs": raw.get("outputs", {}),
        "initial_state": raw["initial_state"],
        "encodings": {s: int_to_gray(i, bit_width) for i, s in enumerate(states)},
    }


@pytest.fixture(params=EXAMPLE_FILES, ids=lambda p: p.stem)
def example_definition(request):
    raw = json.loads(request.param.read_text())
    return request.param.stem, raw.get("type", "moore"), _build_definition(raw)


@pytest.mark.integration
@pytest.mark.skipif(not HAS_IVERILOG, reason="iverilog not installed")
def test_verilog_compiles_with_iverilog(example_definition):
    """Generated Verilog must parse with Icarus Verilog."""
    name, fsm_type, definition = example_definition
    source = VerilogExporter().export(definition, fsm_type, name)

    with tempfile.TemporaryDirectory() as td:
        src_path = Path(td) / f"{name}.v"
        src_path.write_text(source)
        result = subprocess.run(
            ["iverilog", "-g2012", "-o", os.devnull, str(src_path)],
            capture_output=True,
            text=True,
            timeout=30,
        )

    assert result.returncode == 0, (
        f"iverilog rejected generated Verilog for {name}:\n"
        f"stdout:\n{result.stdout}\nstderr:\n{result.stderr}"
    )


@pytest.mark.integration
@pytest.mark.skipif(not HAS_GHDL, reason="ghdl not installed")
def test_vhdl_analyzes_with_ghdl(example_definition):
    """Generated VHDL must analyze cleanly with GHDL (VHDL-2008)."""
    name, fsm_type, definition = example_definition
    source = VHDLExporter().export(definition, fsm_type, name)

    with tempfile.TemporaryDirectory() as td:
        src_path = Path(td) / f"{name}.vhd"
        src_path.write_text(source)
        result = subprocess.run(
            ["ghdl", "-a", "--std=08", str(src_path)],
            capture_output=True,
            text=True,
            cwd=td,
            timeout=30,
        )

    assert result.returncode == 0, (
        f"ghdl rejected generated VHDL for {name}:\n"
        f"stdout:\n{result.stdout}\nstderr:\n{result.stderr}"
    )
