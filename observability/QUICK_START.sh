#!/bin/bash
#
# GrayFSM Observability Stack - Quick Start Script
# Deploys the complete observability stack to Kubernetes
#

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
OBSERVABILITY_DIR="$SCRIPT_DIR"

echo "=================================================="
echo "GrayFSM Observability Stack Deployment"
echo "=================================================="
echo ""

# Color codes for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Functions
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

check_requirements() {
    log_info "Checking requirements..."

    # Check kubectl
    if ! command -v kubectl &> /dev/null; then
        log_error "kubectl not found. Please install kubectl."
        exit 1
    fi
    log_info "kubectl found: $(kubectl version --short --client)"

    # Check cluster connectivity
    if ! kubectl cluster-info &> /dev/null; then
        log_error "Cannot connect to Kubernetes cluster"
        exit 1
    fi
    log_info "Connected to Kubernetes cluster"

    # Check helm (optional)
    if command -v helm &> /dev/null; then
        log_info "helm found: $(helm version --short)"
    else
        log_warn "helm not found (optional, for Helm-based installation)"
    fi
}

create_namespaces() {
    log_info "Creating Kubernetes namespaces..."

    # Create observability namespace
    if kubectl get namespace observability &> /dev/null; then
        log_warn "Namespace 'observability' already exists"
    else
        kubectl create namespace observability
        log_info "Created namespace: observability"
    fi

    # Ensure grayfsm namespace exists
    if kubectl get namespace grayfsm &> /dev/null; then
        log_warn "Namespace 'grayfsm' already exists"
    else
        kubectl create namespace grayfsm
        log_info "Created namespace: grayfsm"
    fi

    # Ensure grayfsm-monitoring namespace exists
    if kubectl get namespace grayfsm-monitoring &> /dev/null; then
        log_warn "Namespace 'grayfsm-monitoring' already exists"
    else
        kubectl create namespace grayfsm-monitoring
        log_info "Created namespace: grayfsm-monitoring"
    fi
}

deploy_jaeger() {
    log_info "Deploying Jaeger (Distributed Tracing)..."

    if [ ! -f "$OBSERVABILITY_DIR/infrastructure/jaeger.yaml" ]; then
        log_error "jaeger.yaml not found at $OBSERVABILITY_DIR/infrastructure/jaeger.yaml"
        exit 1
    fi

    kubectl apply -f "$OBSERVABILITY_DIR/infrastructure/jaeger.yaml"
    log_info "Jaeger deployment submitted"

    # Wait for Jaeger to be ready
    log_info "Waiting for Jaeger deployment..."
    kubectl rollout status deployment/jaeger -n observability --timeout=300s || true
}

deploy_loki() {
    log_info "Deploying Loki (Log Aggregation)..."

    if [ ! -f "$OBSERVABILITY_DIR/infrastructure/loki.yaml" ]; then
        log_error "loki.yaml not found"
        exit 1
    fi

    kubectl apply -f "$OBSERVABILITY_DIR/infrastructure/loki.yaml"
    log_info "Loki deployment submitted"

    # Wait for Loki to be ready
    log_info "Waiting for Loki deployment..."
    kubectl rollout status deployment/loki -n observability --timeout=300s || true
}

deploy_grafana() {
    log_info "Deploying Grafana (Visualization)..."

    if [ ! -f "$OBSERVABILITY_DIR/infrastructure/grafana.yaml" ]; then
        log_error "grafana.yaml not found"
        exit 1
    fi

    kubectl apply -f "$OBSERVABILITY_DIR/infrastructure/grafana.yaml"
    log_info "Grafana deployment submitted"

    # Wait for Grafana to be ready
    log_info "Waiting for Grafana deployment..."
    kubectl rollout status deployment/grafana -n observability --timeout=300s || true
}

deploy_prometheus_config() {
    log_info "Updating Prometheus configuration..."

    if [ ! -f "$OBSERVABILITY_DIR/infrastructure/prometheus-ext.yaml" ]; then
        log_error "prometheus-ext.yaml not found"
        exit 1
    fi

    kubectl apply -f "$OBSERVABILITY_DIR/infrastructure/prometheus-ext.yaml"
    log_info "Prometheus configuration updated"
}

deploy_alert_config() {
    log_info "Deploying Alert rules and AlertManager..."

    if [ ! -f "$OBSERVABILITY_DIR/alerts/slo.yaml" ]; then
        log_error "slo.yaml not found"
        exit 1
    fi

    if [ ! -f "$OBSERVABILITY_DIR/alerts/alertmanager.yaml" ]; then
        log_error "alertmanager.yaml not found"
        exit 1
    fi

    kubectl apply -f "$OBSERVABILITY_DIR/alerts/slo.yaml"
    log_info "SLO rules deployed"

    kubectl apply -f "$OBSERVABILITY_DIR/alerts/alertmanager.yaml"
    log_info "AlertManager deployed"

    # Wait for AlertManager to be ready
    log_info "Waiting for AlertManager deployment..."
    kubectl rollout status deployment/alertmanager -n grayfsm-monitoring --timeout=300s || true
}

verify_deployment() {
    log_info "Verifying deployment..."

    echo ""
    log_info "Checking pod status:"
    echo ""

    echo "Observability namespace:"
    kubectl get pods -n observability

    echo ""
    echo "Monitoring namespace:"
    kubectl get pods -n grayfsm-monitoring || true

    echo ""
}

print_next_steps() {
    log_info "Deployment complete!"
    echo ""
    echo "=================================================="
    echo "Next Steps:"
    echo "=================================================="
    echo ""
    echo "1. Access Jaeger (Distributed Tracing):"
    echo "   kubectl port-forward -n observability svc/jaeger-ui 16686:16686"
    echo "   Open: http://localhost:16686"
    echo ""
    echo "2. Access Grafana (Dashboards):"
    echo "   kubectl port-forward -n observability svc/grafana 3000:3000"
    echo "   Open: http://localhost:3000"
    echo "   Default credentials: admin / GrayFSM2024!"
    echo ""
    echo "3. Access Prometheus (Metrics):"
    echo "   kubectl port-forward -n grayfsm-monitoring svc/prometheus 9090:9090"
    echo "   Open: http://localhost:9090"
    echo ""
    echo "4. Access AlertManager:"
    echo "   kubectl port-forward -n grayfsm-monitoring svc/alertmanager 9093:9093"
    echo "   Open: http://localhost:9093"
    echo ""
    echo "5. Integrate with Backend:"
    echo "   - Follow observability/INTEGRATION_GUIDE.md"
    echo "   - Add dependencies from observability/REQUIREMENTS.txt"
    echo "   - Configure telemetry in backend/app/main.py"
    echo ""
    echo "6. View Logs:"
    echo "   kubectl logs -f deployment/jaeger -n observability"
    echo "   kubectl logs -f deployment/loki -n observability"
    echo "   kubectl logs -f deployment/grafana -n observability"
    echo ""
    echo "Documentation:"
    echo "   - Setup: observability/docs/SETUP.md"
    echo "   - Dashboards: observability/docs/DASHBOARDS.md"
    echo "   - Runbooks: observability/docs/RUNBOOKS.md"
    echo ""
    echo "=================================================="
    echo ""
}

# Main execution
main() {
    log_info "Starting GrayFSM Observability Stack deployment..."
    echo ""

    check_requirements
    echo ""

    create_namespaces
    echo ""

    deploy_jaeger
    echo ""

    deploy_loki
    echo ""

    deploy_grafana
    echo ""

    deploy_prometheus_config
    echo ""

    deploy_alert_config
    echo ""

    verify_deployment
    echo ""

    print_next_steps
}

# Run main function
main "$@"
