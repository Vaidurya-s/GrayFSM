"""Async optimization tasks"""
from app.tasks import celery_app

if celery_app:
    @celery_app.task(bind=True, name="optimize_fsm")
    def optimize_fsm_task(self, fsm_id: str, algorithm: str, options: dict = None):
        """Run FSM optimization as a background task"""
        import asyncio
        from app.db.session import async_session
        from app.services.optimization_service import OptimizationService
        from app.schemas.fsm import OptimizationRequest

        async def _run():
            async with async_session() as db:
                service = OptimizationService(db)
                request = OptimizationRequest(
                    algorithm=algorithm,
                    options=options or {},
                    async_mode=False,
                )
                return await service.optimize_fsm(fsm_id, request)

        result = asyncio.run(_run())
        return result.model_dump(mode="json")
else:
    optimize_fsm_task = None
