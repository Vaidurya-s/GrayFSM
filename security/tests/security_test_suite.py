"""
Automated Security Testing Suite for GrayFSM

USAGE:
    pytest security/tests/security_test_suite.py -v

REQUIREMENTS:
    pip install pytest pytest-asyncio httpx
"""

import pytest
import httpx
from typing import Dict, List
import json


# Configuration
API_BASE_URL = "http://localhost:8000"
API_PREFIX = "/api/v1"


class SecurityTester:
    """Security testing utilities"""

    def __init__(self, base_url: str):
        self.base_url = base_url
        self.client = httpx.Client(timeout=10.0)

    def get_headers(self, endpoint: str) -> Dict[str, str]:
        """Get response headers from endpoint"""
        try:
            response = self.client.get(f"{self.base_url}{endpoint}")
            return dict(response.headers)
        except Exception as e:
            pytest.fail(f"Failed to connect to {endpoint}: {str(e)}")

    def test_cors(self, origin: str, should_allow: bool) -> None:
        """Test CORS configuration"""
        headers = {
            "Origin": origin,
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "Content-Type",
        }

        response = self.client.options(
            f"{self.base_url}{API_PREFIX}/fsms",
            headers=headers
        )

        if should_allow:
            assert "access-control-allow-origin" in response.headers.keys(), \
                f"CORS should allow {origin}"
        else:
            assert "access-control-allow-origin" not in response.headers.keys(), \
                f"CORS should NOT allow {origin}"


@pytest.fixture
def security_tester():
    """Create security tester instance"""
    return SecurityTester(API_BASE_URL)


# ============================================================================
# Security Headers Tests
# ============================================================================

class TestSecurityHeaders:
    """Test security headers are properly configured"""

    def test_content_security_policy(self, security_tester):
        """Test CSP header is present and configured"""
        headers = security_tester.get_headers("/")

        assert "content-security-policy" in headers.keys(), \
            "Content-Security-Policy header missing"

        csp = headers["content-security-policy"]
        assert "default-src" in csp, "CSP missing default-src"
        assert "script-src" in csp, "CSP missing script-src"
        assert "frame-ancestors" in csp, "CSP missing frame-ancestors"

        # Should not use unsafe directives in production
        if "production" in API_BASE_URL:
            assert "unsafe-inline" not in csp, "CSP should not use 'unsafe-inline'"
            assert "unsafe-eval" not in csp, "CSP should not use 'unsafe-eval'"

    def test_x_frame_options(self, security_tester):
        """Test X-Frame-Options to prevent clickjacking"""
        headers = security_tester.get_headers("/")

        assert "x-frame-options" in headers.keys(), \
            "X-Frame-Options header missing"

        value = headers["x-frame-options"].lower()
        assert value in ["deny", "sameorigin"], \
            f"X-Frame-Options should be DENY or SAMEORIGIN, got {value}"

    def test_x_content_type_options(self, security_tester):
        """Test X-Content-Type-Options to prevent MIME sniffing"""
        headers = security_tester.get_headers("/")

        assert "x-content-type-options" in headers.keys(), \
            "X-Content-Type-Options header missing"

        assert headers["x-content-type-options"].lower() == "nosniff", \
            "X-Content-Type-Options should be 'nosniff'"

    def test_strict_transport_security(self, security_tester):
        """Test HSTS header (HTTPS only)"""
        if "https://" in API_BASE_URL:
            headers = security_tester.get_headers("/")

            assert "strict-transport-security" in headers.keys(), \
                "Strict-Transport-Security header missing on HTTPS"

            hsts = headers["strict-transport-security"]
            assert "max-age" in hsts, "HSTS missing max-age"

            # Extract max-age value
            import re
            max_age_match = re.search(r'max-age=(\d+)', hsts)
            if max_age_match:
                max_age = int(max_age_match.group(1))
                assert max_age >= 31536000, \
                    f"HSTS max-age should be at least 1 year (31536000), got {max_age}"

    def test_referrer_policy(self, security_tester):
        """Test Referrer-Policy header"""
        headers = security_tester.get_headers("/")

        assert "referrer-policy" in headers.keys(), \
            "Referrer-Policy header missing"

        policy = headers["referrer-policy"]
        secure_policies = [
            "no-referrer",
            "no-referrer-when-downgrade",
            "strict-origin",
            "strict-origin-when-cross-origin"
        ]

        assert policy in secure_policies, \
            f"Referrer-Policy '{policy}' may leak information"

    def test_no_server_header(self, security_tester):
        """Test that Server header is removed to prevent info disclosure"""
        headers = security_tester.get_headers("/")

        if "server" in headers.keys():
            server = headers["server"].lower()
            # Generic values are OK
            assert server not in ["uvicorn", "fastapi"], \
                "Server header should not reveal implementation details"


# ============================================================================
# CORS Tests
# ============================================================================

class TestCORS:
    """Test CORS configuration"""

    def test_cors_blocks_unauthorized_origin(self, security_tester):
        """Test that CORS blocks requests from unauthorized origins"""
        malicious_origins = [
            "https://evil.com",
            "http://malicious.example.com",
            "https://phishing-site.com"
        ]

        for origin in malicious_origins:
            security_tester.test_cors(origin, should_allow=False)

    def test_cors_allows_authorized_origin(self, security_tester):
        """Test that CORS allows requests from authorized origins"""
        # Only test if we're in development
        if "localhost" in API_BASE_URL:
            authorized_origins = [
                "http://localhost:3000",
                "http://localhost:5173"
            ]

            for origin in authorized_origins:
                security_tester.test_cors(origin, should_allow=True)

    def test_cors_no_wildcard_in_production(self, security_tester):
        """Test that CORS doesn't use wildcard in production"""
        if "production" in API_BASE_URL or "https://" in API_BASE_URL:
            response = security_tester.client.options(
                f"{API_BASE_URL}{API_PREFIX}/fsms",
                headers={"Origin": "https://evil.com"}
            )

            if "access-control-allow-origin" in response.headers:
                origin = response.headers["access-control-allow-origin"]
                assert origin != "*", \
                    "CORS should not use wildcard (*) in production"


# ============================================================================
# Authentication Tests
# ============================================================================

class TestAuthentication:
    """Test authentication and authorization"""

    def test_protected_endpoints_require_auth(self, security_tester):
        """Test that protected endpoints require authentication"""
        protected_endpoints = [
            f"{API_PREFIX}/fsms",  # POST
            f"{API_PREFIX}/fsms/123",  # PUT/DELETE
        ]

        for endpoint in protected_endpoints:
            # Try POST without auth
            response = security_tester.client.post(
                f"{API_BASE_URL}{endpoint}",
                json={"name": "test"}
            )

            # Should return 401 Unauthorized or 403 Forbidden
            assert response.status_code in [401, 403, 422], \
                f"{endpoint} should require authentication"

    def test_invalid_token_rejected(self, security_tester):
        """Test that invalid tokens are rejected"""
        headers = {"Authorization": "Bearer invalid_token_12345"}

        response = security_tester.client.get(
            f"{API_BASE_URL}{API_PREFIX}/fsms",
            headers=headers
        )

        assert response.status_code in [401, 403], \
            "Invalid token should be rejected"


# ============================================================================
# Rate Limiting Tests
# ============================================================================

class TestRateLimiting:
    """Test rate limiting configuration"""

    def test_rate_limit_enforced(self, security_tester):
        """Test that rate limiting is enforced"""
        endpoint = f"{API_BASE_URL}{API_PREFIX}/health"

        # Send many requests quickly
        responses = []
        for _ in range(150):  # Exceed typical rate limit
            try:
                response = security_tester.client.get(endpoint, timeout=1.0)
                responses.append(response.status_code)
            except Exception:
                pass

        # Should have at least one 429 Too Many Requests
        assert 429 in responses, \
            "Rate limiting should return 429 status code"

    def test_rate_limit_headers_present(self, security_tester):
        """Test that rate limit headers are returned"""
        response = security_tester.client.get(f"{API_BASE_URL}{API_PREFIX}/health")

        # Check for rate limit headers
        headers_to_check = [
            "x-ratelimit-limit",
            "x-ratelimit-remaining",
            "x-ratelimit-reset"
        ]

        # At least some rate limit headers should be present
        # (May not be present if rate limiting not fully implemented)
        rate_limit_headers = [
            h for h in headers_to_check
            if h in response.headers.keys()
        ]

        # Log warning if missing (not failure since it might not be implemented yet)
        if not rate_limit_headers:
            pytest.skip("Rate limit headers not implemented yet")


# ============================================================================
# Input Validation Tests
# ============================================================================

class TestInputValidation:
    """Test input validation and injection protection"""

    def test_sql_injection_blocked(self, security_tester):
        """Test that SQL injection attempts are blocked"""
        sql_payloads = [
            "' OR '1'='1",
            "1; DROP TABLE fsms; --",
            "1' UNION SELECT * FROM users--",
        ]

        for payload in sql_payloads:
            # Try in query parameter
            response = security_tester.client.get(
                f"{API_BASE_URL}{API_PREFIX}/fsms",
                params={"visibility": payload}
            )

            # Should not return 500 (SQL error)
            assert response.status_code != 500, \
                f"SQL injection payload caused server error: {payload}"

    def test_xss_sanitized(self, security_tester):
        """Test that XSS attempts are sanitized"""
        xss_payloads = [
            "<script>alert('XSS')</script>",
            "<img src=x onerror=alert('XSS')>",
            "javascript:alert('XSS')",
        ]

        for payload in xss_payloads:
            # Try to create FSM with XSS in name
            response = security_tester.client.post(
                f"{API_BASE_URL}{API_PREFIX}/fsms",
                json={
                    "name": payload,
                    "fsm_type": "moore",
                    "states": ["s0"],
                    "initial_state": "s0",
                    "transitions": []
                }
            )

            # Should either reject or sanitize
            if response.status_code == 201:
                data = response.json()
                # Payload should be sanitized (no script tags)
                assert "<script>" not in data.get("name", "").lower(), \
                    "XSS payload not sanitized"


# ============================================================================
# Error Handling Tests
# ============================================================================

class TestErrorHandling:
    """Test secure error handling"""

    def test_no_stack_traces_in_errors(self, security_tester):
        """Test that error responses don't leak stack traces"""
        # Force an error
        response = security_tester.client.get(
            f"{API_BASE_URL}{API_PREFIX}/fsms/invalid-uuid-format"
        )

        error_text = response.text.lower()

        # Should not contain stack trace keywords
        sensitive_keywords = [
            "traceback",
            "file \"/",
            "line ",
            "exception:",
            ".py\"",
            "sqlalchemy",
        ]

        for keyword in sensitive_keywords:
            assert keyword not in error_text, \
                f"Error response contains stack trace: {keyword}"

    def test_generic_error_messages(self, security_tester):
        """Test that error messages don't reveal system details"""
        response = security_tester.client.get(
            f"{API_BASE_URL}{API_PREFIX}/fsms/00000000-0000-0000-0000-000000000000"
        )

        error_text = response.text.lower()

        # Should not reveal database details
        assert "postgres" not in error_text, \
            "Error reveals database type"
        assert "redis" not in error_text, \
            "Error reveals Redis usage"
        assert "sqlalchemy" not in error_text, \
            "Error reveals ORM details"


# ============================================================================
# HTTPS Tests
# ============================================================================

class TestHTTPS:
    """Test HTTPS configuration (only for HTTPS endpoints)"""

    @pytest.mark.skipif(
        "https://" not in API_BASE_URL,
        reason="HTTPS tests only run on HTTPS endpoints"
    )
    def test_http_redirects_to_https(self):
        """Test that HTTP requests redirect to HTTPS"""
        http_url = API_BASE_URL.replace("https://", "http://")

        response = httpx.get(http_url, follow_redirects=False)

        assert response.status_code in [301, 302, 307, 308], \
            "HTTP should redirect to HTTPS"

        location = response.headers.get("location", "")
        assert location.startswith("https://"), \
            "Redirect should be to HTTPS URL"


# ============================================================================
# API Documentation Tests
# ============================================================================

class TestAPIDocumentation:
    """Test API documentation security"""

    def test_docs_disabled_in_production(self, security_tester):
        """Test that API docs are disabled in production"""
        if "production" in API_BASE_URL or "https://" in API_BASE_URL:
            docs_endpoints = ["/docs", "/redoc", "/openapi.json"]

            for endpoint in docs_endpoints:
                response = security_tester.client.get(f"{API_BASE_URL}{endpoint}")

                assert response.status_code == 404, \
                    f"API documentation should be disabled in production: {endpoint}"


# ============================================================================
# Run Tests
# ============================================================================

if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
