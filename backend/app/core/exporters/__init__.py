"""
Exporter Registry

Maps export format names to their exporter classes.
All exporters share the same interface:
    export(definition, fsm_type, name, options) -> str
"""
from typing import Dict, Type, Any

from app.core.exporters.verilog import VerilogExporter
from app.core.exporters.vhdl import VHDLExporter
from app.core.exporters.json_exporter import JSONExporter
from app.core.exporters.csv_exporter import CSVExporter
from app.core.exporters.testbench import TestbenchExporter
from app.core.exporters.sva_exporter import SVAExporter
from app.utils.exceptions import ExportException


# Registry mapping format name -> exporter class
EXPORTER_REGISTRY: Dict[str, Any] = {
    "verilog": VerilogExporter,
    "vhdl": VHDLExporter,
    "json": JSONExporter,
    "csv": CSVExporter,
    "testbench": TestbenchExporter,
    "sva": SVAExporter,
}

# File extension mapping
FORMAT_EXTENSIONS: Dict[str, str] = {
    "verilog": ".v",
    "vhdl": ".vhd",
    "json": ".json",
    "csv": ".csv",
    "testbench": ".v",
    "sva": ".sv",
}

# Export format metadata
FORMAT_INFO = {
    "verilog": {
        "name": "Verilog HDL",
        "extension": ".v",
        "description": "Synthesizable Verilog hardware description language",
    },
    "vhdl": {
        "name": "VHDL",
        "extension": ".vhd",
        "description": "VHSIC Hardware Description Language",
    },
    "json": {
        "name": "JSON",
        "extension": ".json",
        "description": "Portable JSON format for FSM interchange",
    },
    "csv": {
        "name": "CSV",
        "extension": ".csv",
        "description": "Comma-separated values format for FSM states and transitions",
    },
    "testbench": {
        "name": "Verilog Testbench",
        "extension": ".v",
        "description": "Verilog testbench with clock, reset, stimulus, and waveform generation",
    },
    "sva": {
        "name": "SystemVerilog Assertions",
        "extension": ".sv",
        "description": "SystemVerilog assertions module with assert/cover properties",
    },
}


def get_exporter(format_name: str):
    """
    Get an exporter instance by format name.

    Args:
        format_name: Export format identifier (e.g., 'verilog', 'vhdl', 'json')

    Returns:
        Exporter instance

    Raises:
        ExportException: If the format is not supported
    """
    if format_name not in EXPORTER_REGISTRY:
        available = ", ".join(EXPORTER_REGISTRY.keys())
        raise ExportException(
            f"Unsupported export format: '{format_name}'. "
            f"Available formats: {available}"
        )
    return EXPORTER_REGISTRY[format_name]()


def get_file_extension(format_name: str) -> str:
    """
    Get file extension for a format.

    Args:
        format_name: Export format identifier

    Returns:
        File extension string (e.g., '.v')
    """
    return FORMAT_EXTENSIONS.get(format_name, ".txt")


def list_formats() -> list:
    """
    List all available export formats with metadata.

    Returns:
        List of dictionaries with format info
    """
    return [
        {"id": name, **info}
        for name, info in FORMAT_INFO.items()
    ]
