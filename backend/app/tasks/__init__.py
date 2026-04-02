"""Celery app configuration"""
from app.config import settings

try:
    from celery import Celery

    celery_app = Celery(
        "grayfsm",
        broker=settings.celery_broker_url,
        backend=settings.celery_result_backend,
    )
    celery_app.conf.update(
        task_serializer="json",
        result_serializer="json",
        accept_content=["json"],
        timezone="UTC",
        task_track_started=True,
        result_expires=3600,
    )
except Exception:
    celery_app = None
