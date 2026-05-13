import os
import json

DEFAULT_SCHEDULE = [
    {
        "enabled": True,
        "trigger_hour": 2,
        "trigger_minute": 0,
        "timezone": "Asia/Kuala_Lumpur",
        "industry": "Oil & Gas",
        "revenue_range": "RM10M-50M",
        "description": "Oil & Gas - Mid Market",
    },
    {
        "enabled": True,
        "trigger_hour": 3,
        "trigger_minute": 0,
        "timezone": "Asia/Kuala_Lumpur",
        "industry": "Manufacturing & Engineering",
        "revenue_range": "RM50M+",
        "description": "Manufacturing - Enterprise",
    },
    {
        "enabled": True,
        "trigger_hour": 4,
        "trigger_minute": 0,
        "timezone": "Asia/Kuala_Lumpur",
        "industry": "Healthcare & Medical",
        "revenue_range": "RM10M-50M",
        "description": "Healthcare - Mid Market",
    },
    {
        "enabled": True,
        "trigger_hour": 5,
        "trigger_minute": 0,
        "timezone": "Asia/Kuala_Lumpur",
        "industry": "Construction & Infrastructure",
        "revenue_range": "RM50M+",
        "description": "Construction - Enterprise",
    },
    {
        "enabled": True,
        "trigger_hour": 6,
        "trigger_minute": 0,
        "timezone": "Asia/Kuala_Lumpur",
        "industry": "Telecommunications",
        "revenue_range": "RM50M+",
        "description": "Telecom - Enterprise",
    },
    {
        "enabled": True,
        "trigger_hour": 7,
        "trigger_minute": 0,
        "timezone": "Asia/Kuala_Lumpur",
        "industry": "Aerospace & Aviation",
        "revenue_range": "RM10M-50M",
        "description": "Aerospace - Mid Market",
    },
    {
        "enabled": True,
        "trigger_hour": 8,
        "trigger_minute": 0,
        "timezone": "Asia/Kuala_Lumpur",
        "industry": "Logistics & Transportation",
        "revenue_range": "RM10M-50M",
        "description": "Logistics - Mid Market",
    },
    {
        "enabled": True,
        "trigger_hour": 9,
        "trigger_minute": 0,
        "timezone": "Asia/Kuala_Lumpur",
        "industry": "Banking & Finance",
        "revenue_range": "RM50M+",
        "description": "Banking - Enterprise",
    },
    {
        "enabled": True,
        "trigger_hour": 10,
        "trigger_minute": 0,
        "timezone": "Asia/Kuala_Lumpur",
        "industry": "Education & Training",
        "revenue_range": "RM10M-50M",
        "description": "Education - Mid Market",
    },
    {
        "enabled": True,
        "trigger_hour": 11,
        "trigger_minute": 0,
        "timezone": "Asia/Kuala_Lumpur",
        "industry": "Property Developer & Real Estate",
        "revenue_range": "RM50M+",
        "description": "Property - Enterprise",
    },
    {
        "enabled": True,
        "trigger_hour": 12,
        "trigger_minute": 0,
        "timezone": "Asia/Kuala_Lumpur",
        "industry": "Energy & Utilities",
        "revenue_range": "RM50M+",
        "description": "Energy - Enterprise",
    },
    {
        "enabled": True,
        "trigger_hour": 13,
        "trigger_minute": 0,
        "timezone": "Asia/Kuala_Lumpur",
        "industry": "Government & GLC",
        "revenue_range": "RM50M+",
        "description": "Government & GLC - Enterprise",
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
