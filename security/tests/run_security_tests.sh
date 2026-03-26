#!/bin/bash
#
# Automated Security Testing Script for GrayFSM
#
# USAGE:
#   ./security/tests/run_security_tests.sh [environment]
#
# EXAMPLES:
#   ./security/tests/run_security_tests.sh development
#   ./security/tests/run_security_tests.sh production

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Default environment
ENVIRONMENT=${1:-development}

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}GrayFSM Security Testing Suite${NC}"
echo -e "${GREEN}Environment: ${ENVIRONMENT}${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""

# Set API URL based on environment
case $ENVIRONMENT in
  development)
    export API_BASE_URL="http://localhost:8000"
    ;;
  staging)
    export API_BASE_URL="https://staging-api.grayfsm.com"
    ;;
  production)
    export API_BASE_URL="https://api.grayfsm.com"
    ;;
  *)
    echo -e "${RED}Invalid environment: ${ENVIRONMENT}${NC}"
    echo "Valid options: development, staging, production"
    exit 1
    ;;
esac

echo -e "${YELLOW}Testing API at: ${API_BASE_URL}${NC}"
echo ""

# Create reports directory
REPORT_DIR="security/tests/reports"
mkdir -p "$REPORT_DIR"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
REPORT_FILE="${REPORT_DIR}/security_test_${ENVIRONMENT}_${TIMESTAMP}.html"

# ============================================================================
# 1. Dependency Vulnerability Scanning
# ============================================================================

echo -e "${YELLOW}[1/7] Running dependency vulnerability scan...${NC}"

# Python dependencies
if command -v pip-audit &> /dev/null; then
    echo "Scanning Python dependencies..."
    cd backend
    pip-audit -r requirements.txt --format json > "../${REPORT_DIR}/pip-audit_${TIMESTAMP}.json" || true
    cd ..
    echo -e "${GREEN}✓ Python dependency scan complete${NC}"
else
    echo -e "${YELLOW}⚠ pip-audit not installed. Install with: pip install pip-audit${NC}"
fi

# Node.js dependencies
if [ -f "frontend/package.json" ]; then
    echo "Scanning Node.js dependencies..."
    cd frontend
    npm audit --json > "../${REPORT_DIR}/npm-audit_${TIMESTAMP}.json" || true
    cd ..
    echo -e "${GREEN}✓ Node.js dependency scan complete${NC}"
fi

echo ""

# ============================================================================
# 2. Security Headers Test
# ============================================================================

echo -e "${YELLOW}[2/7] Testing security headers...${NC}"

# Check if API is accessible
if curl -s --head --request GET "${API_BASE_URL}/api/v1/health" | grep "200" > /dev/null; then
    echo -e "${GREEN}✓ API is accessible${NC}"

    # Test security headers
    HEADERS=$(curl -I -s "${API_BASE_URL}")

    check_header() {
        HEADER_NAME=$1
        if echo "$HEADERS" | grep -i "^${HEADER_NAME}:" > /dev/null; then
            echo -e "${GREEN}✓ ${HEADER_NAME} present${NC}"
        else
            echo -e "${RED}✗ ${HEADER_NAME} missing${NC}"
        fi
    }

    check_header "Content-Security-Policy"
    check_header "X-Frame-Options"
    check_header "X-Content-Type-Options"
    check_header "Referrer-Policy"

    if [[ $API_BASE_URL == https://* ]]; then
        check_header "Strict-Transport-Security"
    fi

else
    echo -e "${RED}✗ API not accessible at ${API_BASE_URL}${NC}"
fi

echo ""

# ============================================================================
# 3. CORS Configuration Test
# ============================================================================

echo -e "${YELLOW}[3/7] Testing CORS configuration...${NC}"

# Test with malicious origin
CORS_TEST=$(curl -s -H "Origin: https://malicious.com" \
    -H "Access-Control-Request-Method: POST" \
    -X OPTIONS \
    "${API_BASE_URL}/api/v1/fsms" | grep -i "access-control-allow-origin" || true)

if [ -z "$CORS_TEST" ]; then
    echo -e "${GREEN}✓ CORS correctly blocks unauthorized origins${NC}"
else
    echo -e "${RED}✗ CORS allows unauthorized origin!${NC}"
fi

echo ""

# ============================================================================
# 4. Rate Limiting Test
# ============================================================================

echo -e "${YELLOW}[4/7] Testing rate limiting...${NC}"

# Send multiple requests
RATE_LIMIT_HIT=false
for i in {1..150}; do
    RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" "${API_BASE_URL}/api/v1/health")
    if [ "$RESPONSE" == "429" ]; then
        RATE_LIMIT_HIT=true
        break
    fi
done

if [ "$RATE_LIMIT_HIT" = true ]; then
    echo -e "${GREEN}✓ Rate limiting is enforced${NC}"
else
    echo -e "${YELLOW}⚠ Rate limiting not triggered (may need adjustment or not implemented)${NC}"
fi

echo ""

# ============================================================================
# 5. SSL/TLS Configuration Test
# ============================================================================

if [[ $API_BASE_URL == https://* ]]; then
    echo -e "${YELLOW}[5/7] Testing SSL/TLS configuration...${NC}"

    # Extract domain from URL
    DOMAIN=$(echo "$API_BASE_URL" | sed -e 's|^https://||' -e 's|/.*||')

    if command -v nmap &> /dev/null; then
        echo "Testing SSL ciphers with nmap..."
        nmap --script ssl-enum-ciphers -p 443 "$DOMAIN" > "${REPORT_DIR}/ssl-scan_${TIMESTAMP}.txt" || true
        echo -e "${GREEN}✓ SSL scan complete (see ${REPORT_DIR}/ssl-scan_${TIMESTAMP}.txt)${NC}"
    else
        echo -e "${YELLOW}⚠ nmap not installed. Install for SSL testing.${NC}"
    fi

    # Test SSL certificate
    if command -v openssl &> /dev/null; then
        echo "Checking SSL certificate..."
        echo | openssl s_client -servername "$DOMAIN" -connect "${DOMAIN}:443" 2>/dev/null | \
            openssl x509 -noout -dates > "${REPORT_DIR}/ssl-cert_${TIMESTAMP}.txt"
        echo -e "${GREEN}✓ SSL certificate info saved${NC}"
    fi
else
    echo -e "${YELLOW}[5/7] Skipping SSL/TLS tests (HTTP endpoint)${NC}"
fi

echo ""

# ============================================================================
# 6. Python Security Test Suite
# ============================================================================

echo -e "${YELLOW}[6/7] Running Python security test suite...${NC}"

if command -v pytest &> /dev/null; then
    export API_BASE_URL
    pytest security/tests/security_test_suite.py \
        -v \
        --html="${REPORT_FILE}" \
        --self-contained-html \
        || true
    echo -e "${GREEN}✓ Security tests complete (report: ${REPORT_FILE})${NC}"
else
    echo -e "${YELLOW}⚠ pytest not installed. Install with: pip install pytest pytest-html${NC}"
fi

echo ""

# ============================================================================
# 7. Secrets Scanning
# ============================================================================

echo -e "${YELLOW}[7/7] Scanning for leaked secrets...${NC}"

if command -v gitleaks &> /dev/null; then
    gitleaks detect --source . --report-path "${REPORT_DIR}/gitleaks_${TIMESTAMP}.json" || true
    echo -e "${GREEN}✓ Secrets scan complete${NC}"
else
    echo -e "${YELLOW}⚠ gitleaks not installed. Install from: https://github.com/gitleaks/gitleaks${NC}"
fi

echo ""

# ============================================================================
# Summary
# ============================================================================

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Security Testing Complete!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo "Reports saved to: ${REPORT_DIR}/"
echo ""
echo -e "${YELLOW}Next Steps:${NC}"
echo "1. Review test results in ${REPORT_FILE}"
echo "2. Check dependency scan results"
echo "3. Address any failed tests"
echo "4. Re-run tests after fixes"
echo ""

# Exit with non-zero if any critical tests failed
# (Add your own logic here based on test results)
exit 0
