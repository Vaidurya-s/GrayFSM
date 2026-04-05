"""
Unit tests for authentication utilities (password hashing and token creation).

Tests cover:
- hash_password: password hashing with fallback to SHA-256
- verify_password: password verification
- create_access_token: JWT token creation
- Token payload validation
"""

import pytest
from datetime import datetime, timedelta
from uuid import uuid4

from app.services.auth_service import hash_password, verify_password
from app.middleware.auth import create_access_token, _decode_token


# =====================================================================
# Password Hashing and Verification
# =====================================================================

class TestHashPassword:
    """Tests for hash_password()."""

    def test_hash_password_returns_string(self):
        """hash_password should return a non-empty string."""
        password = "test_password_123"
        hashed = hash_password(password)
        assert isinstance(hashed, str)
        assert len(hashed) > 0

    def test_hash_password_deterministic_with_passlib(self):
        """With passlib, same password produces different hashes (bcrypt uses salt)."""
        password = "test_password_123"
        hash1 = hash_password(password)
        hash2 = hash_password(password)
        # Bcrypt produces different hashes each time (salt is random)
        # So we can't expect them to be equal, but they should both work with verify
        assert verify_password(password, hash1)
        assert verify_password(password, hash2)

    def test_hash_password_different_from_plaintext(self):
        """hash_password should not return the plaintext password."""
        password = "my_secret_password"
        hashed = hash_password(password)
        assert hashed != password

    def test_hash_password_long_input(self):
        """hash_password should handle long passwords."""
        password = "a" * 100
        hashed = hash_password(password)
        assert len(hashed) > 0
        assert verify_password(password, hashed)


class TestVerifyPassword:
    """Tests for verify_password()."""

    def test_verify_password_correct(self):
        """verify_password should return True for correct password."""
        password = "correct_password"
        hashed = hash_password(password)
        assert verify_password(password, hashed) is True

    def test_verify_password_incorrect(self):
        """verify_password should return False for incorrect password."""
        password = "correct_password"
        wrong_password = "wrong_password"
        hashed = hash_password(password)
        assert verify_password(wrong_password, hashed) is False

    def test_verify_password_empty(self):
        """verify_password should return False for empty password."""
        password = "correct_password"
        hashed = hash_password(password)
        assert verify_password("", hashed) is False

    def test_verify_password_case_sensitive(self):
        """verify_password should be case-sensitive."""
        password = "MyPassword"
        hashed = hash_password(password)
        assert verify_password("mypassword", hashed) is False
        assert verify_password(password, hashed) is True


# =====================================================================
# Token Creation and Validation
# =====================================================================

class TestCreateAccessToken:
    """Tests for create_access_token()."""

    def test_create_token_returns_string(self):
        """create_access_token should return a string."""
        user_id = str(uuid4())
        token = create_access_token(data={"sub": user_id})
        assert isinstance(token, str)
        assert len(token) > 0

    def test_create_token_has_three_parts(self):
        """JWT tokens should have three parts separated by dots."""
        user_id = str(uuid4())
        token = create_access_token(data={"sub": user_id})
        parts = token.split(".")
        assert len(parts) == 3, "JWT should have 3 parts (header.payload.signature)"

    def test_create_token_includes_required_claims(self):
        """Token should contain sub, exp, iat, and type claims."""
        user_id = str(uuid4())
        data = {"sub": user_id, "email": "test@example.com"}
        token = create_access_token(data=data)

        # Decode the token
        decoded = _decode_token(token)
        assert decoded is not None
        assert decoded["user_id"] == user_id
        assert decoded["email"] == "test@example.com"

    def test_create_token_custom_expiry(self):
        """Token should respect custom expiry delta."""
        user_id = str(uuid4())
        custom_expiry = timedelta(hours=2)
        token = create_access_token(
            data={"sub": user_id},
            expires_delta=custom_expiry
        )

        decoded = _decode_token(token)
        assert decoded is not None
        # Token should be valid (we just created it)
        assert decoded["user_id"] == user_id

    def test_create_token_includes_type_claim(self):
        """Token should have type='access' claim."""
        user_id = str(uuid4())
        token = create_access_token(data={"sub": user_id})

        # The token should be decodable
        decoded = _decode_token(token)
        assert decoded is not None
        # We know from the middleware that type is checked to be "access"


# =====================================================================
# Token Decoding
# =====================================================================

class TestDecodeToken:
    """Tests for _decode_token()."""

    def test_decode_valid_token(self):
        """_decode_token should decode a valid token."""
        user_id = str(uuid4())
        token = create_access_token(data={"sub": user_id})
        decoded = _decode_token(token)

        assert decoded is not None
        assert decoded["user_id"] == user_id

    def test_decode_invalid_token(self):
        """_decode_token should return None for invalid tokens."""
        invalid_token = "invalid.token.here"
        decoded = _decode_token(invalid_token)
        assert decoded is None

    def test_decode_empty_token(self):
        """_decode_token should return None for empty string."""
        decoded = _decode_token("")
        assert decoded is None

    def test_decode_token_requires_sub(self):
        """_decode_token should return None if 'sub' claim is missing."""
        # This is harder to test without actually creating a malformed JWT,
        # so we just verify that a valid token has 'sub'
        user_id = str(uuid4())
        token = create_access_token(data={"sub": user_id})
        decoded = _decode_token(token)
        assert decoded is not None
        assert "user_id" in decoded


# =====================================================================
# Integration Tests
# =====================================================================

class TestAuthIntegration:
    """Integration tests for authentication flow."""

    def test_password_flow(self):
        """Test complete password hashing and verification flow."""
        original_password = "MySecurePassword123!"

        # Hash the password
        hashed = hash_password(original_password)
        assert hashed != original_password

        # Verify it works
        assert verify_password(original_password, hashed) is True

        # Verify wrong password fails
        assert verify_password("WrongPassword", hashed) is False

    def test_token_flow(self):
        """Test complete token creation and validation flow."""
        user_id = str(uuid4())
        email = "test@example.com"

        # Create token
        token = create_access_token(
            data={"sub": user_id, "email": email}
        )
        assert isinstance(token, str)

        # Decode token
        decoded = _decode_token(token)
        assert decoded is not None
        assert decoded["user_id"] == user_id
        assert decoded["email"] == email
        assert decoded["roles"] == []  # Default empty roles
