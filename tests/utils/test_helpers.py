"""
Test Helper Utilities

Common utilities for testing.
"""

import asyncio
import time
from typing import Callable, Any, Dict, List
from contextlib import asynccontextmanager
import httpx


def measure_time(func: Callable) -> tuple[Any, float]:
    """
    Measure execution time of a function.

    Returns:
        Tuple of (result, execution_time_ms)
    """
    start = time.time()
    result = func()
    duration = (time.time() - start) * 1000
    return result, duration


async def measure_time_async(coro) -> tuple[Any, float]:
    """
    Measure execution time of an async function.

    Returns:
        Tuple of (result, execution_time_ms)
    """
    start = time.time()
    result = await coro
    duration = (time.time() - start) * 1000
    return result, duration


def assert_response_schema(response: Dict, schema: Dict) -> None:
    """
    Assert that response matches expected schema.

    Args:
        response: API response data
        schema: Expected schema with required keys
    """
    for key in schema.keys():
        assert key in response, f"Missing key: {key}"

        expected_type = schema[key]
        actual_value = response[key]

        if expected_type is not None:
            assert isinstance(actual_value, expected_type), \
                f"Key '{key}' has wrong type. Expected {expected_type}, got {type(actual_value)}"


def assert_fsm_valid(fsm: Dict) -> None:
    """Validate FSM structure."""
    required_keys = ["id", "name", "fsm_type", "states", "initial_state", "transitions"]
    for key in required_keys:
        assert key in fsm, f"FSM missing required key: {key}"

    assert fsm["fsm_type"] in ["moore", "mealy"], "Invalid FSM type"
    assert len(fsm["states"]) > 0, "FSM must have at least one state"
    assert fsm["initial_state"] in fsm["states"], "Initial state not in states list"


def assert_optimization_result_valid(result: Dict) -> None:
    """Validate optimization result structure."""
    required_keys = [
        "algorithm",
        "execution_time_ms",
        "dummy_states_added",
        "optimized_fsm_id"
    ]

    for key in required_keys:
        assert key in result, f"Optimization result missing key: {key}"

    assert result["execution_time_ms"] > 0, "Execution time must be positive"
    assert result["dummy_states_added"] >= 0, "Dummy states cannot be negative"


def assert_pagination_valid(pagination: Dict) -> None:
    """Validate pagination structure."""
    required_keys = ["page", "page_size", "total_items", "total_pages", "has_next", "has_prev"]

    for key in required_keys:
        assert key in pagination, f"Pagination missing key: {key}"

    assert pagination["page"] > 0, "Page must be positive"
    assert pagination["page_size"] > 0, "Page size must be positive"
    assert pagination["total_items"] >= 0, "Total items cannot be negative"
    assert pagination["total_pages"] >= 0, "Total pages cannot be negative"


async def wait_for_condition(
    condition: Callable[[], bool],
    timeout: float = 10.0,
    interval: float = 0.5
) -> bool:
    """
    Wait for a condition to become true.

    Args:
        condition: Function that returns bool
        timeout: Maximum time to wait in seconds
        interval: Check interval in seconds

    Returns:
        True if condition met, False if timeout
    """
    start = time.time()
    while time.time() - start < timeout:
        if condition():
            return True
        await asyncio.sleep(interval)
    return False


async def retry_on_failure(
    coro,
    max_attempts: int = 3,
    delay: float = 1.0
) -> Any:
    """
    Retry async operation on failure.

    Args:
        coro: Async function to retry
        max_attempts: Maximum number of attempts
        delay: Delay between attempts in seconds

    Returns:
        Result of successful attempt

    Raises:
        Last exception if all attempts fail
    """
    last_exception = None

    for attempt in range(max_attempts):
        try:
            return await coro
        except Exception as e:
            last_exception = e
            if attempt < max_attempts - 1:
                await asyncio.sleep(delay)
            continue

    raise last_exception


class PerformanceMonitor:
    """Monitor performance metrics during tests."""

    def __init__(self):
        self.metrics: List[Dict] = []

    def record(self, operation: str, duration_ms: float, success: bool = True):
        """Record a performance metric."""
        self.metrics.append({
            "operation": operation,
            "duration_ms": duration_ms,
            "success": success,
            "timestamp": time.time()
        })

    def get_stats(self, operation: str = None) -> Dict:
        """Get performance statistics."""
        metrics = self.metrics
        if operation:
            metrics = [m for m in metrics if m["operation"] == operation]

        if not metrics:
            return {}

        durations = [m["duration_ms"] for m in metrics]
        successes = sum(1 for m in metrics if m["success"])

        return {
            "count": len(metrics),
            "success_rate": successes / len(metrics),
            "avg_duration": sum(durations) / len(durations),
            "min_duration": min(durations),
            "max_duration": max(durations),
            "p95_duration": sorted(durations)[int(len(durations) * 0.95)] if len(durations) > 1 else durations[0]
        }

    def assert_performance(self, operation: str, max_avg_ms: float, min_success_rate: float = 0.95):
        """Assert performance meets requirements."""
        stats = self.get_stats(operation)

        assert stats["avg_duration"] < max_avg_ms, \
            f"{operation} avg duration {stats['avg_duration']}ms exceeds {max_avg_ms}ms"

        assert stats["success_rate"] >= min_success_rate, \
            f"{operation} success rate {stats['success_rate']} below {min_success_rate}"


@asynccontextmanager
async def api_client_context(base_url: str = "http://localhost:8000/api/v1"):
    """Context manager for API client with cleanup."""
    async with httpx.AsyncClient(base_url=base_url, timeout=30.0) as client:
        yield client


def generate_random_fsm_name() -> str:
    """Generate a random FSM name for testing."""
    import random
    import string
    suffix = ''.join(random.choices(string.ascii_lowercase + string.digits, k=8))
    return f"Test_FSM_{suffix}"


def compare_fsm_structure(fsm1: Dict, fsm2: Dict, ignore_keys: List[str] = None) -> bool:
    """
    Compare two FSM structures, ignoring specified keys.

    Args:
        fsm1: First FSM
        fsm2: Second FSM
        ignore_keys: Keys to ignore in comparison (e.g., ['id', 'created_at'])

    Returns:
        True if FSMs are structurally equal
    """
    ignore_keys = ignore_keys or ['id', 'created_at', 'updated_at']

    def filter_dict(d: Dict) -> Dict:
        return {k: v for k, v in d.items() if k not in ignore_keys}

    return filter_dict(fsm1) == filter_dict(fsm2)


def validate_verilog_syntax(verilog_code: str) -> bool:
    """
    Basic validation of Verilog syntax.

    Returns:
        True if basic syntax checks pass
    """
    # Check for balanced keywords
    if verilog_code.count("module") != verilog_code.count("endmodule"):
        return False

    if verilog_code.count("begin") != verilog_code.count("end"):
        return False

    # Check for required sections
    if "module" not in verilog_code:
        return False

    if "input" not in verilog_code and "output" not in verilog_code:
        return False

    return True


def validate_vhdl_syntax(vhdl_code: str) -> bool:
    """
    Basic validation of VHDL syntax.

    Returns:
        True if basic syntax checks pass
    """
    vhdl_lower = vhdl_code.lower()

    # Check for required sections
    if "entity" not in vhdl_lower:
        return False

    if "architecture" not in vhdl_lower:
        return False

    if "end" not in vhdl_lower:
        return False

    return True
