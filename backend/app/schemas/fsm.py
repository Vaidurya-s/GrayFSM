"""
Pydantic schemas for FSM API requests/responses
"""

import re
from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator


class TransitionBase(BaseModel):
    """Base transition schema"""

    from_state: str
    to_state: str
    input: str | None = None
    # HDL output signal value — restricted to binary/don't-care characters so
    # that user-supplied values cannot be injected verbatim into Verilog/VHDL.
    output: str | None = Field(default=None, pattern=r"^[01xXzZ-]*$")
    label: str | None = None


class FSMCreate(BaseModel):
    """Schema for creating a new FSM"""

    name: str = Field(..., min_length=1, max_length=255)
    description: str | None = None
    fsm_type: str = Field(..., pattern="^(moore|mealy)$")
    states: list[str] = Field(..., min_length=1)
    initial_state: str
    transitions: list[dict[str, Any]]
    # Moore outputs keyed by state name — values are constrained to binary/don't-care
    # characters to prevent HDL injection when values are written into generated code.
    outputs: dict[str, str] | None = Field(default=None)

    @field_validator("outputs")
    @classmethod
    def validate_outputs(cls, v: dict[str, str] | None) -> dict[str, str] | None:
        """Ensure output values only contain binary/don't-care characters."""
        if v is None:
            return v
        _hdl_pattern = re.compile(r"^[01xXzZ-]*$")
        for state, val in v.items():
            if not _hdl_pattern.match(val):
                raise ValueError(
                    f"Output value for state '{state}' contains invalid characters. "
                    "Only binary digits and don't-cares (0, 1, x, X, z, Z, -) are allowed."
                )
        return v

    category_id: UUID | None = None
    tags: list[str] | None = []
    visibility: str = Field(default="private", pattern="^(private|public|unlisted)$")

    @field_validator("initial_state")
    @classmethod
    def validate_initial_state(cls, v: str, info: Any) -> str:
        """Validate initial state is in states list"""
        if "states" in info.data and v not in info.data["states"]:
            raise ValueError(f"Initial state '{v}' not in states list")
        return v


class FSMResponse(BaseModel):
    """Schema for FSM response"""

    id: UUID
    name: str
    description: str | None
    fsm_type: str
    state_count: int
    transition_count: int
    initial_state: str
    bit_width: int
    is_optimized: bool
    dummy_state_count: int
    view_count: int
    states: list[str] = []
    # Expose transitions so the editor can round-trip the full FSM (without
    # this, a saved FSM reloads with no transitions).
    transitions: list[dict[str, Any]] = []
    created_at: datetime
    updated_at: datetime | None

    class Config:
        from_attributes = True


class FSMUpdate(BaseModel):
    """Schema for updating an existing FSM"""

    name: str | None = Field(None, min_length=1, max_length=255)
    description: str | None = None
    tags: list[str] | None = None
    visibility: str | None = Field(None, pattern="^(private|public|unlisted)$")
    # Definition edits so the editor's Save persists the actual FSM, not just
    # metadata. All optional — omitted fields are left untouched.
    states: list[str] | None = Field(None, min_length=1)
    initial_state: str | None = None
    transitions: list[dict[str, Any]] | None = None
    outputs: dict[str, str] | None = None


class FSMFork(BaseModel):
    """Schema for forking an existing FSM"""

    name: str = Field(..., min_length=1, max_length=255)


class OptimizationRequest(BaseModel):
    """Request schema for FSM optimization"""

    model_config = ConfigDict(populate_by_name=True)

    algorithm: str = Field(..., pattern="^(greedy|bfs_optimal|global_sa|global_ga)$")
    options: dict[str, Any] | None = {}
    async_mode: bool = Field(default=False, alias="async")


class OptimizationMetrics(BaseModel):
    """Hamming distance metrics for optimization results"""

    avg_hamming_before: float
    avg_hamming_after: float
    max_hamming_before: int
    max_hamming_after: int


class OptimizationResponse(BaseModel):
    """Response schema for optimization"""

    optimized_fsm_id: UUID
    algorithm: str
    execution_time_ms: int
    dummy_states_added: int
    total_states: int
    improvement_percentage: float
    metrics: OptimizationMetrics
    encoding_map: dict[str, str] | None = None
