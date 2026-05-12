import os
import json

DEFAULT_SCHEDULE = [
    {
        "enabled": True,
        "trigger_hour": 6,
        "trigger_minute": 0,
        "timezone": "Asia/Kuala_Lumpur",
        "industry": "Oil & Gas",
        "revenue_range": "RM10M-50M",
        "description": "Oil & Gas - Mid Market",
    },
    {
        "enabled": True,
        "trigger_hour": 5,
        "trigger_minute": 0,
        "timezone": "Asia/Kuala_Lumpur",
        "industry": "Manufacturing & Engineering",
        "revenue_range": "RM50M+",
        "description": "Manufacturing - Enterprise",
    },
    {
        "enabled": False,
        "trigger_hour": 8,
        "trigger_minute": 0,
        "timezone": "Asia/Kuala_Lumpur",
        "industry": "Healthcare & Medical",
        "revenue_range": "RM10M-50M",
        "description": "Healthcare - Mid Market (disabled by default)",
    },
    {
        "enabled": False,
        "trigger_hour": 8,
        "trigger_minute": 0,
        "timezone": "Asia/Kuala_Lumpur",
        "industry": "Construction & Infrastructure",
        "revenue_range": "RM50M+",
        "description": "Construction - Enterprise (disabled by default)",
    },
]

SCHEDULE_ENV = os.environ.get("LEAD_ENGINE_SCHEDULE", "")


def load_schedule() -> list[dict]:
    if SCHEDULE_ENV:
        try:
            return json.loads(SCHEDULE_ENV)
        except json.JSONDecodeError:
            pass
    return DEFAULT_SCHEDULE
