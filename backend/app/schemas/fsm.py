"""
Pydantic schemas for FSM API requests/responses
"""

from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator


class TransitionBase(BaseModel):
    """Base transition schema"""

    from_state: str
    to_state: str
    input: str | None = None
    output: str | None = None
    label: str | None = None


class FSMCreate(BaseModel):
    """Schema for creating a new FSM"""

    name: str = Field(..., min_length=1, max_length=255)
    description: str | None = None
    fsm_type: str = Field(..., pattern="^(moore|mealy)$")
    states: list[str] = Field(..., min_length=1)
    initial_state: str
    transitions: list[dict[str, Any]]
    outputs: dict[str, str] | None = None
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
