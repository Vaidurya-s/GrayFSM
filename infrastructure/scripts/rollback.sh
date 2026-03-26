#!/bin/bash
# Rollback Script for GrayFSM
# This script handles emergency rollbacks to previous deployments

set -e

NAMESPACE=${NAMESPACE:-grayfsm}
BACKEND_SERVICE="grayfsm-backend"
FRONTEND_SERVICE="grayfsm-frontend"
DEPLOYMENT=${DEPLOYMENT:-backend}

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

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

# Get current deployment revision
get_current_revision() {
    local deployment=$1
    kubectl rollout history deployment/"$deployment" -n "$NAMESPACE" | tail -1 | awk '{print $1}'
}

# Rollback deployment
rollback_deployment() {
    local deployment=$1
    local target_revision=${2:-0}

    log "Rolling back $deployment..."

    if [ "$target_revision" -eq 0 ]; then
        log "Rolling back to previous revision"
        kubectl rollout undo deployment/"$deployment" -n "$NAMESPACE"
    else
        log "Rolling back to revision $target_revision"
        kubectl rollout undo deployment/"$deployment" \
            -n "$NAMESPACE" \
            --to-revision="$target_revision"
    fi

    log "Waiting for rollback to complete..."
    kubectl rollout status deployment/"$deployment" \
        -n "$NAMESPACE" \
        --timeout=600s

    log "Rollback completed for $deployment"
}

# Verify deployment health
verify_deployment() {
    local deployment=$1
    local retries=30
    local wait=5

    log "Verifying deployment health..."

    for i in $(seq 1 $retries); do
        local ready_replicas=$(kubectl get deployment "$deployment" \
            -n "$NAMESPACE" \
            -o jsonpath='{.status.readyReplicas}')
        local desired_replicas=$(kubectl get deployment "$deployment" \
            -n "$NAMESPACE" \
            -o jsonpath='{.spec.replicas}')

        if [ "$ready_replicas" = "$desired_replicas" ] && [ -n "$ready_replicas" ]; then
            log "Deployment is healthy ($ready_replicas/$desired_replicas replicas ready)"
            return 0
        fi

        if [ $i -lt $retries ]; then
            warning "Deployment not fully ready yet ($ready_replicas/$desired_replicas), retrying in ${wait}s..."
            sleep "$wait"
        fi
    done

    error "Deployment verification failed after $retries attempts"
}

# Rollback blue-green deployment
rollback_blue_green() {
    local service=$1
    local blue_deployment="${service}-blue"
    local green_deployment="${service}-green"

    log "Rolling back blue-green deployment..."

    local current_slot=$(kubectl get svc "$service" -n "$NAMESPACE" \
        -o jsonpath='{.spec.selector.slot}')

    log "Current active slot: $current_slot"

    local target_slot=""
    if [ "$current_slot" = "blue" ]; then
        target_slot="green"
    else
        target_slot="blue"
    fi

    log "Switching traffic to $target_slot..."
    kubectl patch service "$service" -n "$NAMESPACE" \
        -p '{"spec":{"selector":{"slot":"'"$target_slot"'"}}}'

    log "Blue-green rollback completed - traffic switched to $target_slot"
}

# Database rollback (careful operation)
rollback_database() {
    warning "Database rollback is a critical operation!"
    warning "Ensure you have a backup before proceeding"

    read -p "Are you sure you want to rollback the database? (yes/no): " confirm

    if [ "$confirm" != "yes" ]; then
        log "Database rollback cancelled"
        return
    fi

    log "Running database downgrade..."

    # Get backend pod
    local pod=$(kubectl get pods -n "$NAMESPACE" \
        -l app=grayfsm,component=backend \
        -o jsonpath='{.items[0].metadata.name}')

    if [ -z "$pod" ]; then
        error "No backend pod found for database rollback"
    fi

    # Run downgrade in pod
    log "Running alembic downgrade in pod: $pod"
    kubectl exec -n "$NAMESPACE" "$pod" -- \
        python -m alembic downgrade -1 -c app/alembic.ini

    log "Database rollback completed"
}

# Main rollback handler
main() {
    log "Starting rollback procedure"
    log "============================"
    log "Namespace: $NAMESPACE"
    log "Deployment: $DEPLOYMENT"

    case "$DEPLOYMENT" in
        backend)
            rollback_blue_green "$BACKEND_SERVICE"
            verify_deployment "$BACKEND_SERVICE"
            ;;
        frontend)
            rollback_deployment "$FRONTEND_SERVICE"
            verify_deployment "$FRONTEND_SERVICE"
            ;;
        database)
            rollback_database
            ;;
        all)
            log "Rolling back all components..."
            rollback_blue_green "$BACKEND_SERVICE"
            rollback_deployment "$FRONTEND_SERVICE"
            verify_deployment "$BACKEND_SERVICE"
            verify_deployment "$FRONTEND_SERVICE"
            ;;
        *)
            error "Unknown deployment: $DEPLOYMENT"
            ;;
    esac

    log "Rollback completed successfully"
}

# Trap errors
trap 'error "Rollback failed"' ERR

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --namespace)
            NAMESPACE="$2"
            shift 2
            ;;
        --deployment)
            DEPLOYMENT="$2"
            shift 2
            ;;
        --revision)
            REVISION="$2"
            shift 2
            ;;
        --help)
            echo "Rollback script for GrayFSM"
            echo ""
            echo "Usage: $0 [options]"
            echo ""
            echo "Options:"
            echo "  --namespace NAMESPACE    Kubernetes namespace (default: grayfsm)"
            echo "  --deployment DEPLOYMENT  Component to rollback (backend|frontend|database|all)"
            echo "  --revision REVISION      Specific revision to rollback to (optional)"
            echo "  --help                   Show this help message"
            echo ""
            exit 0
            ;;
        *)
            error "Unknown option: $1"
            ;;
    esac
done

main
