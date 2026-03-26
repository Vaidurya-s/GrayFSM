# Secrets Management Best Practices
**Fixes:** V-02 (Hardcoded Secret Keys)

## Overview

Never commit secrets to version control. Use environment-specific secret management solutions.

---

## 1. Environment Variables (Development)

### .env File Structure

```bash
# /backend/.env (NEVER COMMIT THIS FILE!)

# Environment
ENVIRONMENT=development
DEBUG=False  # ALWAYS False in production

# Application
APP_NAME=GrayFSM API
APP_VERSION=1.0.0

# Server
HOST=0.0.0.0
PORT=8000

# Database (use secrets in production)
DATABASE_URL=postgresql+asyncpg://grayfsm:${DB_PASSWORD}@localhost:5432/grayfsm
DATABASE_POOL_SIZE=20

# Redis
REDIS_URL=redis://:${REDIS_PASSWORD}@localhost:6379/0

# Security - GENERATE UNIQUE VALUES!
SECRET_KEY=${SECRET_KEY}
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30
REFRESH_TOKEN_EXPIRE_DAYS=7

# CORS - Environment-specific
CORS_ORIGINS=http://localhost:3000,http://localhost:5173

# Rate Limiting
RATE_LIMIT_ENABLED=True
RATE_LIMIT_ANONYMOUS=100
RATE_LIMIT_AUTHENTICATED=1000
RATE_LIMIT_WINDOW=3600
```

### Generate Secure Secrets

```bash
# Generate SECRET_KEY (256-bit)
python3 -c "import secrets; print(secrets.token_urlsafe(32))"

# Generate DATABASE_PASSWORD
python3 -c "import secrets; print(secrets.token_urlsafe(24))"

# Generate REDIS_PASSWORD
python3 -c "import secrets; print(secrets.token_urlsafe(24))"
```

### .env.example (Safe to Commit)

```bash
# /backend/.env.example
# Copy this to .env and fill in actual values

ENVIRONMENT=development
SECRET_KEY=CHANGE_ME_GENERATE_RANDOM_KEY
DATABASE_URL=postgresql+asyncpg://user:password@localhost:5432/dbname
REDIS_URL=redis://localhost:6379/0
CORS_ORIGINS=http://localhost:3000
```

### .gitignore Configuration

```bash
# /.gitignore

# Environment files
.env
.env.local
.env.*.local
backend/.env
frontend/.env

# Secrets
secrets/
*.key
*.pem
credentials.json

# IDE
.vscode/settings.json
.idea/

# OS
.DS_Store
Thumbs.db
```

---

## 2. Docker Secrets (Production)

### docker-compose.yml

```yaml
version: '3.8'

services:
  backend:
    build: ./backend
    secrets:
      - db_password
      - secret_key
      - redis_password
    environment:
      DATABASE_URL: postgresql+asyncpg://grayfsm:${DB_PASSWORD_FILE}@postgres:5432/grayfsm
      SECRET_KEY_FILE: /run/secrets/secret_key
      REDIS_URL: redis://:${REDIS_PASSWORD_FILE}@redis:6379/0

secrets:
  db_password:
    file: ./secrets/db_password.txt
  secret_key:
    file: ./secrets/secret_key.txt
  redis_password:
    file: ./secrets/redis_password.txt
```

### Loading Secrets in Application

```python
# /backend/app/config.py

import os
from pathlib import Path

class Settings(BaseSettings):

    @staticmethod
    def _get_secret(secret_name: str, default: str = None) -> str:
        """
        Load secret from file or environment variable

        Priority:
        1. Docker secret file (/run/secrets/SECRET_NAME)
        2. Environment variable SECRET_NAME_FILE
        3. Environment variable SECRET_NAME
        4. Default value
        """
        # Try Docker secret
        secret_file = Path(f"/run/secrets/{secret_name}")
        if secret_file.exists():
            return secret_file.read_text().strip()

        # Try environment variable pointing to file
        env_file = os.getenv(f"{secret_name.upper()}_FILE")
        if env_file:
            return Path(env_file).read_text().strip()

        # Try direct environment variable
        env_value = os.getenv(secret_name.upper())
        if env_value:
            return env_value

        # Use default
        if default:
            return default

        raise ValueError(f"Secret '{secret_name}' not found")

    # Usage
    secret_key: str = Field(default_factory=lambda: Settings._get_secret("secret_key"))
    database_password: str = Field(default_factory=lambda: Settings._get_secret("db_password"))
```

---

## 3. AWS Secrets Manager (Production)

### Installation

```bash
pip install boto3
```

### Implementation

```python
# /backend/app/utils/secrets.py

import json
import boto3
from botocore.exceptions import ClientError
from functools import lru_cache

class AWSSecretsManager:
    """AWS Secrets Manager integration"""

    def __init__(self, region_name: str = "us-east-1"):
        self.client = boto3.client(
            service_name='secretsmanager',
            region_name=region_name
        )

    @lru_cache(maxsize=128)
    def get_secret(self, secret_name: str) -> dict:
        """
        Retrieve secret from AWS Secrets Manager

        Secrets are cached to reduce API calls
        """
        try:
            response = self.client.get_secret_value(SecretId=secret_name)

            if 'SecretString' in response:
                return json.loads(response['SecretString'])
            else:
                # Binary secret
                import base64
                return base64.b64decode(response['SecretBinary'])

        except ClientError as e:
            if e.response['Error']['Code'] == 'ResourceNotFoundException':
                raise ValueError(f"Secret '{secret_name}' not found")
            elif e.response['Error']['Code'] == 'InvalidRequestException':
                raise ValueError(f"Invalid request for secret '{secret_name}'")
            elif e.response['Error']['Code'] == 'InvalidParameterException':
                raise ValueError(f"Invalid parameter for secret '{secret_name}'")
            else:
                raise

# Usage in config.py
from app.utils.secrets import AWSSecretsManager

secrets_manager = AWSSecretsManager(region_name="us-east-1")

class Settings(BaseSettings):

    @property
    def secret_key(self) -> str:
        if self.is_production:
            secrets = secrets_manager.get_secret("grayfsm/production")
            return secrets['SECRET_KEY']
        else:
            return os.getenv("SECRET_KEY")

    @property
    def database_url(self) -> str:
        if self.is_production:
            secrets = secrets_manager.get_secret("grayfsm/production/database")
            return secrets['DATABASE_URL']
        else:
            return os.getenv("DATABASE_URL")
```

### AWS Secrets Structure

```json
{
  "SECRET_KEY": "your-generated-secret-key",
  "DATABASE_URL": "postgresql+asyncpg://...",
  "REDIS_URL": "redis://...",
  "SENTRY_DSN": "https://...",
  "SMTP_PASSWORD": "..."
}
```

---

## 4. HashiCorp Vault (Enterprise)

### Installation

```bash
pip install hvac
```

### Implementation

```python
# /backend/app/utils/vault.py

import hvac
from functools import lru_cache

class VaultClient:
    """HashiCorp Vault integration"""

    def __init__(self, url: str, token: str):
        self.client = hvac.Client(url=url, token=token)

        if not self.client.is_authenticated():
            raise ValueError("Vault authentication failed")

    @lru_cache(maxsize=128)
    def get_secret(self, path: str) -> dict:
        """
        Retrieve secret from Vault

        Args:
            path: Secret path (e.g., "secret/grayfsm/production")
        """
        response = self.client.secrets.kv.v2.read_secret_version(
            path=path,
            mount_point='secret'
        )

        return response['data']['data']

# Usage
vault = VaultClient(
    url=os.getenv("VAULT_URL", "http://vault:8200"),
    token=os.getenv("VAULT_TOKEN")
)

class Settings(BaseSettings):

    @property
    def secret_key(self) -> str:
        if self.is_production:
            secrets = vault.get_secret("grayfsm/production")
            return secrets['SECRET_KEY']
        else:
            return os.getenv("SECRET_KEY")
```

---

## 5. Kubernetes Secrets (K8s Deployment)

### Create Secrets

```bash
# Create from literal
kubectl create secret generic grayfsm-secrets \
  --from-literal=secret-key=$(python3 -c "import secrets; print(secrets.token_urlsafe(32))") \
  --from-literal=db-password=$(python3 -c "import secrets; print(secrets.token_urlsafe(24))")

# Create from file
kubectl create secret generic grayfsm-secrets \
  --from-file=secret-key=./secrets/secret_key.txt \
  --from-file=db-password=./secrets/db_password.txt
```

### Deployment YAML

```yaml
# k8s/deployment.yaml

apiVersion: apps/v1
kind: Deployment
metadata:
  name: grayfsm-backend
spec:
  template:
    spec:
      containers:
      - name: backend
        image: grayfsm/backend:latest
        env:
        - name: SECRET_KEY
          valueFrom:
            secretKeyRef:
              name: grayfsm-secrets
              key: secret-key
        - name: DATABASE_PASSWORD
          valueFrom:
            secretKeyRef:
              name: grayfsm-secrets
              key: db-password
        # Or mount as files
        volumeMounts:
        - name: secrets
          mountPath: "/run/secrets"
          readOnly: true
      volumes:
      - name: secrets
        secret:
          secretName: grayfsm-secrets
```

---

## 6. Secret Rotation

### Automated Rotation Script

```python
#!/usr/bin/env python3
"""
Rotate application secrets

Usage:
    python rotate_secrets.py --environment production
"""

import argparse
import secrets
from datetime import datetime
from app.utils.secrets import AWSSecretsManager

def generate_secret_key() -> str:
    """Generate new secret key"""
    return secrets.token_urlsafe(32)

def rotate_secrets(environment: str):
    """Rotate all secrets for given environment"""
    secrets_manager = AWSSecretsManager()

    # Generate new secrets
    new_secrets = {
        "SECRET_KEY": generate_secret_key(),
        "ROTATED_AT": datetime.utcnow().isoformat()
    }

    # Update in AWS Secrets Manager
    secret_name = f"grayfsm/{environment}"
    secrets_manager.client.update_secret(
        SecretId=secret_name,
        SecretString=json.dumps(new_secrets)
    )

    print(f"Secrets rotated for {environment}")
    print("IMPORTANT: Restart application to use new secrets")

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--environment", required=True)
    args = parser.parse_args()

    rotate_secrets(args.environment)
```

### Rotation Schedule

- **SECRET_KEY**: Every 90 days
- **Database passwords**: Every 30 days
- **API keys**: Every 60 days
- **CSRF tokens**: Automatically rotated per request

---

## 7. Security Checklist

### Development
- [ ] .env file never committed
- [ ] .env added to .gitignore
- [ ] .env.example provided with placeholder values
- [ ] Secrets generated with cryptographically secure random
- [ ] Different secrets for each environment

### Production
- [ ] Secrets stored in secret manager (AWS/Vault/K8s)
- [ ] No secrets in environment variables (use secret manager)
- [ ] Secrets encrypted at rest
- [ ] Secrets accessed via IAM roles (no API keys)
- [ ] Audit logging enabled for secret access
- [ ] Secret rotation policy implemented
- [ ] Backup secrets stored securely
- [ ] Secret access restricted by principle of least privilege

### Code Review
- [ ] No hardcoded secrets in code
- [ ] No secrets in comments
- [ ] No secrets in logs
- [ ] No secrets in error messages
- [ ] Secrets not returned in API responses
- [ ] Git history scanned for leaked secrets (using truffleHog/git-secrets)

---

## 8. Secrets Scanning Tools

### Pre-commit Hook

```bash
# Install git-secrets
git clone https://github.com/awslabs/git-secrets.git
cd git-secrets
sudo make install

# Setup
cd /path/to/grayFSM
git secrets --install
git secrets --register-aws

# Add custom patterns
git secrets --add 'SECRET_KEY=.*'
git secrets --add 'password=.*'
git secrets --add 'api_key=.*'
```

### CI/CD Integration

```yaml
# .github/workflows/security.yml

name: Security Scan

on: [push, pull_request]

jobs:
  secrets-scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
        with:
          fetch-depth: 0  # Full history

      - name: TruffleHog Scan
        uses: trufflesecurity/trufflehog@main
        with:
          path: ./
          base: main
          head: HEAD

      - name: GitLeaks Scan
        uses: gitleaks/gitleaks-action@v2
```

---

## 9. Emergency Response: Secret Leaked

If a secret is accidentally committed:

1. **Immediately rotate the secret** in all environments
2. **Revoke the old secret** in secret manager
3. **Remove from Git history:**
   ```bash
   # Remove file from history
   git filter-branch --force --index-filter \
     "git rm --cached --ignore-unmatch backend/.env" \
     --prune-empty --tag-name-filter cat -- --all

   # Force push
   git push origin --force --all
   ```
4. **Notify security team**
5. **Review access logs** for unauthorized usage
6. **Update .gitignore** to prevent future leaks
7. **Document incident** for post-mortem

---

## 10. References

- [OWASP Secrets Management Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Secrets_Management_Cheat_Sheet.html)
- [AWS Secrets Manager Best Practices](https://docs.aws.amazon.com/secretsmanager/latest/userguide/best-practices.html)
- [12-Factor App: Config](https://12factor.net/config)
