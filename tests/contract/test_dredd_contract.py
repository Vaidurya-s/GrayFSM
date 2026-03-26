"""
Dredd Contract Tests

Uses Dredd to validate API implementation against OpenAPI specification.
Run with: dredd openapi-spec.yaml http://localhost:8000
"""

import os
import subprocess
import pytest


@pytest.mark.contract
@pytest.mark.slow
def test_dredd_contract_validation():
    """
    Run Dredd to validate all API endpoints against OpenAPI spec.

    This test requires:
    - Dredd installed: npm install -g dredd
    - API server running on localhost:8000
    """
    spec_path = os.path.join(
        os.path.dirname(__file__),
        "../../openapi-spec.yaml"
    )

    api_url = os.getenv("API_BASE_URL", "http://localhost:8000")

    try:
        result = subprocess.run(
            [
                "dredd",
                spec_path,
                api_url,
                "--hookfiles=tests/contract/dredd_hooks.py",
                "--reporter=markdown:dredd-report.md",
                "--reporter=html:dredd-report.html",
                "--loglevel=warning"
            ],
            capture_output=True,
            text=True,
            timeout=300
        )

        # Dredd returns 0 on success
        assert result.returncode == 0, f"Dredd validation failed:\n{result.stdout}\n{result.stderr}"

    except FileNotFoundError:
        pytest.skip("Dredd not installed. Install with: npm install -g dredd")
    except subprocess.TimeoutExpired:
        pytest.fail("Dredd test timed out after 5 minutes")


@pytest.mark.contract
def test_openapi_spec_structure():
    """Validate OpenAPI spec has required sections."""
    import yaml

    spec_path = os.path.join(
        os.path.dirname(__file__),
        "../../openapi-spec.yaml"
    )

    with open(spec_path, 'r') as f:
        spec = yaml.safe_load(f)

    # Required top-level fields
    assert "openapi" in spec
    assert "info" in spec
    assert "paths" in spec
    assert "components" in spec

    # Info section
    assert "title" in spec["info"]
    assert "version" in spec["info"]
    assert "description" in spec["info"]

    # Paths
    assert len(spec["paths"]) > 0

    # Components
    assert "schemas" in spec["components"]
    assert "responses" in spec["components"]

    # Check for critical endpoints
    critical_paths = [
        "/fsms",
        "/fsms/{fsm_id}",
        "/fsms/{fsm_id}/optimize",
        "/fsms/{fsm_id}/export",
        "/health"
    ]

    for path in critical_paths:
        assert path in spec["paths"], f"Missing critical endpoint: {path}"
