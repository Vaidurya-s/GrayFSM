"""
Export Service - Orchestrates FSM export to various formats (Verilog, VHDL, JSON)
"""

import hashlib
import json
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exporters import get_exporter, get_file_extension, list_formats
from app.models.fsm import FSM
from app.utils.exceptions import ExportException, FSMNotFoundException
from app.utils.logger import get_logger

logger = get_logger(__name__)


class ExportService:
    """Service for exporting FSMs to HDL and other formats"""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def export_fsm(
        self,
        fsm_id: UUID,
        format_name: str,
        options: dict | None = None,
        user_id: UUID | None = None,
    ) -> dict:
        """
        Export an FSM to the specified format.

        Strict-ownership: callers may only export FSMs they own (legacy
        FSMs with no owner are also allowed through). Cache lookups happen
        AFTER ownership is verified to avoid serving cached output to
        unauthorized callers.

        Raises:
            FSMNotFoundException: If the FSM does not exist or is not owned
                by the caller.
            ExportException: If export generation fails.
        """
        options = options or {}

        # Verify ownership BEFORE consulting the cache. Otherwise a cached
        # export from a previous owner would be served without ownership check.
        fsm = await self._load_fsm(fsm_id, user_id=user_id)

        from app.cache import cache_get, cache_set

        options_hash = hashlib.sha256(
            json.dumps(sorted(options.items()), default=str).encode()
        ).hexdigest()[:8]
        cache_key = f"export:{fsm_id}:{format_name}:{options_hash}"
        cached = await cache_get(cache_key)
        if cached:
            logger.info(f"Cache hit for {cache_key}")
            return cached

        logger.info(
            "Exporting FSM",
            fsm_id=str(fsm_id),
            format=format_name,
        )

        # Get the exporter
        exporter = get_exporter(format_name)

        # Generate content
        try:
            content = exporter.export(
                definition=fsm.definition,
                fsm_type=fsm.fsm_type,
                name=fsm.name,
                options=options,
            )
        except ExportException:
            raise
        except Exception as e:
            # Don't concatenate str(e) into the user-visible message —
            # underlying exceptions can leak file paths or DB context. The
            # full exception is preserved on `.cause` for server-side logs.
            raise ExportException(
                f"Failed to export FSM to {format_name}",
                cause=e,
            ) from e

        # Build file name
        extension = get_file_extension(format_name)
        safe_name = self._sanitize_filename(fsm.name)
        file_name = f"{safe_name}{extension}"

        # Increment export count
        fsm.export_count = (fsm.export_count or 0) + 1
        await self.db.commit()

        logger.info(
            "Export complete",
            fsm_id=str(fsm_id),
            format=format_name,
            file_name=file_name,
            content_length=len(content),
        )

        result = {
            "format": format_name,
            "content": content,
            "file_name": file_name,
        }

        # Cache result
        await cache_set(cache_key, result)

        return result

    async def list_available_formats(self) -> list:
        """
        List all available export formats.

        Returns:
            List of format metadata dictionaries
        """
        return list_formats()

    async def _load_fsm(self, fsm_id: UUID, user_id: UUID | None = None) -> FSM:
        """
        Load an FSM from the database, enforcing ownership.

        Returns 404 (FSMNotFoundException) for both "does not exist" and
        "not yours" so that callers cannot enumerate FSM IDs.

        Raises:
            FSMNotFoundException: If the FSM does not exist or is not owned
                by the caller.
            ExportException: If the FSM exists but has no definition.
        """
        result = await self.db.execute(select(FSM).where(FSM.id == fsm_id))
        fsm = result.scalar_one_or_none()

        if not fsm:
            raise FSMNotFoundException(str(fsm_id))

        # Mirror get_fsm's access rule: public AND disk-seeded "example"
        # FSMs may be exported by any authenticated caller (read-only
        # operation). Anything else still requires owner match.
        if fsm.visibility not in ("public", "example"):
            if fsm.created_by is None or user_id is None or fsm.created_by != user_id:
                raise FSMNotFoundException(str(fsm_id))

        if not fsm.definition:
            # No `cause` here — this isn't wrapping an inner exception.
            raise ExportException("FSM has no definition data to export")

        return fsm

    @staticmethod
    def _sanitize_filename(name: str) -> str:
        """
        Sanitize an FSM name for use as a file name.

        Args:
            name: Original FSM name

        Returns:
            Sanitized file name (without extension)
        """
        sanitized = ""
        for ch in name:
            if ch.isalnum() or ch in ("_", "-"):
                sanitized += ch
            elif ch == " ":
                sanitized += "_"
        return sanitized.lower() or "fsm_export"
