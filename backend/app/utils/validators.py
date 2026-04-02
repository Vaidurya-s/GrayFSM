"""
Input validation and sanitisation utilities for GrayFSM.

Provides defence-in-depth functions that can be called from Pydantic
validators, service methods, or anywhere user-supplied strings need to
be cleaned before further processing.

Adapted from security/fixes/02_input_validation.py
"""

import html
import re
from typing import List, Optional

from app.utils.logger import get_logger

logger = get_logger(__name__)


# ---------------------------------------------------------------------------
# Dangerous-pattern lists (defence-in-depth, not primary defence)
# ---------------------------------------------------------------------------

# Characters / sequences that have no legitimate reason to appear in
# plain-text user input.
_DANGEROUS_PATTERNS = re.compile(
    r"<script|</script|javascript:|on\w+\s*=|data:text/html",
    re.IGNORECASE,
)

# SQL injection indicators (secondary defence; parameterised queries are
# the primary defence).
_SQL_PATTERNS = re.compile(
    r"('\s*(or|and)\s*')"
    r"|(;\s*drop\s+table)"
    r"|(;\s*delete\s+from)"
    r"|(union\s+select)"
    r"|(--)"
    r"|(/\*|\*/)",
    re.IGNORECASE,
)


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def sanitize_string(value: str) -> str:
    """
    Strip dangerous characters and HTML-encode a plain-text string.

    This is the catch-all sanitiser.  It:
    1. Strips leading/trailing whitespace.
    2. HTML-entity-encodes ``<``, ``>``, ``&``, ``"``, ``'``.
    3. Collapses multiple consecutive whitespace into a single space.

    Returns the cleaned string.  Never raises.
    """
    if not value:
        return value

    # Strip outer whitespace
    cleaned = value.strip()

    # HTML-entity-encode to neutralise XSS payloads
    cleaned = html.escape(cleaned, quote=True)

    # Collapse internal whitespace runs
    cleaned = re.sub(r"\s+", " ", cleaned)

    return cleaned


def validate_fsm_name(name: str) -> str:
    """
    Validate and sanitise an FSM name.

    Rules:
    - Must not be empty or whitespace-only.
    - Maximum 255 characters.
    - HTML-entity-encoded for safety.

    Returns the sanitised name.
    Raises ``ValueError`` if validation fails.
    """
    if not name or not name.strip():
        raise ValueError("FSM name cannot be empty")

    name = name.strip()

    if len(name) > 255:
        raise ValueError("FSM name too long (max 255 characters)")

    # Check for obvious script injection before encoding
    if _DANGEROUS_PATTERNS.search(name):
        raise ValueError("FSM name contains potentially dangerous content")

    return sanitize_string(name)


def validate_tags(tags: Optional[List[str]]) -> List[str]:
    """
    Validate a list of tags.

    Rules per tag:
    - Must not be empty.
    - Maximum 50 characters.
    - Only alphanumeric, hyphens, underscores, and spaces allowed.
    - Sanitised via ``sanitize_string``.

    The whole list:
    - Maximum 20 tags.
    - Duplicates are silently removed (case-insensitive).

    Returns the cleaned tag list (may be shorter than the input).
    Raises ``ValueError`` on rule violations.
    """
    if tags is None:
        return []

    if len(tags) > 20:
        raise ValueError("Too many tags (max 20)")

    tag_pattern = re.compile(r"^[a-zA-Z0-9][a-zA-Z0-9 _-]*$")
    seen: set = set()
    result: List[str] = []

    for raw_tag in tags:
        if not raw_tag or not raw_tag.strip():
            raise ValueError("Tag cannot be empty")

        tag = raw_tag.strip()

        if len(tag) > 50:
            raise ValueError(f"Tag too long (max 50 characters): {tag[:20]}...")

        if not tag_pattern.match(tag):
            raise ValueError(
                f"Tag contains invalid characters: {tag!r}. "
                "Only alphanumeric, hyphens, underscores, and spaces are allowed."
            )

        normalised = tag.lower()
        if normalised not in seen:
            seen.add(normalised)
            result.append(sanitize_string(tag))

    return result


def validate_state_name(name: str) -> str:
    """
    Validate an FSM state name.

    Rules:
    - Must start with a letter.
    - Only alphanumeric characters and underscores.
    - Maximum 64 characters.
    - Must not be a reserved HDL/SQL keyword.

    Returns the validated name unchanged.
    Raises ``ValueError`` on rule violations.
    """
    if not name:
        raise ValueError("State name cannot be empty")

    if len(name) > 64:
        raise ValueError("State name too long (max 64 characters)")

    if not re.match(r"^[a-zA-Z][a-zA-Z0-9_]*$", name):
        raise ValueError(
            "State name must start with a letter and contain only "
            "alphanumeric characters and underscores"
        )

    _reserved = {
        # Verilog
        "module", "endmodule", "input", "output", "wire", "reg",
        "always", "begin", "end", "if", "else", "case", "endcase",
        "default",
        # VHDL
        "entity", "architecture", "process", "signal", "port", "map",
        # SQL
        "select", "insert", "update", "delete", "drop", "table",
        "from", "where",
        # Common attack vectors
        "exec", "eval", "system", "call",
    }

    if name.lower() in _reserved:
        raise ValueError(f"'{name}' is a reserved keyword and cannot be used as a state name")

    return name


def validate_sql_safe(value: str, field_name: str = "field") -> str:
    """
    Defence-in-depth check for SQL injection patterns.

    This should **never** be the primary defence (use parameterised
    queries for that).  It is an additional safety net.

    Returns the value unchanged.
    Raises ``ValueError`` if a suspicious pattern is detected.
    """
    if _SQL_PATTERNS.search(value):
        logger.warning(
            "Potentially malicious SQL pattern detected",
            extra={"field": field_name},
        )
        raise ValueError(f"Potentially malicious content detected in {field_name}")
    return value
