# Testing Agent

> Read `agents/memory.md` first for full project context.

## Mission
Make the test suite actually work. Write unit tests for the working core algorithms (gray_code, hypercube, greedy, bfs_optimal, fsm_model). Fix the test infrastructure. The existing integration and E2E tests are stubs — focus on unit tests first.

---

## Owned Files

### CREATE (new files)
- `backend/tests/test_core/test_hypercube.py` — Unit tests for HypercubeGraph
- `backend/tests/test_core/test_fsm_model.py` — Unit tests for FSMValidator
- `backend/tests/test_core/test_greedy.py` — Unit tests for GreedyOptimizer
- `backend/tests/test_core/test_bfs_optimal.py` — Unit tests for BFSOptimizer

### FIX (existing files)
- `backend/tests/test_core/test_gray_code.py` — Verify and complete existing tests
- `backend/tests/conftest.py` — Fix async test client setup
- `backend/tests/__init__.py` — Ensure proper package structure
- `tests/conftest.py` — Fix shared fixtures for integration tests
- `tests/integration/test_health_endpoints.py` — Fix to work against real API

## DO NOT Touch
- Any source code (`backend/app/*`, `frontend/src/*`) — you only write tests
- `e2e/page-objects/*` — Will update after frontend is built (Phase 2)
- `e2e/tests/*` — Will update after frontend is built (Phase 2)

---

## Current Status

### What exists:
- `backend/tests/test_core/test_gray_code.py` — Has some tests, needs verification
- `backend/tests/conftest.py` — May need async fixture fixes
- `tests/conftest.py` — Shared fixtures (200+ lines), needs review
- `tests/integration/` — 4 test files, all reference unimplemented endpoints
- `tests/fixtures/fsm_fixtures.py` — 10+ predefined FSM test cases
- `tests/fixtures/data_factories.py` — Factory Boy data generation
- `tests/load/` — Locust + K6 load tests (keep as-is)
- `e2e/` — Full Playwright suite (stubs referencing unbuilt UI)

### Test infrastructure:
- `pytest.ini` exists in `tests/`
- `requirements-test.txt` has 45+ test dependencies
- `backend/pyproject.toml` has pytest config

### Core modules to test (all WORKING, read their source):
- `backend/app/core/gray_code.py` — `int_to_gray()`, `gray_to_int()`, `generate_gray_codes()`, `hamming_distance()`, `get_bit_flip_position()`
- `backend/app/core/hypercube.py` — `HypercubeGraph` class with `shortest_path()`, `find_intermediate_states()`, `get_neighbors()`
- `backend/app/core/fsm_model.py` — `FSMValidator` with `validate_fsm_structure()`, `validate_transitions()`, `check_reachability()`
- `backend/app/core/algorithms/greedy.py` — `GreedyOptimizer.optimize()`
- `backend/app/core/algorithms/bfs_optimal.py` — `BFSOptimizer.optimize()`

---

## Tasks (Priority Order)

### Task 1: Fix Test Infrastructure
```bash
# Verify pytest can discover and run tests
cd backend && python -m pytest tests/ -v --co  # dry run, collect only
```

Fix `conftest.py` fixtures:
- Ensure `@pytest.fixture` for async DB sessions works with `pytest-asyncio`
- Ensure test database isolation (use test DB or SQLite for unit tests)
- Core algorithm tests need NO database — they're pure functions

### Task 2: Unit Tests for gray_code.py
```python
# backend/tests/test_core/test_gray_code.py
import pytest
from app.core.gray_code import int_to_gray, gray_to_int, generate_gray_codes, hamming_distance

class TestIntToGray:
    def test_zero(self):
        assert int_to_gray(0, 3) == "000"

    def test_one(self):
        assert int_to_gray(1, 3) == "001"

    def test_roundtrip(self):
        """int -> gray -> int should be identity"""
        for i in range(16):
            gray = int_to_gray(i, 4)
            assert gray_to_int(gray) == i

class TestHammingDistance:
    def test_same(self):
        assert hamming_distance("000", "000") == 0

    def test_one_bit(self):
        assert hamming_distance("000", "001") == 1

    def test_adjacent_gray_codes(self):
        """Adjacent Gray codes should differ by exactly 1 bit"""
        codes = generate_gray_codes(4)
        for i in range(len(codes) - 1):
            assert hamming_distance(codes[i], codes[i+1]) == 1
```

### Task 3: Unit Tests for hypercube.py
Test `HypercubeGraph`:
- `shortest_path("000", "111")` returns valid path
- Every step in path differs by exactly 1 bit
- Path length equals Hamming distance
- `get_neighbors("010")` returns exactly n neighbors for n-bit code
- `find_intermediate_states()` returns correct dummy states

### Task 4: Unit Tests for fsm_model.py
Test `FSMValidator`:
- Valid FSM passes validation
- Missing initial state fails
- Transition to non-existent state fails
- Unreachable state detected by `check_reachability()`
- Both Moore and Mealy types validated correctly

### Task 5: Unit Tests for Greedy + BFS Algorithms
Test with known FSM inputs:
- Use example FSMs from `backend/examples/*.json`
- Verify optimization reduces average Hamming distance
- Verify all original transitions preserved
- Verify dummy states have valid Gray code encodings
- Verify BFS produces <= same dummy states as Greedy

### Task 6: Fix Integration Tests (AFTER backend-agent completes)
- `test_health_endpoints.py` — Should work now, fix fixture issues
- `test_fsm_endpoints.py` — Fix after verifying CRUD works
- `test_optimization_endpoints.py` — Fix after optimization endpoint is live
- `test_export_endpoints.py` — Fix after export endpoint is live

---

## Test Patterns

Use pytest with these patterns:
```python
import pytest
from app.core.gray_code import generate_gray_codes

class TestGenerateGrayCodes:
    """Group related tests in classes"""

    def test_generates_correct_count(self):
        """2^n codes for n bits"""
        assert len(generate_gray_codes(3)) == 8

    def test_codes_are_correct_length(self):
        """Each code should be n bits"""
        codes = generate_gray_codes(4)
        assert all(len(c) == 4 for c in codes)

    @pytest.mark.parametrize("n_bits", [1, 2, 3, 4, 5])
    def test_adjacent_differ_by_one_bit(self, n_bits):
        """Core Gray code property"""
        codes = generate_gray_codes(n_bits)
        for i in range(len(codes) - 1):
            diff = sum(a != b for a, b in zip(codes[i], codes[i+1]))
            assert diff == 1
```

---

## Interfaces

- **backend-agent**: Wait for optimization/export endpoints before fixing those integration tests
- **frontend-agent**: Wait for UI pages before updating E2E tests
- **You can work immediately** on unit tests for core algorithms — they're pure functions with no dependencies
