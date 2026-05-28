"""
Optimization Service - Orchestrates FSM optimization using registered algorithms.

The public surface is intentionally small (`optimize_fsm`, `verify_ownership`).
Everything else is a private helper that focuses on one concern:

- ``_load_fsm``               — DB read + ownership check
- ``_run_algorithm``          — invoke the optimizer, handle algorithm failure
- ``_build_outcome``          — assemble post-optimization state/transition/encoding lists
- ``_compute_metrics``        — Hamming-before, Hamming-after, improvement %
- ``_persist_optimized_fsm``  — create the derived FSM row
- ``_record_attempt``         — create the AlgorithmResult row
- ``_build_response``         — assemble the OptimizationResponse object

The previous implementation crammed all seven concerns into a single 217-line
``optimize_fsm`` method. Splitting them along these lines makes the orchestrator
readable in one screen, and lets compare_algorithms and the encoding-only utility
endpoints reuse the metric code without re-running the whole optimization.
"""

from __future__ import annotations

import hashlib
import json
import math
import time
from dataclasses import dataclass
from typing import Any
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.algorithms import get_algorithm, get_algorithm_info
from app.core.gray_code import generate_gray_codes, hamming_distance
from app.models.fsm import FSM, AlgorithmResult
from app.schemas.fsm import OptimizationMetrics, OptimizationRequest, OptimizationResponse
from app.utils.exceptions import (
    AlgorithmException,
    FSMNotFoundException,
    FSMValidationException,
)
from app.utils.logger import get_logger

logger = get_logger(__name__)


# ---------------------------------------------------------------------------
# Internal value objects
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class _OptimizationOutcome:
    """Pure output of running an algorithm — DB-free, schema-agnostic."""

    states_list: list[str]
    transitions: list[dict[str, Any]]
    outputs: dict[str, Any]
    encodings: dict[str, str]
    dummy_states: list
    execution_time_ms: int


@dataclass(frozen=True)
class _MetricsBundle:
    """Hamming-distance metrics before vs after optimization."""

    avg_before: float
    avg_after: float
    max_before: int
    max_after: int

    @property
    def improvement_pct(self) -> float:
        if self.avg_before <= 0:
            return 0.0
        return ((self.avg_before - self.avg_after) / self.avg_before) * 100.0


# ---------------------------------------------------------------------------
# Service
# ---------------------------------------------------------------------------


class OptimizationService:
    """Service for running FSM optimization algorithms."""

    def __init__(self, db: AsyncSession):
        self.db = db

    # ---- public API --------------------------------------------------

    async def optimize_fsm(
        self,
        fsm_id: UUID,
        request: OptimizationRequest,
        user_id: UUID | None = None,
    ) -> OptimizationResponse:
        """Run ``request.algorithm`` against the FSM identified by ``fsm_id``.

        High-level flow:
          1. Cache hit?              → return cached response
          2. Load + ownership check
          3. Encode + run algorithm
          4. Compute metrics
          5. Persist optimized FSM + attempt record
          6. Build response, cache it, return
        """
        from app.cache import cache_get, cache_set

        options = request.options or {}
        options_hash = hashlib.sha256(
            json.dumps(sorted(options.items()), default=str).encode()
        ).hexdigest()[:8]
        cache_key = f"optimize:{fsm_id}:{request.algorithm}:{options_hash}"
        if cached := await cache_get(cache_key):
            logger.info(f"Cache hit for {cache_key}")
            return OptimizationResponse(**cached)

        original_fsm = await self._load_fsm(fsm_id, user_id=user_id)

        # Block re-optimization: a derived FSM's "states" already include
        # the DUMMY_ nodes inserted by the previous run. Treating those as
        # ordinary inputs and re-optimizing compounds (every pass adds
        # more dummies to satisfy adjacency constraints the previous pass
        # introduced). The caller should target the original instead —
        # the editor's Lab Report button surfaces that source FSM id.
        if original_fsm.is_optimized:
            raise FSMValidationException(
                "This FSM is already an optimization result. Re-optimizing it "
                "would compound dummy states. Optimize the source FSM instead "
                "(use the Lab Report link to reach it).",
            )

        logger.info(
            "Starting optimization",
            fsm_id=str(fsm_id),
            algorithm=request.algorithm,
        )

        # 1. Pre-optimization encoding + metrics. Done up front so we can
        #    record `avg_hamming_before` even on algorithm failure.
        definition = original_fsm.definition
        pre_encodings = self._assign_gray_encodings(definition["states"], original_fsm.bit_width)
        pre_avg = self._calculate_avg_hamming(definition["transitions"], pre_encodings)
        pre_max = self._calculate_max_hamming(definition["transitions"], pre_encodings)

        # 2. Run the algorithm. Records a failure row and re-raises on error
        #    so the orchestrator stays linear.
        outcome = await self._run_algorithm(
            fsm_id=fsm_id,
            request=request,
            original_fsm=original_fsm,
            pre_encodings=pre_encodings,
        )

        # 3. Post-optimization metrics from the algorithm's output.
        metrics = _MetricsBundle(
            avg_before=pre_avg,
            avg_after=self._calculate_avg_hamming(outcome.transitions, outcome.encodings),
            max_before=pre_max,
            max_after=self._calculate_max_hamming(outcome.transitions, outcome.encodings),
        )

        # 4. Persist (atomic-ish: both records flushed together at commit).
        optimized_fsm = await self._persist_optimized_fsm(
            original_fsm=original_fsm,
            request=request,
            outcome=outcome,
            metrics=metrics,
            user_id=user_id,
        )
        await self._record_attempt(
            original_fsm_id=fsm_id,
            optimized_fsm_id=optimized_fsm.id,
            request=request,
            outcome=outcome,
            metrics=metrics,
        )
        await self.db.commit()
        await self.db.refresh(optimized_fsm)

        logger.info(
            "Optimization complete",
            fsm_id=str(fsm_id),
            optimized_fsm_id=str(optimized_fsm.id),
            algorithm=request.algorithm,
            dummy_states=len(outcome.dummy_states),
            execution_time_ms=outcome.execution_time_ms,
            improvement_pct=round(metrics.improvement_pct, 2),
        )

        # 5. Build, cache, return.
        response = self._build_response(
            optimized_fsm=optimized_fsm,
            request=request,
            outcome=outcome,
            metrics=metrics,
        )
        await cache_set(cache_key, response.model_dump(mode="json"))
        return response

    async def verify_ownership(self, fsm_id: UUID, user_id: UUID | None) -> FSM:
        """Verify the caller owns this FSM, returning the loaded record.

        Used by the async-task path in api/v1/algorithm.py to give the
        caller an immediate 404 on unowned FSMs (rather than letting the
        ownership check slip into the background task) and also to read
        `is_optimized` upfront so re-optimization is blocked before the
        task is queued. Raises FSMNotFoundException on mismatch — the
        same exception used for "doesn't exist" — so the API can't be
        used to enumerate FSM IDs.
        """
        return await self._load_fsm(fsm_id, user_id=user_id)

    # ---- helpers (DB / IO) -----------------------------------------------

    async def _load_fsm(self, fsm_id: UUID, user_id: UUID | None = None) -> FSM:
        """Load an FSM by id, enforcing ownership.

        Returns ``FSMNotFoundException`` for both "does not exist" and
        "not yours" so callers cannot enumerate IDs they don't own.

        Raises:
            FSMNotFoundException: missing or non-owned.
            FSMValidationException: row exists but has no definition payload.
        """
        result = await self.db.execute(select(FSM).where(FSM.id == fsm_id))
        fsm = result.scalar_one_or_none()

        if not fsm:
            raise FSMNotFoundException(str(fsm_id))

        # Mirror get_fsm's access rule: public AND disk-seeded "example"
        # FSMs may be optimized by any authenticated caller (the derived
        # FSM is then owned by the caller via _persist_optimized_fsm).
        # Anything else requires owner match; legacy NULL-created_by
        # private rows stay unreachable.
        if fsm.visibility not in ("public", "example"):
            if fsm.created_by is None or user_id is None or fsm.created_by != user_id:
                raise FSMNotFoundException(str(fsm_id))

        if not fsm.definition:
            raise FSMValidationException("FSM has no definition data")

        return fsm

    async def _run_algorithm(
        self,
        fsm_id: UUID,
        request: OptimizationRequest,
        original_fsm: FSM,
        pre_encodings: dict[str, str],
    ) -> _OptimizationOutcome:
        """Invoke the registered algorithm and assemble its output into an
        ``_OptimizationOutcome``. On algorithm failure: records an
        AlgorithmResult(success=False) row, then re-raises AlgorithmException.
        """
        definition = original_fsm.definition
        algorithm_cls = get_algorithm(request.algorithm)
        optimizer = algorithm_cls(original_fsm.bit_width)

        start_time = time.perf_counter()
        try:
            dummy_states, new_transitions = optimizer.optimize_fsm(
                states=pre_encodings,
                transitions=definition["transitions"],
                outputs=definition.get("outputs", {}),
                fsm_type=original_fsm.fsm_type,
            )
        except Exception as e:
            elapsed_ms = max(1, int((time.perf_counter() - start_time) * 1000))
            await self._record_failure(
                original_fsm_id=fsm_id,
                algorithm=request.algorithm,
                options=request.options or {},
                execution_time_ms=elapsed_ms,
                error_message=str(e),
            )
            # Inner exception text preserved on `.cause` for server-side logs;
            # the user-visible message stays scrubbed.
            raise AlgorithmException(
                f"Algorithm '{request.algorithm}' failed",
                cause=e,
            ) from e

        elapsed_ms = max(1, int((time.perf_counter() - start_time) * 1000))
        return self._build_outcome(
            definition=definition,
            pre_encodings=pre_encodings,
            dummy_states=dummy_states,
            new_transitions=new_transitions,
            execution_time_ms=elapsed_ms,
        )

    @staticmethod
    def _build_outcome(
        definition: dict[str, Any],
        pre_encodings: dict[str, str],
        dummy_states: list,
        new_transitions: list[dict[str, Any]],
        execution_time_ms: int,
    ) -> _OptimizationOutcome:
        """Pure helper: merge the original state/encoding/output lists with
        the dummy states the algorithm produced."""
        states = list(definition["states"])
        outputs = dict(definition.get("outputs", {}))
        encodings = dict(pre_encodings)

        for dummy in dummy_states:
            states.append(dummy.id)
            outputs[dummy.id] = dummy.output
            encodings[dummy.id] = dummy.encoding

        return _OptimizationOutcome(
            states_list=states,
            transitions=new_transitions,
            outputs=outputs,
            encodings=encodings,
            dummy_states=dummy_states,
            execution_time_ms=execution_time_ms,
        )

    async def _persist_optimized_fsm(
        self,
        original_fsm: FSM,
        request: OptimizationRequest,
        outcome: _OptimizationOutcome,
        metrics: _MetricsBundle,
        user_id: UUID | None,
    ) -> FSM:
        """Build and stage the derived FSM row. Caller is responsible for
        committing (we batch optimized-FSM + AlgorithmResult into one txn)."""
        optimized_bit_width = math.ceil(math.log2(max(len(outcome.states_list), 2)))
        definition = {
            "states": outcome.states_list,
            "initial_state": original_fsm.definition["initial_state"],
            "transitions": outcome.transitions,
            "outputs": outcome.outputs,
            "encodings": outcome.encodings,
            "original_fsm_id": str(original_fsm.id),
        }

        optimized = FSM(
            name=f"{original_fsm.name} (optimized - {request.algorithm})",
            description=(
                f"Optimized version of '{original_fsm.name}' "
                f"using {request.algorithm} algorithm. "
                f"{len(outcome.dummy_states)} dummy states added."
            ),
            fsm_type=original_fsm.fsm_type,
            definition=definition,
            state_count=len(outcome.states_list),
            transition_count=len(outcome.transitions),
            initial_state=original_fsm.definition["initial_state"],
            bit_width=optimized_bit_width,
            category_id=original_fsm.category_id,
            tags=original_fsm.tags,
            visibility=original_fsm.visibility,
            # Inherit ownership from the source — falling back to the
            # caller's user_id if the source somehow had none. Without
            # this, derived FSMs are created with created_by=NULL and
            # become unreachable under strict-ownership.
            created_by=original_fsm.created_by or user_id,
            is_optimized=True,
            optimization_algorithm=request.algorithm,
            dummy_state_count=len(outcome.dummy_states),
            avg_hamming_distance=round(metrics.avg_after, 2),
        )
        self.db.add(optimized)
        await self.db.flush()  # populate id without committing
        return optimized

    async def _record_attempt(
        self,
        original_fsm_id: UUID,
        optimized_fsm_id: UUID,
        request: OptimizationRequest,
        outcome: _OptimizationOutcome,
        metrics: _MetricsBundle,
    ) -> None:
        """Stage the AlgorithmResult row recording a successful run."""
        algo_info = get_algorithm_info(request.algorithm)
        attempt = AlgorithmResult(
            original_fsm_id=original_fsm_id,
            optimized_fsm_id=optimized_fsm_id,
            algorithm=request.algorithm,
            algorithm_version=algo_info.get("version", "1.0.0"),
            algorithm_parameters=request.options or {},
            dummy_states_added=len(outcome.dummy_states),
            total_states_final=len(outcome.states_list),
            avg_hamming_before=round(metrics.avg_before, 2),
            avg_hamming_after=round(metrics.avg_after, 2),
            # Snapshot the full metrics + final encoding so a revisit to the
            # lab report can reconstruct every chart (radar uses max, hypercube
            # uses encoding) without re-running the algorithm.
            max_hamming_before=metrics.max_before,
            max_hamming_after=metrics.max_after,
            encoding_map=dict(outcome.encodings) if outcome.encodings else None,
            improvement_percentage=round(metrics.improvement_pct, 2),
            execution_time_ms=outcome.execution_time_ms,
            success=True,
        )
        self.db.add(attempt)

    @staticmethod
    def _build_response(
        optimized_fsm: FSM,
        request: OptimizationRequest,
        outcome: _OptimizationOutcome,
        metrics: _MetricsBundle,
    ) -> OptimizationResponse:
        return OptimizationResponse(
            optimized_fsm_id=optimized_fsm.id,
            algorithm=request.algorithm,
            execution_time_ms=outcome.execution_time_ms,
            dummy_states_added=len(outcome.dummy_states),
            total_states=len(outcome.states_list),
            improvement_percentage=round(metrics.improvement_pct, 2),
            metrics=OptimizationMetrics(
                avg_hamming_before=round(metrics.avg_before, 2),
                avg_hamming_after=round(metrics.avg_after, 2),
                max_hamming_before=metrics.max_before,
                max_hamming_after=metrics.max_after,
            ),
            encoding_map=outcome.encodings,
        )

    # ---- pure-function helpers ------------------------------------------

    @staticmethod
    def _assign_gray_encodings(states: list[str], bit_width: int) -> dict[str, str]:
        """Assign Gray codes to states, falling back to plain binary if there
        are more states than codes (shouldn't happen — algorithms ensure
        bit_width is wide enough — but defensive)."""
        gray_codes = generate_gray_codes(bit_width)
        encodings: dict[str, str] = {}
        for i, state in enumerate(states):
            if i < len(gray_codes):
                encodings[state] = gray_codes[i]
            else:
                encodings[state] = format(i, f"0{bit_width}b")
        return encodings

    @staticmethod
    def _calculate_avg_hamming(
        transitions: list[dict[str, Any]], encodings: dict[str, str]
    ) -> float:
        if not transitions:
            return 0.0
        total = 0.0
        count = 0
        for trans in transitions:
            from_code = encodings.get(trans.get("from_state", ""))
            to_code = encodings.get(trans.get("to_state", ""))
            if from_code and to_code and len(from_code) == len(to_code):
                total += hamming_distance(from_code, to_code)
                count += 1
        return total / count if count > 0 else 0.0

    @staticmethod
    def _calculate_max_hamming(transitions: list[dict[str, Any]], encodings: dict[str, str]) -> int:
        if not transitions:
            return 0
        distances: list[int] = []
        for trans in transitions:
            from_code = encodings.get(trans.get("from_state", ""))
            to_code = encodings.get(trans.get("to_state", ""))
            if from_code and to_code and len(from_code) == len(to_code):
                distances.append(hamming_distance(from_code, to_code))
        return max(distances) if distances else 0

    async def _record_failure(
        self,
        original_fsm_id: UUID,
        algorithm: str,
        options: dict,
        execution_time_ms: int,
        error_message: str,
    ) -> None:
        """Record a failed optimization attempt. Best-effort: any exception
        in the recording itself is logged and swallowed so the original
        AlgorithmException reaches the caller."""
        try:
            row = AlgorithmResult(
                original_fsm_id=original_fsm_id,
                algorithm=algorithm,
                algorithm_parameters=options,
                dummy_states_added=0,
                total_states_final=0,
                execution_time_ms=execution_time_ms,
                success=False,
                error_message=error_message,
            )
            self.db.add(row)
            await self.db.commit()
        except Exception as exc:  # noqa: BLE001
            logger.error("Failed to record optimization failure", error=str(exc))
