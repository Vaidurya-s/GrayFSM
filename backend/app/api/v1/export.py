"""
Export endpoints for HDL generation
"""
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import PlainTextResponse
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exporters import list_formats
from app.db.session import get_db
from app.middleware.auth import UserToken, get_required_current_user
from app.services.export_service import ExportService
from app.utils.exceptions import ExportException, FSMNotFoundException
from app.utils.logger import get_logger

logger = get_logger(__name__)

router = APIRouter()


class ExportOptions(BaseModel):
    """Typed options for FSM export, replacing raw Dict to prevent injection"""
    module_name: Optional[str] = None
    include_comments: bool = True
    include_synthesis_pragmas: bool = True
    target_tool: Optional[str] = Field(None, pattern="^(vivado|quartus|generic)$")
    clock_period: int = Field(10, ge=1, le=1000)
    include_waveform: bool = True
    separator: str = Field(",", max_length=1)
    include_headers: bool = True
    include_section_labels: bool = False
    style: Optional[str] = Field(None, pattern="^(standard|compact|verbose)$")


class ExportRequest(BaseModel):
    """Request schema for FSM export"""
    format: str = Field(
        ..., pattern="^(verilog|vhdl|json|csv|testbench)$",
        description="Export format"
    )
    options: ExportOptions = Field(
        default_factory=ExportOptions,
        description="Format-specific options"
    )


@router.post("/{fsm_id}/export")
async def export_fsm(
    fsm_id: UUID,
    request: ExportRequest,
    db: AsyncSession = Depends(get_db),
    current_user: UserToken = Depends(get_required_current_user),
):
    """
    Export FSM to the specified format (Verilog, VHDL, JSON).

    Generates code/data in the requested format from the FSM definition.

    Args:
        fsm_id: UUID of the FSM to export
        request: Export parameters (format, options)

    Returns:
        Wrapped response with format, generated content, file_name, and file_size_bytes

    Raises:
        404: FSM not found
        400: Export error (unsupported format or generation failure)
    """
    service = ExportService(db)
    user_id = UUID(current_user["user_id"])

    try:
        result = await service.export_fsm(
            fsm_id=fsm_id,
            format_name=request.format,
            options=request.options.model_dump(exclude_none=True),
            user_id=user_id,
        )
        content = result.get("content", "")
        return {
            "success": True,
            "data": {
                **result,
                "file_size_bytes": len(content.encode("utf-8")),
            },
        }
    except FSMNotFoundException:
        raise HTTPException(status_code=404, detail="FSM not found")
    except ExportException:
        logger.exception("export_failed", extra={"fsm_id": str(fsm_id)})
        raise HTTPException(status_code=400, detail="Export failed")


@router.get("/{fsm_id}/export/{format_name}")
async def get_cached_export(
    fsm_id: UUID,
    format_name: str,
    db: AsyncSession = Depends(get_db),
    current_user: UserToken = Depends(get_required_current_user),
):
    """
    Retrieve a previously generated (cached) export for an FSM.

    Returns the export content as plain text if cached, or regenerates it.

    Args:
        fsm_id: UUID of the FSM
        format_name: Export format (verilog, vhdl, json, csv, testbench)

    Returns:
        Plain text content with appropriate content-type

    Raises:
        404: FSM not found
        400: Export error
    """
    valid_formats = {"verilog", "vhdl", "json", "csv", "testbench"}
    if format_name not in valid_formats:
        raise HTTPException(status_code=400, detail="Unsupported format")

    service = ExportService(db)
    user_id = UUID(current_user["user_id"])

    try:
        result = await service.export_fsm(
            fsm_id=fsm_id,
            format_name=format_name,
            options={},
            user_id=user_id,
        )
        return PlainTextResponse(content=result.get("content", ""))
    except FSMNotFoundException:
        raise HTTPException(status_code=404, detail="FSM not found")
    except ExportException:
        logger.exception("export_failed", extra={"fsm_id": str(fsm_id)})
        raise HTTPException(status_code=400, detail="Export failed")


@router.get("/formats")
async def get_available_formats():
    """
    List all available export formats.

    Returns:
        List of format metadata including name, extension, and description
    """
    return list_formats()
