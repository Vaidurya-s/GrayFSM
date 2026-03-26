"""
Locust Load Testing Configuration

Load testing scenarios for the GrayFSM API.

Run with: locust -f locustfile.py --host=http://localhost:8000
"""

from locust import HttpUser, task, between, events
from locust.contrib.fasthttp import FastHttpUser
import json
import random
from uuid import uuid4


class GrayFSMUser(FastHttpUser):
    """Base user class for GrayFSM load testing."""

    host = "http://localhost:8000"
    wait_time = between(1, 3)

    # Store created FSM IDs
    fsm_ids = []
    optimized_fsm_ids = []

    def on_start(self):
        """Called when a simulated user starts."""
        self.client.headers['Content-Type'] = 'application/json'

    def on_stop(self):
        """Called when a simulated user stops."""
        # Clean up created FSMs
        for fsm_id in self.fsm_ids:
            self.client.delete(f"/api/v1/fsms/{fsm_id}")

    def _generate_fsm(self, num_states=4):
        """Generate a random FSM for testing."""
        states = [f"S{i}" for i in range(num_states)]
        transitions = []

        for i in range(num_states):
            transitions.append({
                "from_state": f"S{i}",
                "to_state": f"S{(i + 1) % num_states}",
                "input": "next"
            })

        outputs = {f"S{i}": format(i, f'0{len(bin(num_states-1)[2:])}b') for i in range(num_states)}

        return {
            "name": f"Test FSM {uuid4().hex[:8]}",
            "description": "Load test FSM",
            "fsm_type": "moore",
            "states": states,
            "initial_state": "S0",
            "transitions": transitions,
            "outputs": outputs,
            "visibility": "private",
            "tags": ["load-test"]
        }


class ReadHeavyUser(GrayFSMUser):
    """User performing mostly read operations (80% reads, 20% writes)."""

    @task(8)
    def list_fsms(self):
        """List FSMs with pagination."""
        page = random.randint(1, 10)
        self.client.get(
            f"/api/v1/fsms?page={page}&page_size=20",
            name="/api/v1/fsms [LIST]"
        )

    @task(4)
    def get_fsm(self):
        """Get a specific FSM."""
        if self.fsm_ids:
            fsm_id = random.choice(self.fsm_ids)
            self.client.get(
                f"/api/v1/fsms/{fsm_id}",
                name="/api/v1/fsms/{id} [GET]"
            )

    @task(4)
    def get_examples(self):
        """Get example FSMs."""
        self.client.get("/api/v1/examples", name="/api/v1/examples [GET]")

    @task(2)
    def create_fsm(self):
        """Create a new FSM."""
        fsm_data = self._generate_fsm(num_states=random.randint(4, 8))
        response = self.client.post(
            "/api/v1/fsms",
            json=fsm_data,
            name="/api/v1/fsms [POST]"
        )

        if response.status_code == 201:
            data = response.json()
            if "data" in data and "id" in data["data"]:
                self.fsm_ids.append(data["data"]["id"])

    @task(1)
    def health_check(self):
        """Check API health."""
        self.client.get("/api/v1/health", name="/api/v1/health [GET]")


class OptimizationHeavyUser(GrayFSMUser):
    """User performing heavy optimization operations."""

    @task(5)
    def create_and_optimize(self):
        """Create FSM and immediately optimize it."""
        # Create FSM
        fsm_data = self._generate_fsm(num_states=random.randint(4, 12))
        create_response = self.client.post(
            "/api/v1/fsms",
            json=fsm_data,
            name="/api/v1/fsms [POST]"
        )

        if create_response.status_code == 201:
            data = create_response.json()
            fsm_id = data["data"]["id"]
            self.fsm_ids.append(fsm_id)

            # Optimize with greedy algorithm
            opt_request = {
                "algorithm": "greedy",
                "async": False,
                "options": {"timeout_ms": 5000}
            }

            opt_response = self.client.post(
                f"/api/v1/fsms/{fsm_id}/optimize",
                json=opt_request,
                name="/api/v1/fsms/{id}/optimize [POST]"
            )

            if opt_response.status_code == 200:
                opt_data = opt_response.json()
                if "data" in opt_data and "optimized_fsm_id" in opt_data["data"]:
                    self.optimized_fsm_ids.append(opt_data["data"]["optimized_fsm_id"])

    @task(3)
    def compare_algorithms(self):
        """Compare multiple optimization algorithms."""
        if self.fsm_ids:
            fsm_id = random.choice(self.fsm_ids)
            compare_request = {
                "algorithms": ["greedy", "bfs_optimal"],
                "options": {"timeout_ms": 10000}
            }

            self.client.post(
                f"/api/v1/fsms/{fsm_id}/compare",
                json=compare_request,
                name="/api/v1/fsms/{id}/compare [POST]"
            )

    @task(2)
    def get_optimization_results(self):
        """Get optimization results for an FSM."""
        if self.fsm_ids:
            fsm_id = random.choice(self.fsm_ids)
            self.client.get(
                f"/api/v1/fsms/{fsm_id}/results",
                name="/api/v1/fsms/{id}/results [GET]"
            )


class ExportHeavyUser(GrayFSMUser):
    """User performing heavy export operations."""

    @task(4)
    def export_verilog(self):
        """Export FSM to Verilog."""
        if self.fsm_ids:
            fsm_id = random.choice(self.fsm_ids)
            export_request = {
                "format": "verilog",
                "options": {
                    "module_name": "test_fsm",
                    "include_comments": True
                }
            }

            self.client.post(
                f"/api/v1/fsms/{fsm_id}/export",
                json=export_request,
                name="/api/v1/fsms/{id}/export [POST]"
            )

    @task(2)
    def export_vhdl(self):
        """Export FSM to VHDL."""
        if self.fsm_ids:
            fsm_id = random.choice(self.fsm_ids)
            export_request = {
                "format": "vhdl",
                "options": {"include_comments": True}
            }

            self.client.post(
                f"/api/v1/fsms/{fsm_id}/export",
                json=export_request,
                name="/api/v1/fsms/{id}/export [POST]"
            )

    @task(2)
    def export_json(self):
        """Export FSM to JSON."""
        if self.fsm_ids:
            fsm_id = random.choice(self.fsm_ids)
            export_request = {"format": "json", "options": {}}

            self.client.post(
                f"/api/v1/fsms/{fsm_id}/export",
                json=export_request,
                name="/api/v1/fsms/{id}/export [POST]"
            )

    @task(1)
    def get_cached_export(self):
        """Get cached export."""
        if self.fsm_ids:
            fsm_id = random.choice(self.fsm_ids)
            format_type = random.choice(["verilog", "vhdl", "json"])

            self.client.get(
                f"/api/v1/fsms/{fsm_id}/export/{format_type}",
                name="/api/v1/fsms/{id}/export/{format} [GET]"
            )


class MixedWorkloadUser(GrayFSMUser):
    """User with mixed workload - realistic usage pattern."""

    @task(10)
    def browse_fsms(self):
        """Browse FSMs."""
        self.client.get(
            f"/api/v1/fsms?page={random.randint(1, 5)}&page_size=20",
            name="/api/v1/fsms [LIST]"
        )

    @task(3)
    def create_fsm(self):
        """Create a new FSM."""
        fsm_data = self._generate_fsm(num_states=random.randint(4, 8))
        response = self.client.post(
            "/api/v1/fsms",
            json=fsm_data,
            name="/api/v1/fsms [POST]"
        )

        if response.status_code == 201:
            data = response.json()
            self.fsm_ids.append(data["data"]["id"])

    @task(5)
    def optimize_fsm(self):
        """Optimize an FSM."""
        if self.fsm_ids:
            fsm_id = random.choice(self.fsm_ids)
            opt_request = {
                "algorithm": "greedy",
                "async": False,
                "options": {"timeout_ms": 5000}
            }

            self.client.post(
                f"/api/v1/fsms/{fsm_id}/optimize",
                json=opt_request,
                name="/api/v1/fsms/{id}/optimize [POST]"
            )

    @task(2)
    def export_fsm(self):
        """Export an FSM."""
        if self.fsm_ids:
            fsm_id = random.choice(self.fsm_ids)
            format_type = random.choice(["verilog", "vhdl", "json"])
            export_request = {"format": format_type, "options": {}}

            self.client.post(
                f"/api/v1/fsms/{fsm_id}/export",
                json=export_request,
                name="/api/v1/fsms/{id}/export [POST]"
            )

    @task(2)
    def update_fsm(self):
        """Update an FSM."""
        if self.fsm_ids:
            fsm_id = random.choice(self.fsm_ids)
            update_data = {
                "name": f"Updated FSM {uuid4().hex[:8]}",
                "description": "Updated description"
            }

            self.client.put(
                f"/api/v1/fsms/{fsm_id}",
                json=update_data,
                name="/api/v1/fsms/{id} [PUT]"
            )

    @task(1)
    def fork_fsm(self):
        """Fork an FSM."""
        if self.fsm_ids:
            fsm_id = random.choice(self.fsm_ids)
            fork_data = {"name": f"Forked FSM {uuid4().hex[:8]}"}

            response = self.client.post(
                f"/api/v1/fsms/{fsm_id}/fork",
                json=fork_data,
                name="/api/v1/fsms/{id}/fork [POST]"
            )

            if response.status_code == 201:
                data = response.json()
                self.fsm_ids.append(data["data"]["id"])


# Event hooks for custom metrics
@events.test_start.add_listener
def on_test_start(environment, **kwargs):
    """Called when the load test starts."""
    print("Load test starting...")
    print(f"Host: {environment.host}")


@events.test_stop.add_listener
def on_test_stop(environment, **kwargs):
    """Called when the load test stops."""
    print("Load test completed.")
    print(f"Total requests: {environment.stats.total.num_requests}")
    print(f"Total failures: {environment.stats.total.num_failures}")


@events.request.add_listener
def on_request(request_type, name, response_time, response_length, exception, context, **kwargs):
    """Called for every request."""
    # Log slow requests (> 2 seconds)
    if response_time > 2000:
        print(f"Slow request detected: {name} took {response_time}ms")
