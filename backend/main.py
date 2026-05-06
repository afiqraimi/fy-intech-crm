from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
import models
from database import engine, SessionLocal
from pydantic import BaseModel
from typing import List, Optional
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import hashlib

models.Base.metadata.create_all(bind=engine)

# ─── Seed default admin on first startup ──────────────────────────────────────
def _hash(pw: str) -> str:
    return hashlib.sha256(pw.encode()).hexdigest()

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

seed_admin()

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

@app.post("/api/auth/login")
def login(data: LoginRequest, db: Session = Depends(get_db)):
    admin = db.query(models.AdminUser).filter(
        models.AdminUser.email == data.email
    ).first()
    if not admin or admin.password_hash != _hash(data.password):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    return {
        "ok": True,
        "name": admin.name,
        "email": admin.email,
        "avatar": admin.avatar,
    }

@app.put("/api/auth/update")
def update_credentials(data: UpdateCredentialsRequest, db: Session = Depends(get_db)):
    admin = db.query(models.AdminUser).first()
    if not admin:
        raise HTTPException(status_code=404, detail="Admin not found")
    if admin.password_hash != _hash(data.current_password):
        raise HTTPException(status_code=401, detail="Current password is incorrect")
    if data.new_email:
        admin.email = data.new_email
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
    return {"ok": True, "name": admin.name, "email": admin.email, "avatar": admin.avatar}

@app.get("/api/auth/profile")
def get_profile(db: Session = Depends(get_db)):
    admin = db.query(models.AdminUser).first()
    if not admin:
        raise HTTPException(status_code=404, detail="Admin not found")
    return {"name": admin.name, "email": admin.email, "avatar": admin.avatar}

@app.put("/api/auth/profile")
def update_profile(data: ProfileUpdateRequest, db: Session = Depends(get_db)):
    admin = db.query(models.AdminUser).first()
    if not admin:
        raise HTTPException(status_code=404, detail="Admin not found")
    if data.name:
        admin.name = data.name
    if data.avatar is not None:
        admin.avatar = data.avatar
    db.commit()
    db.refresh(admin)
    return {"ok": True, "name": admin.name, "email": admin.email, "avatar": admin.avatar}

@app.get("/api/health")
def health():
    return {"status": "ok"}

@app.get("/api/leads", response_model=List[LeadResponse])
def get_leads(db: Session = Depends(get_db)):
    return db.query(models.Lead).all()

@app.get("/api/metrics")
def get_metrics(db: Session = Depends(get_db)):
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
def update_lead_status(lead_id: int, update_data: LeadStatusUpdate, db: Session = Depends(get_db)):
    lead = db.query(models.Lead).filter(models.Lead.id == lead_id).first()
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    lead.status = update_data.status
    db.commit()
    db.refresh(lead)
    return lead

@app.get("/api/projects", response_model=List[ProjectResponse])
def get_projects(db: Session = Depends(get_db)):
    return db.query(models.Project).all()

@app.post("/api/projects", response_model=ProjectResponse)
def create_project(data: ProjectCreate, db: Session = Depends(get_db)):
    project = models.Project(**data.dict())
    db.add(project)
    db.commit()
    db.refresh(project)
    return project

@app.put("/api/projects/{project_id}")
def update_project(project_id: int, update_data: ProjectUpdate, db: Session = Depends(get_db)):
    from fastapi import HTTPException
    project = db.query(models.Project).filter(models.Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    for field, value in update_data.dict(exclude_none=True).items():
        setattr(project, field, value)
    db.commit()
    db.refresh(project)
    return project

@app.delete("/api/projects/{project_id}")
def delete_project(project_id: int, db: Session = Depends(get_db)):
    from fastapi import HTTPException
    project = db.query(models.Project).filter(models.Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    db.delete(project)
    db.commit()
    return {"ok": True}

class EmailNotification(BaseModel):
    to_emails: List[str]       # Multiple recipients
    smtp_email: str
    smtp_password: str
    subject: str
    body: str

@app.post("/api/send-notification")
def send_notification(data: EmailNotification):
    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = data.subject
        msg["From"] = data.smtp_email
        msg["To"] = ", ".join(data.to_emails)

        html_body = f"""
        <html><body style="font-family:Arial,sans-serif;background:#0a0a0a;color:#fff;padding:30px;">
          <div style="max-width:600px;margin:0 auto;background:#121212;border:1px solid #262626;border-radius:16px;overflow:hidden;">
            <div style="background:linear-gradient(135deg,#1a1a2e,#16213e);padding:30px;text-align:center;">
              <h1 style="color:#fff;font-size:22px;margin:0;">FY Intech CRM</h1>
              <p style="color:#a3a3a3;font-size:12px;margin:8px 0 0;">Intelligence Platform Notification</p>
            </div>
            <div style="padding:30px;">
              <p style="color:#e5e5e5;line-height:1.6;font-size:14px;">{data.body}</p>
            </div>
            <div style="padding:15px 30px;border-top:1px solid #262626;text-align:center;">
              <p style="color:#525252;font-size:11px;margin:0;">FY Intech CRM &bull; Automated Notification</p>
            </div>
          </div>
        </body></html>
        """

        msg.attach(MIMEText(data.body, "plain"))
        msg.attach(MIMEText(html_body, "html"))

        with smtplib.SMTP_SSL("smtp.gmail.com", 465) as server:
            server.login(data.smtp_email, data.smtp_password)
            server.sendmail(data.smtp_email, data.to_emails, msg.as_string())

        return {"ok": True, "message": f"Email sent to {len(data.to_emails)} recipient(s)"}
    except smtplib.SMTPAuthenticationError:
        raise HTTPException(status_code=401, detail="Gmail authentication failed. Check your App Password.")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
