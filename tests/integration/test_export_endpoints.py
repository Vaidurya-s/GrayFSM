"""
Integration Tests for Export Endpoints

Tests FSM export functionality (Verilog, VHDL, JSON, CSV, testbenches).
"""

import pytest
import re


@pytest.mark.integration
@pytest.mark.database
@pytest.mark.asyncio
class TestExportEndpoints:
    """Test suite for FSM export operations."""

    async def test_export_verilog(self, auth_client, created_fsm, export_request_verilog):
        """Test exporting FSM to Verilog."""
        fsm_id = created_fsm["id"]
        response = await auth_client.post(
            f"/fsms/{fsm_id}/export",
            json=export_request_verilog
        )

        assert response.status_code == 200
        data = response.json()

        assert data["success"] is True
        assert data["data"]["format"] == "verilog"
        assert "content" in data["data"]
        assert len(data["data"]["content"]) > 0

        # Verify Verilog syntax
        content = data["data"]["content"]
        assert "module" in content
        assert "endmodule" in content
        assert "always" in content or "assign" in content
        assert "input" in content or "output" in content

    async def test_export_vhdl(self, auth_client, created_fsm, export_request_vhdl):
        """Test exporting FSM to VHDL."""
        fsm_id = created_fsm["id"]
        response = await auth_client.post(
            f"/fsms/{fsm_id}/export",
            json=export_request_vhdl
        )

        assert response.status_code == 200
        data = response.json()

        assert data["success"] is True
        assert data["data"]["format"] == "vhdl"

        # Verify VHDL syntax
        content = data["data"]["content"]
        assert "entity" in content.lower()
        assert "architecture" in content.lower()
        assert "process" in content.lower() or "signal" in content.lower()

    async def test_export_json(self, auth_client, created_fsm):
        """Test exporting FSM to JSON."""
        fsm_id = created_fsm["id"]
        export_request = {
            "format": "json",
            "options": {}
        }

        response = await auth_client.post(
            f"/fsms/{fsm_id}/export",
            json=export_request
        )

        assert response.status_code == 200
        data = response.json()

        assert data["success"] is True
        assert data["data"]["format"] == "json"

        # Parse exported JSON
        import json
        exported_fsm = json.loads(data["data"]["content"])
        assert "states" in exported_fsm
        assert "transitions" in exported_fsm

    async def test_export_csv(self, auth_client, created_fsm):
        """Test exporting FSM to CSV."""
        fsm_id = created_fsm["id"]
        export_request = {
            "format": "csv",
            "options": {}
        }

        response = await auth_client.post(
            f"/fsms/{fsm_id}/export",
            json=export_request
        )

        assert response.status_code == 200
        data = response.json()

        assert data["success"] is True
        assert data["data"]["format"] == "csv"

        # Verify CSV format
        content = data["data"]["content"]
        lines = content.strip().split('\n')
        assert len(lines) > 1  # At least header + 1 row
        assert ',' in lines[0]  # CSV delimiter

    async def test_export_testbench(self, auth_client, optimized_fsm):
        """Test generating testbench for optimized FSM."""
        fsm_id = optimized_fsm["optimized_fsm_id"]
        export_request = {
            "format": "testbench",
            "options": {
                "include_comments": True,
                "style": "standard"
            }
        }

        response = await auth_client.post(
            f"/fsms/{fsm_id}/export",
            json=export_request
        )

        assert response.status_code == 200
        data = response.json()

        content = data["data"]["content"]
        # Verify testbench structure
        assert "testbench" in content.lower() or "tb_" in content.lower()
        assert "initial" in content or "process" in content.lower()

    async def test_export_with_custom_module_name(self, auth_client, created_fsm):
        """Test export with custom module name."""
        fsm_id = created_fsm["id"]
        export_request = {
            "format": "verilog",
            "options": {
                "module_name": "custom_fsm_module",
                "include_comments": True
            }
        }

        response = await auth_client.post(
            f"/fsms/{fsm_id}/export",
            json=export_request
        )

        assert response.status_code == 200
        content = response.json()["data"]["content"]
        assert "custom_fsm_module" in content

    async def test_export_without_comments(self, auth_client, created_fsm):
        """Test export without comments."""
        fsm_id = created_fsm["id"]
        export_request = {
            "format": "verilog",
            "options": {
                "include_comments": False
            }
        }

        response = await auth_client.post(
            f"/fsms/{fsm_id}/export",
            json=export_request
        )

        assert response.status_code == 200
        content = response.json()["data"]["content"]

        # Count comment lines (should be minimal)
        comment_lines = [line for line in content.split('\n') if line.strip().startswith('//')]
        assert len(comment_lines) < 5  # Few to no comments

    async def test_export_different_styles(self, auth_client, created_fsm):
        """Test different export styles."""
        fsm_id = created_fsm["id"]

        for style in ["standard", "compact", "verbose"]:
            export_request = {
                "format": "verilog",
                "options": {"style": style}
            }

            response = await auth_client.post(
                f"/fsms/{fsm_id}/export",
                json=export_request
            )

            assert response.status_code == 200
            assert response.json()["success"] is True

    async def test_export_invalid_format(self, auth_client, created_fsm):
        """Test export with invalid format."""
        fsm_id = created_fsm["id"]
        export_request = {
            "format": "invalid_format",
            "options": {}
        }

        response = await auth_client.post(
            f"/fsms/{fsm_id}/export",
            json=export_request
        )

        assert response.status_code == 422

    async def test_get_cached_export(self, auth_client, created_fsm, export_request_verilog):
        """Test retrieving cached export."""
        fsm_id = created_fsm["id"]

        # Generate export
        create_response = await auth_client.post(
            f"/fsms/{fsm_id}/export",
            json=export_request_verilog
        )
        assert create_response.status_code == 200

        # Retrieve cached export
        get_response = await auth_client.get(f"/fsms/{fsm_id}/export/verilog")

        assert get_response.status_code == 200
        assert get_response.headers["content-type"] == "text/plain; charset=utf-8"

    async def test_export_file_size(self, auth_client, created_fsm, export_request_verilog):
        """Test that export includes file size metadata."""
        fsm_id = created_fsm["id"]
        response = await auth_client.post(
            f"/fsms/{fsm_id}/export",
            json=export_request_verilog
        )

        assert response.status_code == 200
        data = response.json()

        assert "file_size_bytes" in data["data"]
        assert data["data"]["file_size_bytes"] > 0
        assert data["data"]["file_size_bytes"] == len(data["data"]["content"])

    async def test_verilog_syntax_validity(self, auth_client, created_fsm, export_request_verilog):
        """Test that generated Verilog has valid syntax."""
        fsm_id = created_fsm["id"]
        response = await auth_client.post(
            f"/fsms/{fsm_id}/export",
            json=export_request_verilog
        )

        content = response.json()["data"]["content"]

        # Basic syntax checks — use word-boundary regex so "endmodule" isn't double-counted
        assert len(re.findall(r'\bmodule\b', content)) == content.count("endmodule")
        assert content.count("begin") <= content.count("end")

        # Check for required sections
        assert re.search(r"module\s+\w+", content)
        assert re.search(r"input\s+(wire|reg|\w+)", content) or "input" in content
        assert re.search(r"output\s+(wire|reg|\w+)", content) or "output" in content

    async def test_concurrent_exports(self, auth_client, created_fsm):
        """Test concurrent export requests."""
        import asyncio

        fsm_id = created_fsm["id"]

        async def export_format(format_type):
            export_request = {"format": format_type, "options": {}}
            return await auth_client.post(f"/fsms/{fsm_id}/export", json=export_request)

        # Export multiple formats concurrently
        tasks = [
            export_format("verilog"),
            export_format("vhdl"),
            export_format("json"),
            export_format("csv")
        ]

        responses = await asyncio.gather(*tasks)

        # All should succeed
        for response in responses:
            assert response.status_code == 200

    async def test_export_optimized_vs_original(self, auth_client, created_fsm, optimization_request_greedy):
        """Test that optimized FSM exports include dummy states."""
        fsm_id = created_fsm["id"]

        # Export original
        original_export = await auth_client.post(
            f"/fsms/{fsm_id}/export",
            json={"format": "json", "options": {}}
        )

        # Optimize FSM
        opt_response = await auth_client.post(
            f"/fsms/{fsm_id}/optimize",
            json=optimization_request_greedy
        )
        optimized_fsm_id = opt_response.json()["data"]["optimized_fsm_id"]

        # Export optimized
        optimized_export = await auth_client.post(
            f"/fsms/{optimized_fsm_id}/export",
            json={"format": "json", "options": {}}
        )

        import json
        original_data = json.loads(original_export.json()["data"]["content"])
        optimized_data = json.loads(optimized_export.json()["data"]["content"])

        # Optimized should have more states (including dummy states)
        assert len(optimized_data["states"]) >= len(original_data["states"])
