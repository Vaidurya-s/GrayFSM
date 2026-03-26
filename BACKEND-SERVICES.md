# GrayFSM Backend Services Layer Design

**Version:** 1.0
**Date:** November 2025

---

## Table of Contents

1. [Service Layer Architecture](#service-layer-architecture)
2. [Detailed Service Specifications](#detailed-service-specifications)
3. [Authentication & Authorization](#authentication--authorization)
4. [Caching Strategy](#caching-strategy)
5. [Background Jobs](#background-jobs)
6. [Error Handling](#error-handling)
7. [Inter-Service Communication](#inter-service-communication)
8. [Performance Optimization](#performance-optimization)

---

## Service Layer Architecture

### Layer Separation

```
┌─────────────────────────────────────────────────────────────┐
│                      API LAYER                               │
│  - Route handlers (FastAPI)                                  │
│  - Request/Response validation (Pydantic)                    │
│  - HTTP concerns only                                        │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│                    SERVICE LAYER                             │
│  - Business logic                                            │
│  - Transaction management                                    │
│  - Service orchestration                                     │
│  - No HTTP/API knowledge                                     │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│                   REPOSITORY LAYER                           │
│  - Database operations                                       │
│  - Query construction                                        │
│  - Data access abstraction                                   │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│                     DATA LAYER                               │
│  - SQLAlchemy models                                         │
│  - Database schema                                           │
└─────────────────────────────────────────────────────────────┘
```

---

## Detailed Service Specifications

### 1. FSM Service

**File**: `/home/arunupscee/Music/grayFSM/backend/src/grayfsm/services/fsm_service.py`

```python
"""
FSM Service - Business logic for FSM management.
"""

from typing import List, Optional, Dict, Any
from uuid import UUID
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from ..models.fsm import FSM as FSMModel
from ..core.fsm_model import FSM, create_fsm_from_dict, fsm_to_dict
from ..schemas.fsm import FSMCreate, FSMUpdate, FSMFilters
from ..utils.exceptions import FSMNotFoundError, FSMValidationError
from ..utils.logger import get_logger

logger = get_logger(__name__)


class FSMService:
    """Service for FSM operations."""

    def __init__(self, db: AsyncSession):
        """
        Initialize FSM service.

        Args:
            db: Database session
        """
        self.db = db

    async def create_fsm(
        self,
        fsm_data: FSMCreate,
        user_id: Optional[UUID] = None
    ) -> FSMModel:
        """
        Create a new FSM.

        Args:
            fsm_data: FSM creation data
            user_id: Optional user ID for ownership

        Returns:
            Created FSM database model

        Raises:
            FSMValidationError: If FSM structure is invalid
        """
        logger.info(f"Creating FSM: {fsm_data.name}")

        # Convert Pydantic model to core FSM for validation
        fsm_dict = fsm_data.dict(exclude_unset=True)
        try:
            fsm = create_fsm_from_dict(fsm_dict)
        except Exception as e:
            raise FSMValidationError(f"Invalid FSM structure: {str(e)}")

        # Calculate metadata
        state_count = len(fsm.states)
        transition_count = len(fsm.transitions)
        bit_width = self._calculate_bit_width(state_count)

        # Create database model
        db_fsm = FSMModel(
            name=fsm.name,
            description=fsm.description,
            fsm_type=fsm.fsm_type.value,
            definition=fsm_to_dict(fsm),
            state_count=state_count,
            transition_count=transition_count,
            initial_state=fsm.initial_state,
            bit_width=bit_width,
            encoding_type='binary',  # Default, will be updated after optimization
            category_id=fsm_data.category_id,
            tags=fsm_data.tags or [],
            created_by=user_id,
            visibility=fsm_data.visibility or 'private'
        )

        self.db.add(db_fsm)
        await self.db.commit()
        await self.db.refresh(db_fsm)

        logger.info(f"FSM created with ID: {db_fsm.id}")
        return db_fsm

    async def get_fsm(self, fsm_id: UUID) -> FSMModel:
        """
        Retrieve FSM by ID.

        Args:
            fsm_id: UUID of the FSM

        Returns:
            FSM database model

        Raises:
            FSMNotFoundError: If FSM doesn't exist
        """
        result = await self.db.execute(
            select(FSMModel).where(FSMModel.id == fsm_id)
        )
        fsm = result.scalar_one_or_none()

        if not fsm:
            raise FSMNotFoundError(f"FSM with ID {fsm_id} not found")

        # Update view count asynchronously
        fsm.view_count += 1
        await self.db.commit()

        return fsm

    async def update_fsm(
        self,
        fsm_id: UUID,
        fsm_data: FSMUpdate,
        user_id: Optional[UUID] = None
    ) -> FSMModel:
        """
        Update FSM metadata (not definition).

        Args:
            fsm_id: UUID of the FSM
            fsm_data: Update data
            user_id: User performing update (for permission check)

        Returns:
            Updated FSM

        Raises:
            FSMNotFoundError: If FSM doesn't exist
        """
        fsm = await self.get_fsm(fsm_id)

        # Permission check
        if user_id and fsm.created_by != user_id:
            raise PermissionError("Not authorized to update this FSM")

        # Update fields
        update_data = fsm_data.dict(exclude_unset=True)
        for field, value in update_data.items():
            setattr(fsm, field, value)

        await self.db.commit()
        await self.db.refresh(fsm)

        logger.info(f"FSM {fsm_id} updated")
        return fsm

    async def delete_fsm(
        self,
        fsm_id: UUID,
        user_id: Optional[UUID] = None
    ) -> None:
        """
        Delete FSM.

        Args:
            fsm_id: UUID of the FSM
            user_id: User performing deletion (for permission check)

        Raises:
            FSMNotFoundError: If FSM doesn't exist
        """
        fsm = await self.get_fsm(fsm_id)

        # Permission check
        if user_id and fsm.created_by != user_id:
            raise PermissionError("Not authorized to delete this FSM")

        await self.db.delete(fsm)
        await self.db.commit()

        logger.info(f"FSM {fsm_id} deleted")

    async def list_fsms(
        self,
        filters: FSMFilters,
        page: int = 1,
        page_size: int = 20
    ) -> tuple[List[FSMModel], int]:
        """
        List FSMs with filtering and pagination.

        Args:
            filters: Filter criteria
            page: Page number (1-indexed)
            page_size: Items per page

        Returns:
            Tuple of (FSM list, total count)
        """
        query = select(FSMModel)

        # Apply filters
        if filters.visibility:
            query = query.where(FSMModel.visibility == filters.visibility)
        if filters.fsm_type:
            query = query.where(FSMModel.fsm_type == filters.fsm_type)
        if filters.category_id:
            query = query.where(FSMModel.category_id == filters.category_id)
        if filters.is_optimized is not None:
            query = query.where(FSMModel.is_optimized == filters.is_optimized)
        if filters.tags:
            # PostgreSQL array overlap operator
            query = query.where(FSMModel.tags.overlap(filters.tags))
        if filters.search:
            # Full-text search
            query = query.where(
                FSMModel.search_vector.match(filters.search)
            )

        # Get total count
        count_query = select(func.count()).select_from(query.subquery())
        total = await self.db.scalar(count_query)

        # Apply sorting
        sort_column = getattr(FSMModel, filters.sort_by, FSMModel.created_at)
        if filters.sort_order == 'desc':
            query = query.order_by(sort_column.desc())
        else:
            query = query.order_by(sort_column.asc())

        # Apply pagination
        query = query.offset((page - 1) * page_size).limit(page_size)

        # Execute query
        result = await self.db.execute(query)
        fsms = result.scalars().all()

        return list(fsms), total or 0

    async def fork_fsm(
        self,
        fsm_id: UUID,
        user_id: UUID,
        new_name: Optional[str] = None
    ) -> FSMModel:
        """
        Create a copy of an existing FSM.

        Args:
            fsm_id: UUID of FSM to fork
            user_id: User creating the fork
            new_name: Optional new name for forked FSM

        Returns:
            Forked FSM

        Raises:
            FSMNotFoundError: If original FSM doesn't exist
        """
        original_fsm = await self.get_fsm(fsm_id)

        # Create fork
        fork_name = new_name or f"{original_fsm.name} (Fork)"

        forked_fsm = FSMModel(
            name=fork_name,
            description=original_fsm.description,
            fsm_type=original_fsm.fsm_type,
            definition=original_fsm.definition.copy(),
            state_count=original_fsm.state_count,
            transition_count=original_fsm.transition_count,
            initial_state=original_fsm.initial_state,
            bit_width=original_fsm.bit_width,
            encoding_type=original_fsm.encoding_type,
            category_id=original_fsm.category_id,
            tags=original_fsm.tags.copy(),
            created_by=user_id,
            visibility='private',
            parent_fsm_id=fsm_id,
            version=1
        )

        self.db.add(forked_fsm)

        # Update fork count on original
        original_fsm.fork_count += 1

        await self.db.commit()
        await self.db.refresh(forked_fsm)

        logger.info(f"FSM {fsm_id} forked to {forked_fsm.id}")
        return forked_fsm

    def _calculate_bit_width(self, state_count: int) -> int:
        """Calculate minimum bit width for state encoding."""
        import math
        return math.ceil(math.log2(state_count)) if state_count > 1 else 1
```

---

### 2. Algorithm Service

**File**: `/home/arunupscee/Music/grayFSM/backend/src/grayfsm/services/algorithm_service.py`

```python
"""
Algorithm Service - FSM optimization business logic.
"""

from typing import Optional, Dict, Any, List
from uuid import UUID
import time
from sqlalchemy.ext.asyncio import AsyncSession
from ..models.fsm import FSM as FSMModel
from ..models.algorithm_result import AlgorithmResult
from ..core.algorithms.greedy import GreedyOptimizer
from ..core.algorithms.bfs_optimal import BFSOptimizer
from ..schemas.algorithm import OptimizationRequest, AlgorithmType
from ..utils.exceptions import FSMNotFoundError, OptimizationError
from ..utils.logger import get_logger
from .cache_service import CacheService

logger = get_logger(__name__)


class AlgorithmService:
    """Service for FSM optimization operations."""

    def __init__(
        self,
        db: AsyncSession,
        cache_service: CacheService
    ):
        """
        Initialize algorithm service.

        Args:
            db: Database session
            cache_service: Cache service for results
        """
        self.db = db
        self.cache = cache_service
        self.optimizers = {
            AlgorithmType.GREEDY: GreedyOptimizer(),
            AlgorithmType.BFS_OPTIMAL: BFSOptimizer(),
            # Add more as implemented
        }

    async def optimize_fsm(
        self,
        fsm_id: UUID,
        request: OptimizationRequest,
        user_id: Optional[UUID] = None
    ) -> Dict[str, Any]:
        """
        Optimize FSM using specified algorithm.

        Args:
            fsm_id: UUID of FSM to optimize
            request: Optimization request parameters
            user_id: User performing optimization

        Returns:
            Optimization result with metrics

        Raises:
            FSMNotFoundError: If FSM doesn't exist
            OptimizationError: If optimization fails
        """
        logger.info(
            f"Optimizing FSM {fsm_id} with algorithm {request.algorithm}"
        )

        # Check cache
        cache_key = self._generate_cache_key(fsm_id, request)
        cached_result = await self.cache.get(cache_key)
        if cached_result:
            logger.info(f"Cache hit for FSM {fsm_id}")
            return cached_result

        # Fetch FSM
        from .fsm_service import FSMService
        fsm_service = FSMService(self.db)
        db_fsm = await fsm_service.get_fsm(fsm_id)

        # Convert to core FSM model
        from ..core.fsm_model import create_fsm_from_dict
        fsm = create_fsm_from_dict(db_fsm.definition)

        # Get optimizer
        optimizer = self.optimizers.get(request.algorithm)
        if not optimizer:
            raise OptimizationError(
                f"Algorithm {request.algorithm} not implemented"
            )

        # Execute optimization
        start_time = time.time()
        try:
            optimized_result = optimizer.optimize(
                fsm,
                **request.options
            )
        except Exception as e:
            logger.error(f"Optimization failed: {str(e)}")
            raise OptimizationError(f"Optimization failed: {str(e)}")

        execution_time_ms = (time.time() - start_time) * 1000

        # Create optimized FSM in database
        optimized_fsm = await self._create_optimized_fsm(
            original_fsm=db_fsm,
            optimized_result=optimized_result,
            algorithm=request.algorithm,
            user_id=user_id
        )

        # Store algorithm result
        algorithm_result = await self._store_algorithm_result(
            original_fsm_id=fsm_id,
            optimized_fsm_id=optimized_fsm.id,
            algorithm=request.algorithm,
            result=optimized_result,
            execution_time_ms=execution_time_ms,
            user_id=user_id
        )

        # Prepare response
        response = {
            "optimized_fsm_id": str(optimized_fsm.id),
            "algorithm": request.algorithm.value,
            "execution_time_ms": execution_time_ms,
            "dummy_states_added": optimized_result.dummy_state_count,
            "total_states": optimized_result.final_state_count,
            "improvement_percentage": self._calculate_improvement(
                optimized_result
            ),
            "metrics": optimized_result.metrics
        }

        # Cache result
        await self.cache.set(
            cache_key,
            response,
            ttl=3600 * 24  # 24 hours
        )

        logger.info(
            f"Optimization complete: {optimized_result.dummy_state_count} "
            f"dummy states added in {execution_time_ms:.2f}ms"
        )

        return response

    async def compare_algorithms(
        self,
        fsm_id: UUID,
        algorithms: List[AlgorithmType],
        user_id: Optional[UUID] = None
    ) -> List[Dict[str, Any]]:
        """
        Run multiple algorithms and compare results.

        Args:
            fsm_id: UUID of FSM
            algorithms: List of algorithms to compare
            user_id: User performing comparison

        Returns:
            List of algorithm results
        """
        results = []

        for algorithm in algorithms:
            request = OptimizationRequest(
                algorithm=algorithm,
                options={}
            )
            try:
                result = await self.optimize_fsm(fsm_id, request, user_id)
                results.append(result)
            except Exception as e:
                logger.error(
                    f"Algorithm {algorithm} failed: {str(e)}"
                )
                results.append({
                    "algorithm": algorithm.value,
                    "error": str(e)
                })

        return results

    async def _create_optimized_fsm(
        self,
        original_fsm: FSMModel,
        optimized_result,
        algorithm: AlgorithmType,
        user_id: Optional[UUID]
    ) -> FSMModel:
        """Create database entry for optimized FSM."""
        from ..core.fsm_model import fsm_to_dict

        optimized_fsm = FSMModel(
            name=f"{original_fsm.name} (Optimized - {algorithm.value})",
            description=original_fsm.description,
            fsm_type=original_fsm.fsm_type,
            definition=fsm_to_dict(optimized_result.original_fsm),
            state_count=optimized_result.final_state_count,
            transition_count=optimized_result.total_transitions,
            initial_state=original_fsm.initial_state,
            bit_width=original_fsm.bit_width,
            encoding_type='gray',
            category_id=original_fsm.category_id,
            tags=original_fsm.tags,
            created_by=user_id,
            visibility=original_fsm.visibility,
            parent_fsm_id=original_fsm.id,
            is_optimized=True,
            optimization_algorithm=algorithm.value,
            dummy_state_count=optimized_result.dummy_state_count
        )

        self.db.add(optimized_fsm)
        await self.db.commit()
        await self.db.refresh(optimized_fsm)

        return optimized_fsm

    async def _store_algorithm_result(
        self,
        original_fsm_id: UUID,
        optimized_fsm_id: UUID,
        algorithm: AlgorithmType,
        result,
        execution_time_ms: float,
        user_id: Optional[UUID]
    ) -> AlgorithmResult:
        """Store algorithm execution result."""
        db_result = AlgorithmResult(
            original_fsm_id=original_fsm_id,
            optimized_fsm_id=optimized_fsm_id,
            algorithm=algorithm.value,
            dummy_states_added=result.dummy_state_count,
            total_states_final=result.final_state_count,
            execution_time_ms=int(execution_time_ms),
            encoding_map=result.encoding,
            success=True,
            executed_by=user_id
        )

        self.db.add(db_result)
        await self.db.commit()

        return db_result

    def _generate_cache_key(
        self,
        fsm_id: UUID,
        request: OptimizationRequest
    ) -> str:
        """Generate cache key for optimization result."""
        import hashlib
        import json

        key_data = {
            "fsm_id": str(fsm_id),
            "algorithm": request.algorithm.value,
            "options": request.options
        }
        key_str = json.dumps(key_data, sort_keys=True)
        hash_str = hashlib.md5(key_str.encode()).hexdigest()

        return f"optimization:{hash_str}"

    def _calculate_improvement(self, result) -> float:
        """Calculate improvement percentage."""
        # Implement based on metrics
        return 0.0
```

---

### 3. Export Service

**File**: `/home/arunupscee/Music/grayFSM/backend/src/grayfsm/services/export_service.py`

```python
"""
Export Service - HDL code generation.
"""

from typing import Optional, Dict, Any
from uuid import UUID
from sqlalchemy.ext.asyncio import AsyncSession
from ..models.fsm import FSM as FSMModel
from ..models.export_cache import ExportCache
from ..core.exporters.verilog import VerilogExporter
from ..core.exporters.vhdl import VHDLExporter
from ..schemas.export import ExportRequest, ExportFormat
from ..utils.exceptions import FSMNotFoundError, ExportError
from ..utils.logger import get_logger
from .cache_service import CacheService
import hashlib

logger = get_logger(__name__)


class ExportService:
    """Service for FSM export operations."""

    def __init__(
        self,
        db: AsyncSession,
        cache_service: CacheService
    ):
        """
        Initialize export service.

        Args:
            db: Database session
            cache_service: Cache service
        """
        self.db = db
        self.cache = cache_service
        self.exporters = {
            ExportFormat.VERILOG: VerilogExporter(),
            ExportFormat.VHDL: VHDLExporter(),
        }

    async def export_fsm(
        self,
        fsm_id: UUID,
        request: ExportRequest
    ) -> Dict[str, Any]:
        """
        Export FSM to specified format.

        Args:
            fsm_id: UUID of FSM
            request: Export request parameters

        Returns:
            Export result with content

        Raises:
            FSMNotFoundError: If FSM doesn't exist
            ExportError: If export fails
        """
        logger.info(f"Exporting FSM {fsm_id} as {request.format}")

        # Check cache
        cached_export = await self._get_cached_export(fsm_id, request)
        if cached_export:
            logger.info(f"Cache hit for export {fsm_id}")
            return cached_export

        # Fetch FSM
        from .fsm_service import FSMService
        fsm_service = FSMService(self.db)
        db_fsm = await fsm_service.get_fsm(fsm_id)

        # Get exporter
        exporter = self.exporters.get(request.format)
        if not exporter:
            raise ExportError(
                f"Export format {request.format} not supported"
            )

        # Convert to core FSM model
        from ..core.fsm_model import create_fsm_from_dict
        fsm = create_fsm_from_dict(db_fsm.definition)

        # Generate export
        try:
            content = exporter.export(fsm, **request.options)
        except Exception as e:
            logger.error(f"Export failed: {str(e)}")
            raise ExportError(f"Export failed: {str(e)}")

        # Calculate content hash
        content_hash = hashlib.sha256(content.encode()).hexdigest()

        # Store in cache
        await self._store_export_cache(
            fsm_id=fsm_id,
            format=request.format,
            content=content,
            content_hash=content_hash,
            options=request.options
        )

        # Update export count
        db_fsm.export_count += 1
        await self.db.commit()

        response = {
            "content": content,
            "format": request.format.value,
            "file_size_bytes": len(content.encode()),
            "cache_key": content_hash
        }

        logger.info(f"Export complete: {len(content)} characters")
        return response

    async def _get_cached_export(
        self,
        fsm_id: UUID,
        request: ExportRequest
    ) -> Optional[Dict[str, Any]]:
        """Retrieve cached export if available."""
        from sqlalchemy import select
        from datetime import datetime

        query = select(ExportCache).where(
            ExportCache.fsm_id == fsm_id,
            ExportCache.format == request.format.value,
            ExportCache.expires_at > datetime.utcnow()
        )

        result = await self.db.execute(query)
        cached = result.scalar_one_or_none()

        if cached:
            # Update access stats
            cached.access_count += 1
            cached.last_accessed_at = datetime.utcnow()
            await self.db.commit()

            return {
                "content": cached.content,
                "format": cached.format,
                "file_size_bytes": cached.file_size_bytes,
                "cache_key": cached.content_hash
            }

        return None

    async def _store_export_cache(
        self,
        fsm_id: UUID,
        format: ExportFormat,
        content: str,
        content_hash: str,
        options: Dict[str, Any]
    ) -> None:
        """Store export in database cache."""
        from datetime import datetime, timedelta

        cache_entry = ExportCache(
            fsm_id=fsm_id,
            format=format.value,
            content=content,
            content_hash=content_hash,
            file_size_bytes=len(content.encode()),
            generation_options=options,
            expires_at=datetime.utcnow() + timedelta(days=7)
        )

        self.db.add(cache_entry)
        await self.db.commit()
```

---

## Authentication & Authorization

### JWT-Based Authentication (Phase 4)

```python
"""
Authentication utilities.
"""

from datetime import datetime, timedelta
from typing import Optional
from jose import JWTError, jwt
from passlib.context import CryptContext
from ..config import settings
from ..utils.exceptions import AuthenticationError

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


class AuthService:
    """Authentication service."""

    SECRET_KEY = settings.JWT_SECRET_KEY
    ALGORITHM = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24  # 24 hours

    @classmethod
    def verify_password(cls, plain_password: str, hashed_password: str) -> bool:
        """Verify password against hash."""
        return pwd_context.verify(plain_password, hashed_password)

    @classmethod
    def hash_password(cls, password: str) -> str:
        """Hash password."""
        return pwd_context.hash(password)

    @classmethod
    def create_access_token(
        cls,
        data: dict,
        expires_delta: Optional[timedelta] = None
    ) -> str:
        """Create JWT access token."""
        to_encode = data.copy()

        if expires_delta:
            expire = datetime.utcnow() + expires_delta
        else:
            expire = datetime.utcnow() + timedelta(
                minutes=cls.ACCESS_TOKEN_EXPIRE_MINUTES
            )

        to_encode.update({"exp": expire})
        encoded_jwt = jwt.encode(
            to_encode,
            cls.SECRET_KEY,
            algorithm=cls.ALGORITHM
        )

        return encoded_jwt

    @classmethod
    def decode_access_token(cls, token: str) -> dict:
        """Decode and verify JWT token."""
        try:
            payload = jwt.decode(
                token,
                cls.SECRET_KEY,
                algorithms=[cls.ALGORITHM]
            )
            return payload
        except JWTError:
            raise AuthenticationError("Invalid authentication token")
```

### Middleware Implementation

```python
"""
Authentication middleware.
"""

from fastapi import Request, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from typing import Optional
from ..services.auth_service import AuthService
from ..utils.logger import get_logger

logger = get_logger(__name__)

security = HTTPBearer(auto_error=False)


async def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = None
) -> Optional[dict]:
    """
    Get current authenticated user from JWT token.

    Args:
        credentials: Authorization credentials

    Returns:
        User data if authenticated, None otherwise
    """
    if not credentials:
        return None

    try:
        payload = AuthService.decode_access_token(credentials.credentials)
        user_id = payload.get("sub")

        if user_id is None:
            return None

        return payload
    except Exception as e:
        logger.error(f"Authentication failed: {str(e)}")
        return None


async def require_auth(request: Request) -> dict:
    """
    Require authentication for protected endpoints.

    Args:
        request: FastAPI request

    Returns:
        User data

    Raises:
        HTTPException: If not authenticated
    """
    credentials = await security(request)
    user = await get_current_user(credentials)

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return user
```

---

## Caching Strategy

### Redis Cache Service

```python
"""
Redis cache service.
"""

import json
from typing import Optional, Any
import redis.asyncio as aioredis
from ..config import settings
from ..utils.logger import get_logger

logger = get_logger(__name__)


class CacheService:
    """Redis-based caching service."""

    def __init__(self):
        """Initialize cache service."""
        self.redis: Optional[aioredis.Redis] = None

    async def connect(self):
        """Connect to Redis."""
        self.redis = await aioredis.from_url(
            settings.REDIS_URL,
            encoding="utf-8",
            decode_responses=True
        )
        logger.info("Connected to Redis")

    async def disconnect(self):
        """Disconnect from Redis."""
        if self.redis:
            await self.redis.close()
            logger.info("Disconnected from Redis")

    async def get(self, key: str) -> Optional[Any]:
        """
        Get value from cache.

        Args:
            key: Cache key

        Returns:
            Cached value or None
        """
        if not self.redis:
            return None

        try:
            value = await self.redis.get(key)
            if value:
                return json.loads(value)
        except Exception as e:
            logger.error(f"Cache get error: {str(e)}")

        return None

    async def set(
        self,
        key: str,
        value: Any,
        ttl: int = 3600
    ) -> bool:
        """
        Set value in cache.

        Args:
            key: Cache key
            value: Value to cache
            ttl: Time to live in seconds

        Returns:
            Success status
        """
        if not self.redis:
            return False

        try:
            json_value = json.dumps(value)
            await self.redis.setex(key, ttl, json_value)
            return True
        except Exception as e:
            logger.error(f"Cache set error: {str(e)}")
            return False

    async def delete(self, key: str) -> bool:
        """
        Delete key from cache.

        Args:
            key: Cache key

        Returns:
            Success status
        """
        if not self.redis:
            return False

        try:
            await self.redis.delete(key)
            return True
        except Exception as e:
            logger.error(f"Cache delete error: {str(e)}")
            return False

    async def increment(self, key: str, amount: int = 1) -> int:
        """
        Increment counter.

        Args:
            key: Counter key
            amount: Increment amount

        Returns:
            New value
        """
        if not self.redis:
            return 0

        try:
            return await self.redis.incrby(key, amount)
        except Exception as e:
            logger.error(f"Cache increment error: {str(e)}")
            return 0
```

### Cache Strategy

```python
"""
Cache key patterns and TTL configuration.
"""

from enum import Enum


class CacheKey(str, Enum):
    """Cache key patterns."""

    # FSM caching
    FSM_BY_ID = "fsm:{fsm_id}"
    FSM_LIST = "fsm:list:{filters_hash}"

    # Algorithm results
    OPTIMIZATION = "optimization:{fsm_id}:{algorithm}:{options_hash}"
    ALGORITHM_RESULTS = "results:{fsm_id}"

    # Export caching
    EXPORT = "export:{fsm_id}:{format}:{options_hash}"

    # Rate limiting
    RATE_LIMIT = "rate:{user_id}:{endpoint}"

    # Session management (Phase 4)
    SESSION = "session:{session_id}"


class CacheTTL(int, Enum):
    """Cache TTL in seconds."""

    SHORT = 300  # 5 minutes
    MEDIUM = 3600  # 1 hour
    LONG = 86400  # 24 hours
    WEEK = 604800  # 7 days


# Cache configuration per resource type
CACHE_CONFIG = {
    "fsm": {
        "ttl": CacheTTL.MEDIUM,
        "invalidate_on_update": True
    },
    "optimization": {
        "ttl": CacheTTL.LONG,
        "invalidate_on_update": False
    },
    "export": {
        "ttl": CacheTTL.WEEK,
        "invalidate_on_update": True
    }
}
```

---

*Continued with Background Jobs, Error Handling, and more sections...*
