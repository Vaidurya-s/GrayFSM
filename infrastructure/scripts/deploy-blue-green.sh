#!/bin/bash
# Blue-Green Deployment Script for GrayFSM
# This script implements blue-green deployment strategy for zero-downtime updates

set -e

# Configuration
NAMESPACE=${NAMESPACE:-grayfsm}
BACKEND_BLUE="grayfsm-backend-blue"
BACKEND_GREEN="grayfsm-backend-green"
BACKEND_SERVICE="grayfsm-backend"
NEW_IMAGE=${NEW_IMAGE:-""}
HEALTH_CHECK_URL=${HEALTH_CHECK_URL:-"http://localhost:8000/api/v1/health"}
HEALTH_CHECK_RETRIES=${HEALTH_CHECK_RETRIES:-30}
HEALTH_CHECK_WAIT=${HEALTH_CHECK_WAIT:-10}

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Logging functions
log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1" >&2
    exit 1
}

warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

# Check prerequisites
check_prerequisites() {
    log "Checking prerequisites..."

    if ! command -v kubectl &> /dev/null; then
        error "kubectl not found. Please install kubectl."
    fi

    if [ -z "$NEW_IMAGE" ]; then
        error "NEW_IMAGE environment variable not set"
    fi

    log "Prerequisites check passed"
}

# Get current active slot
get_active_slot() {
    local service_selector=$(kubectl get svc "$BACKEND_SERVICE" -n "$NAMESPACE" -o jsonpath='{.spec.selector.slot}')
    echo "$service_selector"
}

# Get inactive slot
get_inactive_slot() {
    local active_slot=$(get_active_slot)
    if [ "$active_slot" = "blue" ]; then
        echo "green"
    else
        echo "blue"
    fi
}

# Update deployment image
update_deployment_image() {
    local deployment=$1
    local image=$2

    log "Updating deployment $deployment with image $image..."
    kubectl set image deployment/"$deployment" \
        -n "$NAMESPACE" \
        backend="$image" \
        --record

    log "Image updated for $deployment"
}

# Wait for deployment rollout
wait_for_rollout() {
    local deployment=$1
    local timeout=${2:-600}

    log "Waiting for rollout of $deployment (timeout: ${timeout}s)..."
    if kubectl rollout status deployment/"$deployment" \
        -n "$NAMESPACE" \
        --timeout="${timeout}s"; then
        log "Rollout completed for $deployment"
        return 0
    else
        error "Rollout failed or timed out for $deployment"
    fi
}

# Health check for deployment
health_check() {
    local deployment=$1
    local retries=${2:-$HEALTH_CHECK_RETRIES}
    local wait=${3:-$HEALTH_CHECK_WAIT}

    log "Running health checks for $deployment..."

    # Get pod names
    local pods=$(kubectl get pods -n "$NAMESPACE" \
        -l app=grayfsm,component=backend,slot="$(echo $deployment | grep -o 'blue\|green')" \
        -o jsonpath='{.items[*].metadata.name}')

    if [ -z "$pods" ]; then
        error "No pods found for $deployment"
    fi

    for pod in $pods; do
        log "Health checking pod: $pod"
        local attempt=0
        local healthy=false

        while [ $attempt -lt "$retries" ]; do
            if kubectl exec -n "$NAMESPACE" "$pod" -- curl -f -s "$HEALTH_CHECK_URL" > /dev/null 2>&1; then
                log "Pod $pod is healthy"
                healthy=true
                break
            fi

            attempt=$((attempt + 1))
            if [ $attempt -lt "$retries" ]; then
                warning "Health check failed for $pod, retrying in ${wait}s (attempt $attempt/$retries)"
                sleep "$wait"
            fi
        done

        if [ "$healthy" = false ]; then
            error "Health check failed for pod $pod after $retries attempts"
        fi
    done

    log "All health checks passed for $deployment"
}

# Switch traffic to new deployment
switch_traffic() {
    local target_slot=$1

    log "Switching traffic to slot: $target_slot..."

    kubectl patch service "$BACKEND_SERVICE" \
        -n "$NAMESPACE" \
        -p '{"spec":{"selector":{"slot":"'"$target_slot"'"}}}'

    log "Traffic switched to $target_slot"
}

# Rollback to previous deployment
rollback() {
    local previous_slot=$(get_active_slot)

    warning "Rolling back to slot: $previous_slot..."

    switch_traffic "$previous_slot"

    warning "Rollback completed - traffic switched back to $previous_slot"
}

# Main deployment flow
main() {
    log "Starting Blue-Green Deployment"
    log "=================================="

    check_prerequisites

    local active_slot=$(get_active_slot)
    local inactive_slot=$(get_inactive_slot)

    log "Active slot: $active_slot"
    log "Inactive slot: $inactive_slot"

    local target_deployment=""
    if [ "$inactive_slot" = "blue" ]; then
        target_deployment="$BACKEND_BLUE"
    else
        target_deployment="$BACKEND_GREEN"
    fi

    log "Target deployment: $target_deployment"

    # Update image on inactive deployment
    update_deployment_image "$target_deployment" "$NEW_IMAGE"

    # Wait for rollout
    wait_for_rollout "$target_deployment"

    # Run health checks
    if health_check "$target_deployment"; then
        # Switch traffic
        switch_traffic "$inactive_slot"
        log "Blue-Green Deployment completed successfully!"
        log "Traffic is now routed to $inactive_slot deployment"
    else
        error "Health checks failed - not switching traffic"
    fi
}

# Trap errors and cleanup
trap 'error "Deployment failed"' ERR

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --namespace)
            NAMESPACE="$2"
            shift 2
            ;;
        --image)
            NEW_IMAGE="$2"
            shift 2
            ;;
        --health-check-url)
            HEALTH_CHECK_URL="$2"
            shift 2
            ;;
        --rollback)
            log "Running rollback..."
            rollback
            exit 0
            ;;
        *)
            error "Unknown option: $1"
            ;;
    esac
done

main
