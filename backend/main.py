from fastapi import FastAPI, Depends, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
import models
from database import engine, SessionLocal
from pydantic import BaseModel
from typing import List, Optional
import base64
import csv
import hashlib
import html
import hmac
import json
import os
import requests
import time

models.Base.metadata.create_all(bind=engine)

# ─── Seed default admin on first startup ──────────────────────────────────────
def _hash(pw: str) -> str:
    return hashlib.sha256(pw.encode()).hexdigest()

def _normalize_email(email: str) -> str:
    return (email or "").strip().lower()

AUTH_SECRET = os.environ.get("AUTH_SECRET", "dev-only-change-me")
AUTH_TOKEN_TTL_SECONDS = int(os.environ.get("AUTH_TOKEN_TTL_SECONDS", str(60 * 60 * 24 * 30)))

def _b64url_encode(raw: bytes) -> str:
    return base64.urlsafe_b64encode(raw).decode().rstrip("=")

def _b64url_decode(value: str) -> bytes:
    padding = "=" * (-len(value) % 4)
    return base64.urlsafe_b64decode(value + padding)

def _sign_token_body(body: str) -> str:
    signature = hmac.new(AUTH_SECRET.encode(), body.encode(), hashlib.sha256).digest()
    return _b64url_encode(signature)

def _create_auth_token(admin: models.AdminUser) -> tuple[str, int]:
    expires_at = int(time.time()) + AUTH_TOKEN_TTL_SECONDS
    payload = {
        "admin_id": admin.id,
        "email": admin.email,
        "exp": expires_at,
    }
    body = _b64url_encode(json.dumps(payload, separators=(",", ":")).encode())
    return f"{body}.{_sign_token_body(body)}", expires_at

def _read_auth_token(token: str) -> dict:
    try:
        body, signature = token.split(".", 1)
        expected = _sign_token_body(body)
        if not hmac.compare_digest(signature, expected):
            raise ValueError("Invalid signature")
        payload = json.loads(_b64url_decode(body))
        if int(payload.get("exp", 0)) < int(time.time()):
            raise ValueError("Token expired")
        return payload
    except Exception:
        raise HTTPException(status_code=401, detail="Session expired. Please log in again.")

def seed_admin():
    db = SessionLocal()
    try:
        if db.query(models.AdminUser).count() == 0:
            db.add(models.AdminUser(
                name="Admin User",
                email="admin@fyintech.com",
                password_hash=_hash("admin"),
            ))
            db.commit()
    finally:
        db.close()

def seed_leads():
    db = SessionLocal()
    try:
        if db.query(models.Lead).count() > 0:
            return
        leads_data = [
            {"company": "EcoWorld Development Group", "industry": "Property Developer", "location": "Kuala Lumpur, MY", "score": 95, "status": "In Progress"},
            {"company": "SP Setia Bhd", "industry": "Property Developer", "location": "Selangor, MY", "score": 90, "status": "New"},
            {"company": "Sunway Group", "industry": "Conglomerate", "location": "Selangor, MY", "score": 88, "status": "Closed"},
            {"company": "Majlis Bandaraya Johor Bahru (MBJB)", "industry": "Local Council", "location": "Johor, MY", "score": 75, "status": "New"},
            {"company": "Majlis Bandaraya Pulau Pinang (MBPP)", "industry": "Local Council", "location": "Penang, MY", "score": 82, "status": "In Progress"},
            {"company": "Petronas", "industry": "Oil & Gas", "location": "Kuala Lumpur, MY", "score": 65, "status": "Closed"},
            {"company": "Maxis Communications", "industry": "Telecommunications", "location": "Kuala Lumpur, MY", "score": 55, "status": "New"},
            {"company": "UEM Sunrise", "industry": "Property Developer", "location": "Kuala Lumpur, MY", "score": 86, "status": "In Progress"},
            {"company": "Gamuda Land", "industry": "Property Developer", "location": "Selangor, MY", "score": 89, "status": "Closed"},
            {"company": "Tenaga Nasional Berhad (TNB)", "industry": "Energy", "location": "Kuala Lumpur, MY", "score": 60, "status": "New"},
        ]
        for data in leads_data:
            db.add(models.Lead(**data))
        db.commit()
    finally:
        db.close()

def seed_projects():
    db = SessionLocal()
    try:
        if db.query(models.Project).count() > 0:
            return
        projects_data = [
            {
                "client": "Majlis Bandaraya Johor Bahru (MBJB)",
                "project_name": "VR City Planning Proof-of-Concept",
                "service_type": "VR",
                "stage": "Awaiting Feedback",
                "description": "FY Intech developed and delivered a full Virtual Reality Proof-of-Concept simulation for MBJB. The POC demonstrated an immersive walkthrough of proposed urban development zones within Johor Bahru's central district, allowing council members to experience scale and spatial planning in a way 2D blueprints never could. The live presentation was delivered to senior council leadership and was received positively.",
                "next_action": "Awaiting official written feedback and decision from MBJB council regarding potential full-scale project engagement. Follow up with primary contact if no response by end of month.",
                "start_date": "2025-02-10",
                "last_update": "2025-04-28",
            },
            {
                "client": "Majlis Bandaraya Diraja Klang (MBDK)",
                "project_name": "VR Heritage District Walkthrough POC",
                "service_type": "VR",
                "stage": "POC Complete",
                "description": "FY Intech successfully completed the Virtual Reality POC showcasing the proposed redevelopment of Klang's heritage corridor. The simulation enabled stakeholders to virtually walk through the proposed pedestrian-friendly streetscape and visualize architectural heritage preservation overlaid with modern urban amenities. The deliverable was submitted and the POC phase is now officially closed.",
                "next_action": "Present findings to MBDK decision-makers. Prepare a formal project proposal document outlining the scope and cost of a full deployment.",
                "start_date": "2025-03-01",
                "last_update": "2025-05-02",
            },
            {
                "client": "Majlis Bandaraya Melaka Bersejarah (MBMB)",
                "project_name": "VR Tourism & Heritage Experience POC",
                "service_type": "VR",
                "stage": "POC Complete",
                "description": "FY Intech completed the VR Proof-of-Concept for Majlis Bandaraya Melaka Bersejarah, focused on creating an immersive virtual tourism experience for Melaka's UNESCO World Heritage zones. The simulation allows visitors and planners to virtually explore Jonker Street, A Famosa, and surrounding heritage sites in high fidelity VR, demonstrating the potential for heritage preservation education and digital tourism.",
                "next_action": "Schedule a formal presentation session with MBMB council. Explore potential for Melaka Digital Tourism grant funding to support full deployment.",
                "start_date": "2025-03-15",
                "last_update": "2025-05-03",
            },
        ]
        for data in projects_data:
            db.add(models.Project(**data))
        db.commit()
    finally:
        db.close()

seed_admin()
seed_leads()
seed_projects()

app = FastAPI(title="FY Intech CRM API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def get_current_admin(
    authorization: Optional[str] = Header(default=None),
    db: Session = Depends(get_db),
):
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="Please log in again.")
    payload = _read_auth_token(authorization.split(" ", 1)[1])
    admin = db.query(models.AdminUser).filter(models.AdminUser.id == payload.get("admin_id")).first()
    if not admin:
        raise HTTPException(status_code=401, detail="Please log in again.")
    return admin

class LeadResponse(BaseModel):
    id: int
    company: str
    industry: str
    location: str
    score: int
    status: str
    problem: str | None = None
    solution: str | None = None

    class Config:
        from_attributes = True

class ProjectResponse(BaseModel):
    id: int
    client: str
    project_name: str
    service_type: str
    stage: str
    description: str
    next_action: str
    start_date: str
    last_update: str
    source_lead_id: int | None = None
    source_lead_name: str | None = None

    class Config:
        from_attributes = True

class ProjectCreate(BaseModel):
    client: str
    project_name: str
    service_type: str
    stage: str
    description: str
    next_action: str
    start_date: str
    last_update: str
    source_lead_id: int | None = None
    source_lead_name: str | None = None

class ProjectUpdate(BaseModel):
    client: str | None = None
    project_name: str | None = None
    service_type: str | None = None
    stage: str | None = None
    description: str | None = None
    next_action: str | None = None
    last_update: str | None = None

# ─── Admin Auth Endpoints ─────────────────────────────────────────────────────

class LoginRequest(BaseModel):
    email: str
    password: str

class UpdateCredentialsRequest(BaseModel):
    current_password: str
    new_email: Optional[str] = None
    new_password: Optional[str] = None
    new_name: Optional[str] = None
    new_avatar: Optional[str] = None

class ProfileUpdateRequest(BaseModel):
    name: Optional[str] = None
    avatar: Optional[str] = None  # base64 data URL

class NotificationSettingsRequest(BaseModel):
    notifications: bool = False
    notifEmail: str = ""

class NotificationRequest(BaseModel):
    subject: str
    body: str
    to_emails: Optional[List[str]] = None

def _notification_settings(db: Session) -> models.NotificationSettings:
    settings = db.query(models.NotificationSettings).first()
    if not settings:
        settings = models.NotificationSettings(enabled=False, recipients="")
        db.add(settings)
        db.commit()
        db.refresh(settings)
    return settings

def _parse_recipients(value: str) -> list[str]:
    return [email.strip() for email in (value or "").split(",") if email.strip()]

def _send_resend_email(to_emails: list[str], subject: str, body: str) -> dict:
    api_key = os.environ.get("RESEND_API_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="RESEND_API_KEY is not configured on the backend.")
    if not to_emails:
        raise HTTPException(status_code=400, detail="No notification recipient email is configured.")

    escaped_body = html.escape(body).replace("\n", "<br />")
    html_body = f"""
    <html><body style="font-family:Arial,sans-serif;background:#0a0a0a;color:#fff;padding:30px;">
      <div style="max-width:600px;margin:0 auto;background:#121212;border:1px solid #262626;border-radius:16px;overflow:hidden;">
        <div style="background:#111827;padding:30px;text-align:center;">
          <h1 style="color:#fff;font-size:22px;margin:0;">FY Intech CRM</h1>
          <p style="color:#a3a3a3;font-size:12px;margin:8px 0 0;">Automated CRM Notification</p>
        </div>
        <div style="padding:30px;">
          <p style="color:#e5e5e5;line-height:1.8;font-size:14px;">{escaped_body}</p>
        </div>
        <div style="padding:15px 30px;border-top:1px solid #262626;text-align:center;">
          <p style="color:#525252;font-size:11px;margin:0;">FY Intech CRM - Automated Notification - Powered by Resend</p>
        </div>
      </div>
    </body></html>
    """

    response = requests.post(
        "https://api.resend.com/emails",
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        json={
            "from": os.environ.get("NOTIFICATION_FROM", "FY Intech CRM <onboarding@resend.dev>"),
            "to": to_emails,
            "subject": subject,
            "text": body,
            "html": html_body,
        },
        timeout=15,
    )
    result = response.json() if response.content else {}
    if response.status_code >= 400:
        raise HTTPException(status_code=response.status_code, detail=result.get("message", "Failed to send email via Resend."))
    return result

def _send_crm_notification(db: Session, subject: str, body: str) -> None:
    settings = _notification_settings(db)
    if not settings.enabled:
        return
    recipients = _parse_recipients(settings.recipients)
    if not recipients:
        return
    try:
        _send_resend_email(recipients, f"FY Intech CRM - {subject}", body)
    except Exception as exc:
        print(f"[Notification] Failed to send email: {exc}")

@app.post("/api/auth/login")
def login(data: LoginRequest, db: Session = Depends(get_db)):
    email = _normalize_email(data.email)
    admin = db.query(models.AdminUser).filter(
        models.AdminUser.email == email
    ).first()
    if not admin or admin.password_hash != _hash(data.password):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    token, expires_at = _create_auth_token(admin)
    return {
        "ok": True,
        "name": admin.name,
        "email": admin.email,
        "avatar": admin.avatar,
        "token": token,
        "expires_at": expires_at,
    }

@app.put("/api/auth/update")
def update_credentials(
    data: UpdateCredentialsRequest,
    db: Session = Depends(get_db),
    admin: models.AdminUser = Depends(get_current_admin),
):
    if admin.password_hash != _hash(data.current_password):
        raise HTTPException(status_code=401, detail="Current password is incorrect")
    if data.new_email:
        admin.email = _normalize_email(data.new_email)
    if data.new_password:
        if len(data.new_password) < 4:
            raise HTTPException(status_code=400, detail="Password must be at least 4 characters")
        admin.password_hash = _hash(data.new_password)
    if data.new_name:
        admin.name = data.new_name
    if data.new_avatar is not None:
        admin.avatar = data.new_avatar
    db.commit()
    db.refresh(admin)
    token, expires_at = _create_auth_token(admin)
    return {"ok": True, "name": admin.name, "email": admin.email, "avatar": admin.avatar, "token": token, "expires_at": expires_at}

@app.get("/api/auth/me")
def get_me(admin: models.AdminUser = Depends(get_current_admin)):
    return {"name": admin.name, "email": admin.email, "avatar": admin.avatar}

@app.get("/api/auth/profile")
def get_profile(admin: models.AdminUser = Depends(get_current_admin)):
    return {"name": admin.name, "email": admin.email, "avatar": admin.avatar}

@app.put("/api/auth/profile")
def update_profile(
    data: ProfileUpdateRequest,
    db: Session = Depends(get_db),
    admin: models.AdminUser = Depends(get_current_admin),
):
    if data.name:
        admin.name = data.name
    if data.avatar is not None:
        admin.avatar = data.avatar
    db.commit()
    db.refresh(admin)
    return {"ok": True, "name": admin.name, "email": admin.email, "avatar": admin.avatar}

@app.get("/api/notification-settings")
def get_notification_settings(
    db: Session = Depends(get_db),
    admin: models.AdminUser = Depends(get_current_admin),
):
    settings = _notification_settings(db)
    return {"notifications": settings.enabled, "notifEmail": settings.recipients}

@app.put("/api/notification-settings")
def update_notification_settings(
    data: NotificationSettingsRequest,
    db: Session = Depends(get_db),
    admin: models.AdminUser = Depends(get_current_admin),
):
    settings = _notification_settings(db)
    settings.enabled = data.notifications
    settings.recipients = data.notifEmail.strip()
    db.commit()
    db.refresh(settings)
    return {"ok": True, "notifications": settings.enabled, "notifEmail": settings.recipients}

@app.post("/api/notifications/test")
def test_notification(
    db: Session = Depends(get_db),
    admin: models.AdminUser = Depends(get_current_admin),
):
    settings = _notification_settings(db)
    recipients = _parse_recipients(settings.recipients)
    result = _send_resend_email(
        recipients,
        "FY Intech CRM - Test Notification",
        "This is a test notification from your FY Intech CRM. Email notifications are working correctly.",
    )
    return {"ok": True, "id": result.get("id")}

@app.post("/api/notifications")
def send_manual_notification(
    data: NotificationRequest,
    db: Session = Depends(get_db),
    admin: models.AdminUser = Depends(get_current_admin),
):
    recipients = data.to_emails or _parse_recipients(_notification_settings(db).recipients)
    result = _send_resend_email(recipients, f"FY Intech CRM - {data.subject}", data.body)
    return {"ok": True, "id": result.get("id")}

@app.get("/api/health")
def health():
    return {"status": "ok"}

@app.get("/api/leads", response_model=List[LeadResponse])
def get_leads(
    db: Session = Depends(get_db),
    admin: models.AdminUser = Depends(get_current_admin),
):
    return db.query(models.Lead).all()

@app.get("/api/metrics")
def get_metrics(
    db: Session = Depends(get_db),
    admin: models.AdminUser = Depends(get_current_admin),
):
    total_leads = db.query(models.Lead).count()
    hot_prospects = db.query(models.Lead).filter(models.Lead.score >= 80).count()
    deals_closed = db.query(models.Lead).filter(models.Lead.status == "Proposal Sent").count()
    active_projects = db.query(models.Project).count()
    
    return [
        { "id": 1, "title": "Total Leads", "value": str(total_leads), "change": "+5.2%", "isPositive": True },
        { "id": 2, "title": "Hot Prospects", "value": str(hot_prospects), "change": "+12.1%", "isPositive": True },
        { "id": 3, "title": "Proposals Sent", "value": str(deals_closed), "change": "+2.4%", "isPositive": True },
        { "id": 4, "title": "Active Projects", "value": str(active_projects), "change": "+1", "isPositive": True }
    ]

class LeadStatusUpdate(BaseModel):
    status: str

@app.put("/api/leads/{lead_id}")
def update_lead_status(
    lead_id: int,
    update_data: LeadStatusUpdate,
    db: Session = Depends(get_db),
    admin: models.AdminUser = Depends(get_current_admin),
):
    lead = db.query(models.Lead).filter(models.Lead.id == lead_id).first()
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    previous_status = lead.status
    lead.status = update_data.status
    db.commit()
    db.refresh(lead)
    if previous_status != lead.status:
        _send_crm_notification(
            db,
            f"Lead Updated: {lead.company}",
            f"{lead.company} has moved from {previous_status} to {lead.status}.\n\nIndustry: {lead.industry}\nLocation: {lead.location}",
        )
    return lead

@app.get("/api/projects", response_model=List[ProjectResponse])
def get_projects(
    db: Session = Depends(get_db),
    admin: models.AdminUser = Depends(get_current_admin),
):
    return db.query(models.Project).all()

@app.post("/api/projects", response_model=ProjectResponse)
def create_project(
    data: ProjectCreate,
    db: Session = Depends(get_db),
    admin: models.AdminUser = Depends(get_current_admin),
):
    project = models.Project(**data.dict())
    db.add(project)
    db.commit()
    db.refresh(project)
    _send_crm_notification(
        db,
        f"New Project: {project.client}",
        f"A new active project has been created.\n\nClient: {project.client}\nProject: {project.project_name}\nService: {project.service_type}\nStage: {project.stage}\n\nNext Action:\n{project.next_action}",
    )
    return project

@app.put("/api/projects/{project_id}")
def update_project(
    project_id: int,
    update_data: ProjectUpdate,
    db: Session = Depends(get_db),
    admin: models.AdminUser = Depends(get_current_admin),
):
    project = db.query(models.Project).filter(models.Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    previous_stage = project.stage
    changed_fields = []
    for field, value in update_data.dict(exclude_none=True).items():
        if getattr(project, field) != value:
            changed_fields.append(field)
            setattr(project, field, value)
    db.commit()
    db.refresh(project)
    if changed_fields:
        if "stage" in changed_fields:
            subject = f"Project Stage Updated: {project.client}"
            body = f"The project \"{project.project_name}\" for {project.client} has moved from {previous_stage} to {project.stage}.\n\nUpdated: {project.last_update}\n\nNext Action:\n{project.next_action}"
        else:
            subject = f"Project Updated: {project.client}"
            body = f"The project \"{project.project_name}\" for {project.client} has been updated.\n\nCurrent Stage: {project.stage}\n\nNext Action:\n{project.next_action}"
        _send_crm_notification(db, subject, body)
    return project

@app.delete("/api/projects/{project_id}")
def delete_project(
    project_id: int,
    db: Session = Depends(get_db),
    admin: models.AdminUser = Depends(get_current_admin),
):
    project = db.query(models.Project).filter(models.Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    client = project.client
    project_name = project.project_name
    db.delete(project)
    db.commit()
    _send_crm_notification(
        db,
        f"Project Removed: {client}",
        f"The project \"{project_name}\" for {client} has been removed from Active Projects.",
    )
    return {"ok": True}

@app.post("/api/admin/import-leads")
def import_leads_csv(
    db: Session = Depends(get_db),
    admin: models.AdminUser = Depends(get_current_admin),
):
    csv_path = os.path.join(os.path.dirname(__file__), "..", "leads_database_export.csv")
    if not os.path.isfile(csv_path):
        raise HTTPException(status_code=404, detail="CSV file not found on server")

    imported = 0
    skipped = 0
    try:
        with open(csv_path, "r", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            for row in reader:
                company = (row.get("Company Name") or "").strip()
                if not company:
                    continue
                exists = db.query(models.Lead).filter(models.Lead.company == company).first()
                if exists:
                    skipped += 1
                    continue
                db.add(models.Lead(
                    company=company,
                    industry=(row.get("Industry") or "Unknown").strip()[:50],
                    location=(row.get("Location") or "Unknown").strip()[:50],
                    score=int(row.get("VR Potential Score (%)") or 50),
                    status=(row.get("Status") or "New").strip(),
                ))
                imported += 1
        db.commit()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    return {"ok": True, "imported": imported, "skipped": skipped}
