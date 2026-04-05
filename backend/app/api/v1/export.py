"""
Export endpoints for HDL generation
"""
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
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


class ExportResponse(BaseModel):
    """Response schema for FSM export"""
    format: str
    content: str
    file_name: str


@router.post("/{fsm_id}/export", response_model=ExportResponse)
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
        ExportResponse with format, generated content, and suggested file_name

    Raises:
        404: FSM not found
        400: Export error (unsupported format or generation failure)
    """
    service = ExportService(db)

    try:
        result = await service.export_fsm(
            fsm_id=fsm_id,
            format_name=request.format,
            options=request.options.model_dump(exclude_none=True),
        )
        return ExportResponse(**result)
    except FSMNotFoundException as e:
        raise HTTPException(status_code=404, detail=str(e))
    except ExportException as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/formats")
async def get_available_formats():
    """
    List all available export formats.

    Returns:
        List of format metadata including name, extension, and description
    """
    return list_formats()
