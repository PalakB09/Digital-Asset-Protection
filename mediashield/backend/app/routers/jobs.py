"""
Jobs router — query background job status.
"""

from fastapi import APIRouter, HTTPException
from app.services.job_queue import get_queue

router = APIRouter(prefix="/jobs", tags=["Jobs"])


@router.get("")
async def list_jobs(limit: int = 50):
    """List recent jobs with their status."""
    queue = get_queue()
    return queue.list_jobs(limit=limit)


@router.get("/{job_id}")
async def get_job_status(job_id: str):
    """
    Get the status and result of a specific job.

    Response:
    {
      "status": "pending" | "processing" | "done" | "failed",
      "result": {...}  // only when done
    }
    """
    queue = get_queue()
    job = queue.get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    response = {
        "job_id": job.id,
        "status": job.status,
        "job_type": job.job_type,
        "created_at": job.created_at,
        "started_at": job.started_at,
        "finished_at": job.finished_at,
    }

    if job.status == "done" and job.result:
        response["result"] = job.result
    elif job.status == "failed" and job.error:
        response["error"] = job.error

    return response
