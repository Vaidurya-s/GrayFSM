# GrayFSM Testing Guide

Complete guide for writing and running tests in the GrayFSM project.

## Quick Start

```bash
# Install dependencies
pip install -r tests/requirements-test.txt

# Set up test database
createdb grayfsm_test
cd backend && alembic upgrade head

# Run all tests
pytest tests/ -v

# Run with coverage
pytest tests/ --cov=backend/app --cov-report=html
```

## Test Structure

```
tests/
├── __init__.py
├── conftest.py                 # Shared fixtures and configuration
├── pytest.ini                  # Pytest configuration
├── requirements-test.txt       # Test dependencies
│
├── contract/                   # Contract tests
│   ├── test_openapi_contract.py
│   ├── test_dredd_contract.py
│   └── dredd_hooks.py
│
├── integration/                # Integration tests
│   ├── test_fsm_endpoints.py
│   ├── test_optimization_endpoints.py
│   ├── test_export_endpoints.py
│   └── test_health_endpoints.py
│
├── load/                       # Load tests
│   ├── locustfile.py
│   └── k6_load_test.js
│
├── fixtures/                   # Test data
│   ├── fsm_fixtures.py
│   └── data_factories.py
│
└── utils/                      # Test utilities
    └── test_helpers.py
```

## Writing Tests

### Contract Tests

Contract tests validate API compliance with OpenAPI specification.

**Example:**

```python
import pytest
import schemathesis

schema = schemathesis.from_uri("http://localhost:8000/openapi.json")

@pytest.mark.contract
@schema.parametrize()
def test_api_conforms_to_schema(case):
    response = case.call()
    case.validate_response(response)
```

### Integration Tests

Integration tests verify complete functionality with real services.

**Example:**

```python
import pytest

@pytest.mark.integration
@pytest.mark.database
@pytest.mark.asyncio
async def test_create_fsm(client, sample_fsm_moore):
    response = await client.post("/fsms", json=sample_fsm_moore)

    assert response.status_code == 201
    data = response.json()

    assert data["success"] is True
    assert data["data"]["name"] == sample_fsm_moore["name"]
```

### Load Tests

Load tests validate performance under various load patterns.

**Locust Example:**

```python
from locust import HttpUser, task, between

class GrayFSMUser(HttpUser):
    wait_time = between(1, 3)

    @task
    def list_fsms(self):
        self.client.get("/api/v1/fsms")

    @task(3)
    def get_fsm(self):
        # Get random FSM
        self.client.get(f"/api/v1/fsms/{fsm_id}")
```

**K6 Example:**

```javascript
import http from 'k6/http';
import { check } from 'k6';

export default function () {
  const response = http.get('http://localhost:8000/api/v1/fsms');
  check(response, {
    'status is 200': (r) => r.status === 200,
  });
}
```

## Using Fixtures

### Predefined FSM Fixtures

```python
from tests.fixtures.fsm_fixtures import FSMFixtures

# Use in tests
def test_traffic_light(client):
    fsm = FSMFixtures.traffic_light_moore()
    response = client.post("/fsms", json=fsm)
    assert response.status_code == 201
```

### Data Factories

```python
from tests.fixtures.data_factories import FSMFactory

# Generate random FSM
def test_random_fsm(client):
    fsm = FSMFactory()
    response = client.post("/fsms", json=fsm)
    assert response.status_code == 201
```

### Pytest Fixtures

Common fixtures available in `conftest.py`:

- `client`: Async HTTP client
- `db_session`: Database session
- `sample_fsm_moore`: Sample Moore FSM
- `sample_fsm_mealy`: Sample Mealy FSM
- `created_fsm`: Already created FSM
- `optimized_fsm`: Optimized FSM
- `base_url`: API base URL

**Example:**

```python
@pytest.mark.asyncio
async def test_with_fixtures(client, created_fsm):
    fsm_id = created_fsm["id"]
    response = await client.get(f"/fsms/{fsm_id}")
    assert response.status_code == 200
```

## Test Markers

Use markers to categorize and filter tests:

```python
@pytest.mark.contract        # Contract test
@pytest.mark.integration     # Integration test
@pytest.mark.load            # Load test
@pytest.mark.slow            # Slow test (>5s)
@pytest.mark.database        # Requires database
@pytest.mark.redis           # Requires Redis
```

**Run specific markers:**

```bash
# Only contract tests
pytest -m contract

# Only integration tests
pytest -m integration

# Exclude slow tests
pytest -m "not slow"

# Database tests only
pytest -m database
```

## Performance Testing

### Measuring Performance

```python
from tests.utils.test_helpers import measure_time_async, PerformanceMonitor

@pytest.mark.asyncio
async def test_optimization_performance(client, created_fsm):
    monitor = PerformanceMonitor()

    # Measure optimization time
    result, duration = await measure_time_async(
        client.post(f"/fsms/{created_fsm['id']}/optimize", json=opt_request)
    )

    monitor.record("optimization", duration)

    # Assert performance
    monitor.assert_performance("optimization", max_avg_ms=5000)
```

### Load Test Scenarios

#### Read-Heavy Workload

```bash
locust -f tests/load/locustfile.py \
  --users 100 \
  --spawn-rate 10 \
  --run-time 5m \
  --host http://localhost:8000 \
  ReadHeavyUser
```

#### Optimization-Heavy Workload

```bash
locust -f tests/load/locustfile.py \
  --users 50 \
  --spawn-rate 5 \
  --run-time 3m \
  --host http://localhost:8000 \
  OptimizationHeavyUser
```

#### Mixed Workload

```bash
locust -f tests/load/locustfile.py \
  --users 100 \
  --spawn-rate 10 \
  --run-time 5m \
  --host http://localhost:8000 \
  MixedWorkloadUser
```

## Debugging Tests

### Run Single Test

```bash
pytest tests/integration/test_fsm_endpoints.py::TestFSMEndpoints::test_create_fsm_moore -v
```

### Run with Debug Output

```bash
pytest tests/integration/test_fsm_endpoints.py -v -s --tb=long
```

### Run with PDB

```bash
pytest tests/integration/test_fsm_endpoints.py --pdb
```

### Run with Logging

```bash
pytest tests/integration/test_fsm_endpoints.py -v --log-cli-level=DEBUG
```

## Coverage Analysis

### Generate Coverage Report

```bash
# HTML report
pytest tests/ --cov=backend/app --cov-report=html
open htmlcov/index.html

# Terminal report
pytest tests/ --cov=backend/app --cov-report=term-missing

# XML for CI/CD
pytest tests/ --cov=backend/app --cov-report=xml
```

### Coverage Thresholds

- Overall: > 90%
- Critical paths: 100%
- New features: Must include tests

## CI/CD Integration

Tests run automatically on:
- Pull requests
- Pushes to main/develop
- Daily schedule (2 AM UTC)

### Workflow Jobs

1. **Contract Tests**: Validate OpenAPI compliance
2. **Integration Tests**: Full API testing
3. **Load Tests**: Performance validation (scheduled)

### Viewing Results

1. Go to Actions tab in GitHub
2. Select workflow run
3. Download artifacts (coverage reports, test reports)

## Best Practices

### 1. Test Naming

```python
# Good
def test_create_fsm_with_valid_data():
    pass

def test_create_fsm_returns_400_for_invalid_data():
    pass

# Bad
def test1():
    pass

def test_fsm():
    pass
```

### 2. Assertions

```python
# Good - Specific assertions with messages
assert response.status_code == 201, f"Expected 201, got {response.status_code}: {response.text}"
assert "id" in data, "Response missing 'id' field"

# Bad - Generic assertions
assert response.ok
assert data
```

### 3. Test Isolation

```python
# Good - Each test is independent
@pytest.mark.asyncio
async def test_create_fsm(client):
    fsm = FSMFactory()
    response = await client.post("/fsms", json=fsm)
    # Test logic
    # Cleanup if needed

# Bad - Tests depend on each other
def test_create_then_update(client):
    # Creates and updates in same test
    pass
```

### 4. Use Fixtures

```python
# Good - Use fixtures
@pytest.mark.asyncio
async def test_get_fsm(client, created_fsm):
    response = await client.get(f"/fsms/{created_fsm['id']}")

# Bad - Manual setup
@pytest.mark.asyncio
async def test_get_fsm(client):
    # Create FSM first
    create_response = await client.post("/fsms", json=fsm_data)
    fsm_id = create_response.json()["data"]["id"]
    response = await client.get(f"/fsms/{fsm_id}")
```

### 5. Test Data

```python
# Good - Use fixtures and factories
from tests.fixtures.fsm_fixtures import FSMFixtures
from tests.fixtures.data_factories import FSMFactory

def test_with_predefined(client):
    fsm = FSMFixtures.traffic_light_moore()
    # Test logic

def test_with_random(client):
    fsm = FSMFactory()
    # Test logic

# Bad - Hardcoded data
def test_hardcoded(client):
    fsm = {
        "name": "Test",
        "states": ["S0", "S1"],
        # ... lots of hardcoded data
    }
```

## Common Patterns

### Testing Async Endpoints

```python
@pytest.mark.asyncio
async def test_async_endpoint(client):
    response = await client.get("/fsms")
    assert response.status_code == 200
```

### Testing Pagination

```python
@pytest.mark.asyncio
async def test_pagination(client):
    # Get first page
    response1 = await client.get("/fsms?page=1&page_size=10")
    data1 = response1.json()

    assert "pagination" in data1
    assert data1["pagination"]["page"] == 1

    # Get second page
    response2 = await client.get("/fsms?page=2&page_size=10")
    data2 = response2.json()

    # Verify no duplicates
    ids1 = {item["id"] for item in data1["data"]}
    ids2 = {item["id"] for item in data2["data"]}
    assert ids1.isdisjoint(ids2)
```

### Testing Error Responses

```python
@pytest.mark.asyncio
async def test_error_response(client):
    response = await client.post("/fsms", json={"invalid": "data"})

    assert response.status_code == 422
    data = response.json()

    assert data["success"] is False
    assert "error" in data
    assert data["error"]["code"] is not None
```

### Testing Concurrent Operations

```python
import asyncio

@pytest.mark.asyncio
async def test_concurrent_requests(client):
    async def create_fsm(name):
        fsm = FSMFactory()
        fsm["name"] = name
        return await client.post("/fsms", json=fsm)

    # Create 10 FSMs concurrently
    tasks = [create_fsm(f"FSM {i}") for i in range(10)]
    responses = await asyncio.gather(*tasks)

    # All should succeed
    for response in responses:
        assert response.status_code == 201
```

## Troubleshooting

### Database Lock Errors

```bash
# Run tests sequentially
pytest tests/ -n 0

# Or use different test database per worker
pytest tests/ -n auto --create-db
```

### Async Test Timeouts

```python
@pytest.mark.asyncio
@pytest.mark.timeout(30)  # 30 second timeout
async def test_slow_operation(client):
    pass
```

### Flaky Tests

```bash
# Run test multiple times
pytest tests/test_flaky.py --count=10

# Run until failure
pytest tests/test_flaky.py -x --looponfail
```

## Resources

- [pytest Documentation](https://docs.pytest.org/)
- [pytest-asyncio](https://pytest-asyncio.readthedocs.io/)
- [Locust Documentation](https://docs.locust.io/)
- [K6 Documentation](https://k6.io/docs/)
- [Schemathesis](https://schemathesis.readthedocs.io/)
