import threading
import time
import uuid
from copy import deepcopy

from services.ingest_service import ingest_all_input

_jobs = {}
_lock = threading.Lock()


def _now():
    return time.time()


def create_job():
    job_id = str(uuid.uuid4())
    job = {
        'id': job_id,
        'status': 'pending',
        'started_at': None,
        'finished_at': None,
        'progress': {
            'current': 0,
            'total': 0,
            'percent': 0
        },
        'logs': [],
        'result': None,
        'error': None
    }
    with _lock:
        _jobs[job_id] = job
    return job_id


def get_job(job_id):
    with _lock:
        job = _jobs.get(job_id)
        return deepcopy(job) if job else None


def append_log(job_id, message):
    with _lock:
        job = _jobs.get(job_id)
        if not job:
            return
        job['logs'].append(message)


def update_progress(job_id, current, total):
    with _lock:
        job = _jobs.get(job_id)
        if not job:
            return
        job['progress']['current'] = current
        job['progress']['total'] = total
        if total:
            job['progress']['percent'] = int((current / total) * 100)
        else:
            job['progress']['percent'] = 0


def _set_status(job_id, status, result=None, error=None):
    with _lock:
        job = _jobs.get(job_id)
        if not job:
            return
        job['status'] = status
        if status == 'running':
            job['started_at'] = _now()
        if status in ('completed', 'failed'):
            job['finished_at'] = _now()
        if result is not None:
            job['result'] = result
        if error is not None:
            job['error'] = error


def start_import_job(job_id, force=False, rebuild=True, year=None):
    def progress_callback(info):
        event = info.get('event')
        if event == 'row':
            row = info.get('row', {})
            message = (
                f"[LIGNE] {row.get('file')} | {row.get('sheet')} | ligne {row.get('row_index')} | "
                f"{row.get('date_raw') or row.get('date')} | {row.get('lieu_collecte')} | "
                f"{row.get('flux')} | {row.get('poids')} kg"
            )
            append_log(job_id, message)
            update_progress(job_id, info.get('current', 0), info.get('total', 0))
        elif event == 'file':
            append_log(job_id, f"[FICHIER] {info.get('message')}")
        elif event == 'info':
            append_log(job_id, f"[INFO] {info.get('message')}")

    def run():
        try:
            _set_status(job_id, 'running')
            append_log(job_id, "[INFO] Ingestion démarrée")
            result = ingest_all_input(force=force, rebuild=rebuild, year=year, progress=progress_callback)
            append_log(job_id, "[INFO] Ingestion terminée")
            _set_status(job_id, 'completed', result=result)
        except Exception as exc:
            append_log(job_id, f"[ERREUR] {exc}")
            _set_status(job_id, 'failed', error=str(exc))

    thread = threading.Thread(target=run, daemon=True)
    thread.start()
