from sqlalchemy import Column, Integer, String, Boolean, Text
from datetime import datetime
from database import Base

class Lead(Base):
    __tablename__ = "leads"

    id = Column(Integer, primary_key=True, index=True)
    company = Column(String, index=True)
    industry = Column(String)
    location = Column(String)
    score = Column(Integer)
    status = Column(String)
    problem = Column(String, nullable=True)
    solution = Column(String, nullable=True)
    website = Column(String, nullable=True)
    email_primary = Column(String, nullable=True)
    email_additional = Column(String, nullable=True)
    phone = Column(String, nullable=True)
    address = Column(Text, nullable=True)
    personnel_data = Column(Text, nullable=True)
    priority = Column(String, nullable=True)
    lead_source = Column(String, nullable=True, default="manual")
    created_at = Column(String(30), default=lambda: datetime.utcnow().isoformat())

class Project(Base):
    __tablename__ = "projects"

    id = Column(Integer, primary_key=True, index=True)
    client = Column(String, index=True)        # e.g. Majlis Bandaraya Johor Bahru
    project_name = Column(String)              # e.g. VR City Planning POC
    service_type = Column(String)              # e.g. VR, AR, MR, XR
    stage = Column(String)                     # e.g. POC, Development, Presented, Awaiting Feedback, Deployed
    description = Column(String)               # Details about the project
    next_action = Column(String)               # What needs to happen next
    start_date = Column(String)                # When it started
    last_update = Column(String)               # Most recent update date
    source_lead_id = Column(Integer, nullable=True)   # Link back to Lead Radar
    source_lead_name = Column(String, nullable=True)  # Snapshot of company name

class AdminUser(Base):
    __tablename__ = "admin_users"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, default="Admin User")
    email = Column(String, unique=True, index=True)
    password_hash = Column(String)                    # SHA-256 hash
    avatar = Column(String, nullable=True)            # base64 data URL

class NotificationSettings(Base):
    __tablename__ = "notification_settings"

    id = Column(Integer, primary_key=True, index=True)
    enabled = Column(Boolean, default=False)
    recipients = Column(String, default="")            # comma-separated emails
