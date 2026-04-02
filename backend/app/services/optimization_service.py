"""
Optimization Service - Orchestrates FSM optimization using registered algorithms
"""
import math
import time
import traceback
from typing import Dict, List, Tuple
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.algorithms import get_algorithm, get_algorithm_info
from app.core.gray_code import generate_gray_codes, hamming_distance
from app.models.fsm import FSM, AlgorithmResult
from app.schemas.fsm import OptimizationRequest, OptimizationResponse
from app.utils.exceptions import (
    AlgorithmException,
    FSMNotFoundException,
    FSMValidationException,
)
from app.utils.logger import get_logger

logger = get_logger(__name__)


class OptimizationService:
    """Service for running FSM optimization algorithms"""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def optimize_fsm(
        self, fsm_id: UUID, request: OptimizationRequest
    ) -> OptimizationResponse:
        """
        Optimize an FSM using the specified algorithm.

        Steps:
            1. Load FSM from DB (get definition JSONB field)
            2. Parse definition into algorithm input format
            3. Instantiate the selected optimizer based on request.algorithm
            4. Run optimizer.optimize_fsm()
            5. Create new FSM record with optimized definition (is_optimized=True)
            6. Create AlgorithmResult record with metrics
            7. Return OptimizationResponse

        Args:
            fsm_id: UUID of the FSM to optimize
            request: Optimization request with algorithm choice and options

        Returns:
            OptimizationResponse with results

        Raises:
            FSMNotFoundException: If the FSM does not exist
            AlgorithmException: If the algorithm fails
        """
        # Step 1: Load FSM from DB
        original_fsm = await self._load_fsm(fsm_id)
        logger.info(
            "Starting optimization",
            fsm_id=str(fsm_id),
            algorithm=request.algorithm,
        )

        # Step 2: Parse definition into algorithm input format
        definition = original_fsm.definition
        states_list = definition["states"]
        transitions = definition["transitions"]
        outputs = definition.get("outputs", {})
        fsm_type = original_fsm.fsm_type
        bit_width = original_fsm.bit_width

        # Assign Gray code encodings to states
        state_encodings = self._assign_gray_encodings(states_list, bit_width)

        # Calculate Hamming distance before optimization
        avg_hamming_before = self._calculate_avg_hamming(
            transitions, state_encodings
        )

        # Step 3: Instantiate optimizer
        algorithm_cls = get_algorithm(request.algorithm)
        optimizer = algorithm_cls(bit_width)

        # Step 4: Run optimization
        start_time = time.perf_counter()
        try:
            dummy_states, new_transitions = optimizer.optimize_fsm(
                states=state_encodings,
                transitions=transitions,
                outputs=outputs,
                fsm_type=fsm_type,
            )
        except Exception as e:
            execution_time_ms = int((time.perf_counter() - start_time) * 1000)
            # Record failed attempt
            await self._record_failure(
                original_fsm_id=fsm_id,
                algorithm=request.algorithm,
                options=request.options or {},
                execution_time_ms=execution_time_ms,
                error_message=str(e),
            )
            raise AlgorithmException(
                f"Algorithm '{request.algorithm}' failed: {str(e)}"
            )

        execution_time_ms = int((time.perf_counter() - start_time) * 1000)

        # Build optimized state list and encodings
        optimized_states_list = list(states_list)
        optimized_outputs = dict(outputs)
        optimized_encodings = dict(state_encodings)

        for dummy in dummy_states:
            optimized_states_list.append(dummy.id)
            optimized_outputs[dummy.id] = dummy.output
            optimized_encodings[dummy.id] = dummy.encoding

        # Calculate Hamming distance after optimization
        avg_hamming_after = self._calculate_avg_hamming(
            new_transitions, optimized_encodings
        )

        # Compute improvement percentage
        if avg_hamming_before > 0:
            improvement_pct = (
                (avg_hamming_before - avg_hamming_after) / avg_hamming_before
            ) * 100.0
        else:
            improvement_pct = 0.0

        # Step 5: Create optimized FSM record
        optimized_bit_width = math.ceil(
            math.log2(max(len(optimized_states_list), 2))
        )
        optimized_definition = {
            "states": optimized_states_list,
            "initial_state": definition["initial_state"],
            "transitions": new_transitions,
            "outputs": optimized_outputs,
            "encodings": optimized_encodings,
            "original_fsm_id": str(fsm_id),
        }

        optimized_fsm = FSM(
            name=f"{original_fsm.name} (optimized - {request.algorithm})",
            description=(
                f"Optimized version of '{original_fsm.name}' "
                f"using {request.algorithm} algorithm. "
                f"{len(dummy_states)} dummy states added."
            ),
            fsm_type=fsm_type,
            definition=optimized_definition,
            state_count=len(optimized_states_list),
            transition_count=len(new_transitions),
            initial_state=definition["initial_state"],
            bit_width=optimized_bit_width,
            category_id=original_fsm.category_id,
            tags=original_fsm.tags,
            visibility=original_fsm.visibility,
            is_optimized=True,
            optimization_algorithm=request.algorithm,
            dummy_state_count=len(dummy_states),
            avg_hamming_distance=round(avg_hamming_after, 2),
        )

        self.db.add(optimized_fsm)
        await self.db.flush()  # Get the ID without committing

        # Step 6: Create AlgorithmResult record
        algo_info = get_algorithm_info(request.algorithm)
        algorithm_result = AlgorithmResult(
            original_fsm_id=fsm_id,
            optimized_fsm_id=optimized_fsm.id,
            algorithm=request.algorithm,
            algorithm_version=algo_info.get("version", "1.0.0"),
            algorithm_parameters=request.options or {},
            dummy_states_added=len(dummy_states),
            total_states_final=len(optimized_states_list),
            avg_hamming_before=round(avg_hamming_before, 2),
            avg_hamming_after=round(avg_hamming_after, 2),
            improvement_percentage=round(improvement_pct, 2),
            execution_time_ms=execution_time_ms,
            success=True,
        )

        self.db.add(algorithm_result)
        await self.db.commit()
        await self.db.refresh(optimized_fsm)

        logger.info(
            "Optimization complete",
            fsm_id=str(fsm_id),
            optimized_fsm_id=str(optimized_fsm.id),
            algorithm=request.algorithm,
            dummy_states=len(dummy_states),
            execution_time_ms=execution_time_ms,
            improvement_pct=round(improvement_pct, 2),
        )

        # Step 7: Return OptimizationResponse
        return OptimizationResponse(
            optimized_fsm_id=optimized_fsm.id,
            algorithm=request.algorithm,
            execution_time_ms=execution_time_ms,
            dummy_states_added=len(dummy_states),
            total_states=len(optimized_states_list),
            improvement_percentage=round(improvement_pct, 2),
        )

    async def _load_fsm(self, fsm_id: UUID) -> FSM:
        """
        Load an FSM from the database by ID.

        Args:
            fsm_id: UUID of the FSM

        Returns:
            FSM ORM instance

        Raises:
            FSMNotFoundException: If the FSM does not exist
        """
        result = await self.db.execute(
            select(FSM).where(FSM.id == fsm_id)
        )
        fsm = result.scalar_one_or_none()

        if not fsm:
            raise FSMNotFoundException(str(fsm_id))

        if not fsm.definition:
            raise FSMValidationException(
                f"FSM '{fsm_id}' has no definition data"
            )

        return fsm

    @staticmethod
    def _assign_gray_encodings(
        states: List[str], bit_width: int
    ) -> Dict[str, str]:
        """
        Assign Gray code encodings to states.

        Args:
            states: List of state IDs
            bit_width: Number of encoding bits

        Returns:
            Dictionary mapping state ID to Gray code string
        """
        gray_codes = generate_gray_codes(bit_width)
        encodings = {}
        for i, state in enumerate(states):
            if i < len(gray_codes):
                encodings[state] = gray_codes[i]
            else:
                # More states than available codes -- extend bit width
                encodings[state] = format(i, f"0{bit_width}b")
        return encodings

    @staticmethod
    def _calculate_avg_hamming(
        transitions: List[Dict], encodings: Dict[str, str]
    ) -> float:
        """
        Calculate the average Hamming distance across all transitions.

        Args:
            transitions: List of transition dicts with from_state/to_state
            encodings: State -> Gray code mapping

        Returns:
            Average Hamming distance (0.0 if no transitions)
        """
        if not transitions:
            return 0.0

        total = 0.0
        count = 0
        for trans in transitions:
            from_state = trans.get("from_state", "")
            to_state = trans.get("to_state", "")
            from_code = encodings.get(from_state)
            to_code = encodings.get(to_state)
            if from_code and to_code and len(from_code) == len(to_code):
                total += hamming_distance(from_code, to_code)
                count += 1

        return total / count if count > 0 else 0.0

    async def _record_failure(
        self,
        original_fsm_id: UUID,
        algorithm: str,
        options: dict,
        execution_time_ms: int,
        error_message: str,
    ) -> None:
        """
        Record a failed optimization attempt in the database.

        Args:
            original_fsm_id: UUID of the original FSM
            algorithm: Algorithm name
            options: Algorithm parameters
            execution_time_ms: How long before failure
            error_message: Error description
        """
        try:
            result = AlgorithmResult(
                original_fsm_id=original_fsm_id,
                algorithm=algorithm,
                algorithm_parameters=options,
                dummy_states_added=0,
                total_states_final=0,
                execution_time_ms=execution_time_ms,
                success=False,
                error_message=error_message,
            )
            self.db.add(result)
            await self.db.commit()
        except Exception as exc:
            logger.error(
                "Failed to record optimization failure",
                error=str(exc),
            )
