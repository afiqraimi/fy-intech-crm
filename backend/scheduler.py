import logging
import threading

from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger

from lead_schedule import load_schedule
from lead_engine import run_pipeline

logger = logging.getLogger("lead_scheduler")

scheduler = BackgroundScheduler(daemon=True)
_jobs_started = False
_lock = threading.Lock()


def _create_job(entry: dict):
    industry = entry["industry"]
    revenue_range = entry["revenue_range"]
    desc = entry.get("description", f"{industry} | {revenue_range}")

    def job():
        logger.info("Scheduled job triggered: %s", desc)
        try:
            result = run_pipeline(industry, revenue_range)
            if result.get("error"):
                logger.error("Pipeline error for %s: %s", desc, result["error"])
            else:
                logger.info(
                    "Pipeline done — %s: %d created, %d skipped",
                    desc,
                    result.get("created", 0),
                    result.get("skipped", 0),
                )
        except Exception:
            logger.exception("Unhandled error in scheduled job: %s", desc)

    return job


def start_scheduler():
    global _jobs_started, scheduler
    with _lock:
        if _jobs_started:
            return
        _jobs_started = True

    entries = load_schedule()
    for entry in entries:
        if not entry.get("enabled", True):
            logger.info("Skipping disabled job: %s", entry.get("description", ""))
            continue

        hour = entry["trigger_hour"]
        minute = entry.get("trigger_minute", 0)
        timezone = entry.get("timezone", "Asia/Kuala_Lumpur")
        desc = entry.get("description", "unnamed")

        scheduler.add_job(
            _create_job(entry),
            trigger=CronTrigger(hour=hour, minute=minute, timezone=timezone),
            id=f"lead_gen_{desc.replace(' ', '_').lower()}",
            name=desc,
            replace_existing=True,
        )
        logger.info("Scheduled lead gen job: %s at %02d:%02d %s", desc, hour, minute, timezone)

    scheduler.start()
    logger.info("Lead engine scheduler started with %d enabled jobs", len(scheduler.get_jobs()))


def shutdown_scheduler():
    if scheduler.running:
        scheduler.shutdown(wait=False)
        logger.info("Lead engine scheduler shut down")
