"""
Dredd Hooks

Custom hooks for Dredd contract testing to set up test data,
authenticate requests, and clean up after tests.
"""

import dredd_hooks as hooks
import json
import requests


# Store created resources for cleanup
created_resources = {
    "fsms": [],
    "categories": [],
    "users": []
}

# API base URL
API_BASE = "http://localhost:8000/api/v1"


@hooks.before_all
def setup_test_environment(transactions):
    """Set up test environment before all tests."""
    print("Setting up Dredd test environment...")

    # Create test categories
    response = requests.post(
        f"{API_BASE}/categories",
        json={
            "name": "Test Category",
            "slug": "test-category",
            "description": "Category for Dredd testing"
        }
    )
    if response.status_code == 201:
        created_resources["categories"].append(response.json()["data"]["id"])


@hooks.after_all
def cleanup_test_environment(transactions):
    """Clean up test environment after all tests."""
    print("Cleaning up Dredd test environment...")

    # Delete created FSMs
    for fsm_id in created_resources["fsms"]:
        requests.delete(f"{API_BASE}/fsms/{fsm_id}")

    # Delete created categories
    for category_id in created_resources["categories"]:
        requests.delete(f"{API_BASE}/categories/{category_id}")

    print("Cleanup complete.")


@hooks.before("FSMs > Create FSM")
def before_create_fsm(transaction):
    """Set up data for FSM creation test."""
    # Ensure valid request body
    body = json.loads(transaction['request']['body'])

    if created_resources["categories"]:
        body["category_id"] = created_resources["categories"][0]

    transaction['request']['body'] = json.dumps(body)


@hooks.after("FSMs > Create FSM")
def after_create_fsm(transaction):
    """Store created FSM ID for later use."""
    if transaction['real']['statusCode'] == '201':
        response_body = json.loads(transaction['real']['body'])
        fsm_id = response_body['data']['id']
        created_resources["fsms"].append(fsm_id)
        transaction['context']['fsm_id'] = fsm_id


@hooks.before("FSMs > Get FSM")
def before_get_fsm(transaction):
    """Use a real FSM ID for GET request."""
    if created_resources["fsms"]:
        fsm_id = created_resources["fsms"][0]
        transaction['fullPath'] = transaction['fullPath'].replace(
            '{fsm_id}',
            fsm_id
        )
    else:
        transaction['skip'] = True


@hooks.before("Algorithms > Optimize FSM")
def before_optimize_fsm(transaction):
    """Set up FSM for optimization test."""
    if not created_resources["fsms"]:
        # Create a test FSM first
        response = requests.post(
            f"{API_BASE}/fsms",
            json={
                "name": "Test FSM for Optimization",
                "fsm_type": "moore",
                "states": ["S0", "S1", "S2", "S3"],
                "initial_state": "S0",
                "transitions": [
                    {"from_state": "S0", "to_state": "S1", "input": "a"},
                    {"from_state": "S1", "to_state": "S2", "input": "b"},
                    {"from_state": "S2", "to_state": "S3", "input": "c"},
                    {"from_state": "S3", "to_state": "S0", "input": "d"}
                ],
                "outputs": {
                    "S0": "00",
                    "S1": "01",
                    "S2": "11",
                    "S3": "10"
                },
                "visibility": "private"
            }
        )
        if response.status_code == 201:
            fsm_id = response.json()["data"]["id"]
            created_resources["fsms"].append(fsm_id)
            transaction['fullPath'] = transaction['fullPath'].replace(
                '{fsm_id}',
                fsm_id
            )
    else:
        fsm_id = created_resources["fsms"][0]
        transaction['fullPath'] = transaction['fullPath'].replace(
            '{fsm_id}',
            fsm_id
        )


@hooks.before("Export > Export FSM")
def before_export_fsm(transaction):
    """Set up FSM for export test."""
    if created_resources["fsms"]:
        fsm_id = created_resources["fsms"][0]
        transaction['fullPath'] = transaction['fullPath'].replace(
            '{fsm_id}',
            fsm_id
        )
    else:
        transaction['skip'] = True


@hooks.before_validation
def add_custom_headers(transaction):
    """Add custom headers to all requests."""
    transaction['request']['headers']['User-Agent'] = 'Dredd Contract Tests'
    transaction['request']['headers']['X-Test-Type'] = 'Contract'


# Skip endpoints that require authentication (Phase 4)
@hooks.before("Users > *")
def skip_user_endpoints(transaction):
    """Skip user endpoints in Phase 1-3."""
    transaction['skip'] = True


@hooks.before("Auth > *")
def skip_auth_endpoints(transaction):
    """Skip auth endpoints in Phase 1-3."""
    transaction['skip'] = True
