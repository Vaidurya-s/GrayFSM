"""
Input Validation and Sanitization
Fixes: V-03, V-04, V-10 (SQL Injection, Command Injection, XSS)

IMPLEMENTATION GUIDE:
1. Install: pip install bleach html5lib
2. Copy to: /backend/app/utils/validators.py
3. Update schemas.py to use these validators
4. Apply to all user input fields
"""

import re
import bleach
from typing import Any, Dict, List, Optional
from pydantic import field_validator, BaseModel
from fastapi import HTTPException


# Allowed HTML tags for rich text (if needed)
ALLOWED_TAGS = ['b', 'i', 'u', 'em', 'strong', 'p', 'br']
ALLOWED_ATTRIBUTES = {}


class SecureValidator:
    """Collection of security-focused validators"""

    @staticmethod
    def sanitize_html(text: str) -> str:
        """
        Remove malicious HTML/JavaScript

        Prevents XSS attacks in user-generated content
        """
        if not text:
            return text

        # Remove all HTML tags for maximum security
        cleaned = bleach.clean(
            text,
            tags=[],  # No tags allowed
            attributes={},
            strip=True
        )

        return cleaned

    @staticmethod
    def sanitize_rich_text(text: str) -> str:
        """Allow limited HTML tags for descriptions"""
        if not text:
            return text

        return bleach.clean(
            text,
            tags=ALLOWED_TAGS,
            attributes=ALLOWED_ATTRIBUTES,
            strip=True
        )

    @staticmethod
    def validate_state_name(name: str) -> str:
        """
        Validate FSM state names to prevent code injection

        Prevents: V-04 Command Injection in HDL generation

        Rules:
        - Alphanumeric and underscores only
        - Must start with letter
        - Max 64 characters
        - No SQL/HDL keywords
        """
        if not name:
            raise ValueError("State name cannot be empty")

        if len(name) > 64:
            raise ValueError("State name too long (max 64 characters)")

        # Must start with letter, contain only alphanumeric and underscore
        if not re.match(r'^[a-zA-Z][a-zA-Z0-9_]*$', name):
            raise ValueError(
                "State name must start with letter and contain only "
                "alphanumeric characters and underscores"
            )

        # Prevent HDL/SQL reserved keywords
        reserved_keywords = {
            # Verilog keywords
            'module', 'endmodule', 'input', 'output', 'wire', 'reg', 'always',
            'begin', 'end', 'if', 'else', 'case', 'endcase', 'default',
            # VHDL keywords
            'entity', 'architecture', 'process', 'signal', 'port', 'map',
            # SQL keywords
            'select', 'insert', 'update', 'delete', 'drop', 'table', 'from', 'where',
            # Common attack vectors
            'exec', 'eval', 'system', 'call'
        }

        if name.lower() in reserved_keywords:
            raise ValueError(f"'{name}' is a reserved keyword")

        return name

    @staticmethod
    def validate_fsm_name(name: str) -> str:
        """Validate FSM name"""
        if not name or len(name.strip()) == 0:
            raise ValueError("FSM name cannot be empty")

        if len(name) > 255:
            raise ValueError("FSM name too long (max 255 characters)")

        # Sanitize HTML/XSS
        return SecureValidator.sanitize_html(name)

    @staticmethod
    def validate_description(description: Optional[str]) -> Optional[str]:
        """Validate and sanitize description"""
        if not description:
            return description

        if len(description) > 5000:
            raise ValueError("Description too long (max 5000 characters)")

        # Allow limited formatting but prevent XSS
        return SecureValidator.sanitize_rich_text(description)

    @staticmethod
    def validate_file_upload(filename: str, content: bytes, allowed_types: List[str]) -> None:
        """
        Validate uploaded files

        Prevents: V-09 File Upload vulnerabilities
        """
        # Check filename
        if not filename or len(filename) > 255:
            raise HTTPException(status_code=400, detail="Invalid filename")

        # Prevent path traversal
        if '..' in filename or '/' in filename or '\\' in filename:
            raise HTTPException(status_code=400, detail="Invalid filename: path traversal detected")

        # Validate extension
        ext = filename.rsplit('.', 1)[-1].lower() if '.' in filename else ''
        if ext not in allowed_types:
            raise HTTPException(
                status_code=400,
                detail=f"File type '{ext}' not allowed. Allowed types: {allowed_types}"
            )

        # Validate file size (max 5MB)
        max_size = 5 * 1024 * 1024  # 5MB
        if len(content) > max_size:
            raise HTTPException(
                status_code=413,
                detail=f"File too large. Maximum size: {max_size / 1024 / 1024}MB"
            )

        # Validate content matches extension
        if ext == 'json':
            try:
                import json
                json.loads(content)
            except json.JSONDecodeError:
                raise HTTPException(status_code=400, detail="Invalid JSON file")

        elif ext == 'csv':
            # Basic CSV validation
            try:
                content.decode('utf-8')
            except UnicodeDecodeError:
                raise HTTPException(status_code=400, detail="Invalid CSV encoding")

    @staticmethod
    def validate_jsonb_field(data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Validate JSONB fields to prevent injection

        Prevents: V-03 JSON injection attacks
        """
        if not isinstance(data, dict):
            raise ValueError("JSONB field must be a dictionary")

        # Limit depth to prevent DoS
        def check_depth(obj: Any, depth: int = 0, max_depth: int = 10) -> None:
            if depth > max_depth:
                raise ValueError("JSON structure too deep (max 10 levels)")

            if isinstance(obj, dict):
                for value in obj.values():
                    check_depth(value, depth + 1, max_depth)
            elif isinstance(obj, list):
                for item in obj:
                    check_depth(item, depth + 1, max_depth)

        check_depth(data)

        # Limit size to prevent DoS
        import json
        if len(json.dumps(data)) > 100_000:  # 100KB limit
            raise ValueError("JSON too large (max 100KB)")

        return data

    @staticmethod
    def validate_sql_safe_string(value: str, field_name: str = "field") -> str:
        """
        Additional SQL injection protection

        Note: Use parameterized queries as primary defense!
        This is defense-in-depth.
        """
        dangerous_patterns = [
            r"('\s*(or|and)\s*')",  # ' OR '
            r"(;\s*drop\s+table)",   # ; DROP TABLE
            r"(;\s*delete\s+from)",  # ; DELETE FROM
            r"(union\s+select)",     # UNION SELECT
            r"(--)",                 # SQL comments
            r"(/\*|\*/)",           # Block comments
        ]

        for pattern in dangerous_patterns:
            if re.search(pattern, value, re.IGNORECASE):
                raise ValueError(f"Potentially malicious content detected in {field_name}")

        return value


# Updated FSM Schemas with Validation
class FSMCreateSecure(BaseModel):
    """Secure FSM creation schema with comprehensive validation"""
    name: str
    description: Optional[str] = None
    fsm_type: str
    states: List[str]
    initial_state: str
    transitions: List[Dict[str, Any]]

    @field_validator('name')
    @classmethod
    def validate_name(cls, v: str) -> str:
        return SecureValidator.validate_fsm_name(v)

    @field_validator('description')
    @classmethod
    def validate_desc(cls, v: Optional[str]) -> Optional[str]:
        return SecureValidator.validate_description(v)

    @field_validator('fsm_type')
    @classmethod
    def validate_type(cls, v: str) -> str:
        if v not in ['moore', 'mealy']:
            raise ValueError("FSM type must be 'moore' or 'mealy'")
        return v

    @field_validator('states')
    @classmethod
    def validate_states(cls, v: List[str]) -> List[str]:
        if not v or len(v) == 0:
            raise ValueError("At least one state required")

        if len(v) > 256:
            raise ValueError("Too many states (max 256)")

        # Validate each state name
        validated_states = []
        for state in v:
            validated_states.append(SecureValidator.validate_state_name(state))

        # Check for duplicates
        if len(validated_states) != len(set(validated_states)):
            raise ValueError("Duplicate state names found")

        return validated_states

    @field_validator('initial_state')
    @classmethod
    def validate_initial(cls, v: str, info) -> str:
        # Validate format
        validated = SecureValidator.validate_state_name(v)

        # Check it's in states list
        if 'states' in info.data and validated not in info.data['states']:
            raise ValueError(f"Initial state '{v}' not in states list")

        return validated

    @field_validator('transitions')
    @classmethod
    def validate_transitions(cls, v: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        if not v or len(v) == 0:
            raise ValueError("At least one transition required")

        if len(v) > 1000:
            raise ValueError("Too many transitions (max 1000)")

        for transition in v:
            # Validate required fields
            if 'from_state' not in transition or 'to_state' not in transition:
                raise ValueError("Transition must have 'from_state' and 'to_state'")

            # Validate state names in transitions
            SecureValidator.validate_state_name(transition['from_state'])
            SecureValidator.validate_state_name(transition['to_state'])

            # Validate input/output if present
            if 'input' in transition and transition['input']:
                SecureValidator.validate_state_name(transition['input'])

            if 'output' in transition and transition['output']:
                SecureValidator.validate_state_name(transition['output'])

        return v


# Example: Secure database query
"""
# BAD - Vulnerable to SQL injection
@router.get("/search")
async def search_fsms(query: str, db: AsyncSession):
    # NEVER DO THIS!
    result = await db.execute(f"SELECT * FROM fsms WHERE name LIKE '%{query}%'")

# GOOD - Parameterized query
@router.get("/search")
async def search_fsms(query: str, db: AsyncSession):
    from sqlalchemy import select, text

    # Validate input first
    query = SecureValidator.validate_sql_safe_string(query, "search query")

    # Use parameterized query
    stmt = select(FSM).where(FSM.name.contains(query))
    result = await db.execute(stmt)
    return result.scalars().all()
"""
