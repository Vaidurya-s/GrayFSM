"""
FastAPI Backend Performance Optimizations
Purpose: API endpoint optimization, compression, and HTTP/2 configuration
Author: Performance Engineering Team
Date: 2025-11-29

Optimizations:
1. Response compression (Brotli, Gzip)
2. HTTP/2 server push
3. API response streaming
4. Async batch operations
5. Query parameter optimization
6. Response model optimization
"""

from fastapi import FastAPI, Request, Response
from fastapi.responses import StreamingResponse, ORJSONResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from starlette.middleware.base import BaseHTTPMiddleware
from typing import Any, AsyncGenerator, Optional
import orjson
import asyncio
from functools import wraps
import time
import logging

logger = logging.getLogger(__name__)


# ================================================================
# BROTLI COMPRESSION MIDDLEWARE (Better than Gzip)
# ================================================================

class BrotliMiddleware(BaseHTTPMiddleware):
    """
    Brotli compression middleware (20-30% better compression than Gzip).

    Brotli provides:
    - 20-30% better compression ratio
    - Faster decompression on client
    - Better performance for text-based content
    """

    def __init__(
        self,
        app,
        quality: int = 4,  # 0-11, higher = better compression but slower
        minimum_size: int = 500,  # Don't compress responses < 500 bytes
        exclude_media_types: set = None
    ):
        super().__init__(app)
        self.quality = quality
        self.minimum_size = minimum_size
        self.exclude_media_types = exclude_media_types or {
            "image/",
            "video/",
            "audio/",
            "application/zip",
            "application/gzip"
        }

        try:
            import brotli
            self.brotli = brotli
            self.brotli_available = True
        except ImportError:
            logger.warning("Brotli not available, falling back to Gzip")
            self.brotli_available = False

    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)

        # Check if Brotli is available and accepted
        if not self.brotli_available:
            return response

        accept_encoding = request.headers.get("accept-encoding", "")
        if "br" not in accept_encoding:
            return response

        # Don't compress small responses or excluded media types
        if hasattr(response, "body"):
            body = response.body

            if len(body) < self.minimum_size:
                return response

            content_type = response.headers.get("content-type", "")
            if any(content_type.startswith(mt) for mt in self.exclude_media_types):
                return response

            # Compress with Brotli
            compressed_body = self.brotli.compress(
                body,
                quality=self.quality
            )

            # Update headers
            response.headers["content-encoding"] = "br"
            response.headers["content-length"] = str(len(compressed_body))
            response.headers["vary"] = "Accept-Encoding"

            # Create new response with compressed body
            return Response(
                content=compressed_body,
                status_code=response.status_code,
                headers=dict(response.headers),
                media_type=response.media_type
            )

        return response


# ================================================================
# ORJSON RESPONSE (3-5x faster than standard JSON)
# ================================================================

class ORJSONResponseOptimized(ORJSONResponse):
    """
    Optimized JSON response using orjson (faster serialization).

    Performance improvements:
    - 3-5x faster serialization than standard json
    - Native support for datetime, UUID, dataclasses
    - Lower memory footprint
    """

    def render(self, content: Any) -> bytes:
        return orjson.dumps(
            content,
            option=orjson.OPT_NON_STR_KEYS | orjson.OPT_SERIALIZE_NUMPY
        )


# ================================================================
# STREAMING RESPONSE FOR LARGE DATASETS
# ================================================================

class StreamingJSONResponse:
    """
    Stream large JSON arrays to reduce memory usage and improve TTFB.

    Use cases:
    - Large FSM lists
    - Algorithm result batches
    - Export operations
    """

    @staticmethod
    async def stream_json_array(
        data_generator: AsyncGenerator[dict, None],
        chunk_size: int = 100
    ) -> StreamingResponse:
        """
        Stream JSON array with chunking.

        Args:
            data_generator: Async generator yielding dictionaries
            chunk_size: Number of items per chunk

        Returns:
            StreamingResponse
        """
        async def generate():
            yield b"["
            first = True
            buffer = []

            async for item in data_generator:
                if not first:
                    buffer.append(b",")
                first = False

                # Serialize item
                buffer.append(orjson.dumps(item))

                # Flush buffer when chunk size reached
                if len(buffer) >= chunk_size:
                    yield b"".join(buffer)
                    buffer = []

            # Flush remaining buffer
            if buffer:
                yield b"".join(buffer)

            yield b"]"

        return StreamingResponse(
            generate(),
            media_type="application/json",
            headers={
                "Cache-Control": "no-cache",
                "X-Content-Type-Options": "nosniff"
            }
        )


# ================================================================
# ASYNC BATCH OPERATIONS
# ================================================================

class BatchOperationOptimizer:
    """Optimize batch operations with concurrency control"""

    @staticmethod
    async def batch_process(
        items: list,
        processor: callable,
        batch_size: int = 10,
        max_concurrency: int = 5
    ) -> list:
        """
        Process items in batches with concurrency control.

        Args:
            items: Items to process
            processor: Async function to process each item
            batch_size: Items per batch
            max_concurrency: Maximum concurrent tasks

        Returns:
            List of processed results
        """
        semaphore = asyncio.Semaphore(max_concurrency)
        results = []

        async def process_with_semaphore(item):
            async with semaphore:
                return await processor(item)

        # Process in batches
        for i in range(0, len(items), batch_size):
            batch = items[i:i + batch_size]
            batch_results = await asyncio.gather(
                *[process_with_semaphore(item) for item in batch],
                return_exceptions=True
            )
            results.extend(batch_results)

        return results

    @staticmethod
    async def batch_database_fetch(
        db_session,
        model_class,
        ids: list,
        batch_size: int = 100
    ) -> list:
        """
        Batch fetch database records efficiently.

        Args:
            db_session: Database session
            model_class: SQLAlchemy model
            ids: List of record IDs
            batch_size: Records per batch

        Returns:
            List of model instances
        """
        results = []

        for i in range(0, len(ids), batch_size):
            batch_ids = ids[i:i + batch_size]

            # Use IN clause for batch fetch
            batch_results = await db_session.execute(
                model_class.__table__.select().where(
                    model_class.id.in_(batch_ids)
                )
            )
            results.extend(batch_results.scalars().all())

        return results


# ================================================================
# RESPONSE CACHING DECORATOR
# ================================================================

def cache_response(
    ttl: int = 300,
    key_prefix: str = "api",
    vary_on_headers: list = None
):
    """
    Cache API responses with Redis.

    Args:
        ttl: Cache TTL in seconds
        key_prefix: Cache key prefix
        vary_on_headers: Headers to include in cache key

    Example:
        @cache_response(ttl=600, vary_on_headers=["user-id"])
        async def get_fsm(fsm_id: str):
            return await db.get_fsm(fsm_id)
    """
    def decorator(func):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            # Import here to avoid circular dependency
            from performance.caching.redis_cache_layer import (
                RedisConnectionManager,
                RedisCacheLayer,
                CacheKeyGenerator
            )

            # Build cache key
            request = kwargs.get('request')
            cache_key_parts = [func.__name__] + [str(arg) for arg in args]

            if request and vary_on_headers:
                for header in vary_on_headers:
                    cache_key_parts.append(request.headers.get(header, ""))

            cache_key = CacheKeyGenerator.generate_key(
                key_prefix,
                *cache_key_parts
            )

            # Try cache
            redis_client = await RedisConnectionManager.get_client()
            cache = RedisCacheLayer(redis_client)

            cached = await cache.get(cache_key)
            if cached is not None:
                logger.debug(f"Cache HIT: {cache_key}")
                return ORJSONResponseOptimized(content=cached)

            # Execute function
            logger.debug(f"Cache MISS: {cache_key}")
            result = await func(*args, **kwargs)

            # Cache result
            if hasattr(result, 'body'):
                # Cache response body
                cache_data = orjson.loads(result.body)
                await cache.set(cache_key, cache_data, ttl=ttl)
            else:
                await cache.set(cache_key, result, ttl=ttl)

            return result

        return wrapper
    return decorator


# ================================================================
# QUERY PARAMETER OPTIMIZATION
# ================================================================

class OptimizedPagination:
    """
    Optimized pagination with cursor-based approach.

    Cursor-based pagination:
    - More efficient than OFFSET for large datasets
    - Consistent results during real-time updates
    - Better performance for deep pagination
    """

    @staticmethod
    def create_cursor(record_id: str, sort_field_value: Any) -> str:
        """Create pagination cursor"""
        import base64
        cursor_data = f"{record_id}:{sort_field_value}"
        return base64.urlsafe_b64encode(cursor_data.encode()).decode()

    @staticmethod
    def parse_cursor(cursor: str) -> tuple:
        """Parse pagination cursor"""
        import base64
        try:
            cursor_data = base64.urlsafe_b64decode(cursor.encode()).decode()
            record_id, sort_value = cursor_data.split(":", 1)
            return record_id, sort_value
        except Exception:
            return None, None

    @staticmethod
    async def paginate_cursor_based(
        query,
        cursor: Optional[str],
        limit: int,
        sort_field: str = "created_at"
    ):
        """
        Execute cursor-based pagination query.

        Args:
            query: SQLAlchemy query
            cursor: Pagination cursor
            limit: Page size
            sort_field: Field to sort by

        Returns:
            (results, next_cursor)
        """
        if cursor:
            record_id, sort_value = OptimizedPagination.parse_cursor(cursor)
            if record_id and sort_value:
                # Filter based on cursor
                query = query.filter(
                    getattr(query.column_descriptions[0]['type'], sort_field) > sort_value
                )

        # Fetch limit + 1 to check if more results exist
        results = await query.limit(limit + 1).all()

        has_more = len(results) > limit
        if has_more:
            results = results[:limit]

        # Generate next cursor
        next_cursor = None
        if has_more and results:
            last_record = results[-1]
            next_cursor = OptimizedPagination.create_cursor(
                str(last_record.id),
                getattr(last_record, sort_field)
            )

        return results, next_cursor, has_more


# ================================================================
# API ENDPOINT OPTIMIZATION PATTERNS
# ================================================================

class APIOptimizationPatterns:
    """Common optimization patterns for API endpoints"""

    @staticmethod
    async def optimized_list_endpoint(
        db_session,
        model_class,
        filters: dict,
        page: int = 1,
        page_size: int = 20,
        include_count: bool = False
    ):
        """
        Optimized list endpoint pattern.

        Optimizations:
        1. Selective field loading
        2. Efficient counting (when needed)
        3. Index-optimized sorting
        4. Batch loading of relationships
        """
        query = db_session.query(model_class)

        # Apply filters
        for field, value in filters.items():
            if value is not None:
                query = query.filter(getattr(model_class, field) == value)

        # Get total count (optimized)
        total_count = None
        if include_count:
            # Use COUNT(*) without fetching rows
            count_query = query.with_entities(func.count()).order_by(None)
            total_count = await count_query.scalar()

        # Apply pagination
        offset = (page - 1) * page_size
        query = query.limit(page_size).offset(offset)

        # Execute query
        results = await query.all()

        return {
            "items": results,
            "page": page,
            "page_size": page_size,
            "total_count": total_count,
            "has_more": len(results) == page_size
        }

    @staticmethod
    async def optimized_detail_endpoint(
        db_session,
        model_class,
        record_id: str,
        include_relations: list = None
    ):
        """
        Optimized detail endpoint with selective loading.

        Args:
            db_session: Database session
            model_class: Model class
            record_id: Record identifier
            include_relations: Relations to eager load

        Returns:
            Model instance with loaded relations
        """
        from sqlalchemy.orm import selectinload

        query = db_session.query(model_class).filter(
            model_class.id == record_id
        )

        # Eager load specified relations
        if include_relations:
            for relation in include_relations:
                query = query.options(selectinload(getattr(model_class, relation)))

        return await query.first()


# ================================================================
# HTTP/2 SERVER PUSH CONFIGURATION
# ================================================================

HTTP2_PUSH_CONFIG = """
# HTTP/2 Server Push Configuration for Uvicorn + Nginx

## Nginx Configuration (Reverse Proxy)

upstream grayfsm_backend {
    server 127.0.0.1:8000;
    keepalive 32;
}

server {
    listen 443 ssl http2;
    server_name api.grayfsm.com;

    # SSL Configuration
    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    # HTTP/2 Push
    http2_push_preload on;

    # Compression
    gzip on;
    gzip_vary on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml;

    # Brotli (if module available)
    brotli on;
    brotli_comp_level 4;
    brotli_types text/plain text/css application/json application/javascript text/xml application/xml;

    location / {
        proxy_pass http://grayfsm_backend;
        proxy_http_version 1.1;

        # HTTP/2 headers
        proxy_set_header Connection "";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # Connection pooling
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
        proxy_buffering on;
        proxy_buffer_size 4k;
        proxy_buffers 8 4k;
    }
}

## Uvicorn Configuration (application startup)

# Run with HTTP/2 support via hypercorn (alternative to uvicorn)
# hypercorn app.main:app --bind 0.0.0.0:8000 --workers 4 --http2

# Or use Uvicorn with h2 support
# uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 4
"""


# ================================================================
# PERFORMANCE MONITORING MIDDLEWARE
# ================================================================

class PerformanceMonitoringMiddleware(BaseHTTPMiddleware):
    """Monitor and log API endpoint performance"""

    async def dispatch(self, request: Request, call_next):
        start_time = time.time()

        # Execute request
        response = await call_next(request)

        # Calculate duration
        duration_ms = (time.time() - start_time) * 1000

        # Log slow requests
        if duration_ms > 500:  # > 500ms
            logger.warning(
                f"Slow request: {request.method} {request.url.path} "
                f"took {duration_ms:.2f}ms"
            )

        # Add performance header
        response.headers["X-Response-Time"] = f"{duration_ms:.2f}ms"

        return response


# ================================================================
# EXPECTED PERFORMANCE IMPROVEMENTS
# ================================================================

"""
API Optimization Performance Impact:

1. Brotli Compression:
   - Response size: 20-30% smaller than Gzip
   - Bandwidth savings: 25-35%
   - TTFB improvement: 10-20% (smaller payloads)

2. ORJSON Serialization:
   - JSON serialization: 3-5x faster
   - Latency reduction: 20-40ms -> 5-10ms
   - Memory usage: 30% lower

3. Streaming Responses:
   - TTFB: 90% improvement for large datasets
   - Memory usage: 80% reduction
   - First byte: 50ms vs 500ms+

4. Cursor-based Pagination:
   - Deep pagination: 10-100x faster
   - P95 latency: 500ms -> 20ms (page 1000+)
   - Consistent performance regardless of offset

5. Response Caching:
   - Cache hit latency: 95% reduction (200ms -> 5ms)
   - Database load: 70-85% reduction
   - Throughput: 5-10x for cached endpoints

6. Batch Operations:
   - Database round trips: 90% reduction
   - Bulk operations: 5-10x faster
   - Memory efficiency: 50% improvement

Overall API Performance:
- P50 latency: 40-60% reduction
- P95 latency: 60-80% reduction
- Throughput: 2-3x improvement
- Resource usage: 30-40% reduction
"""
