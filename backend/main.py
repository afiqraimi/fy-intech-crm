from fastapi import FastAPI, Depends, Header, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from sqlalchemy.orm import Session
from sqlalchemy import text, inspect
import models
from database import engine, SessionLocal
from pydantic import BaseModel
from typing import List, Literal, Optional
from dotenv import load_dotenv
load_dotenv()
import base64
import bcrypt
import csv
import hashlib
import html
import hmac
import json
import os
import requests
import smtplib
import ssl
import time
import logging
from datetime import datetime, timezone
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

try:
    if os.environ.get("DATABASE_URL"):
        from pythonjsonlogger import jsonlogger as _jl
        _handler = logging.StreamHandler()
        _handler.setFormatter(_jl.JsonFormatter("%(asctime)s %(name)s %(levelname)s %(message)s"))
        logging.root.addHandler(_handler)
        logging.root.setLevel(logging.INFO)
    else:
        raise ImportError
except Exception:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(name)s] %(levelname)s: %(message)s")
logger = logging.getLogger("main")

models.Base.metadata.create_all(bind=engine)

def _migrate_lead_columns():
    try:
        inspector = inspect(engine)
        if "leads" not in inspector.get_table_names():
            return
        existing = {c["name"] for c in inspector.get_columns("leads")}

        is_postgres = "postgres" in str(engine.url)

        new_columns = [
            ("website", "TEXT", None),
            ("email_primary", "TEXT", None),
            ("email_additional", "TEXT", None),
            ("phone", "TEXT", None),
            ("address", "TEXT", None),
            ("personnel_data", "TEXT", None),
            ("priority", "TEXT", None),
            ("lead_source", "TEXT DEFAULT 'manual'", None),
            ("email_subject", "TEXT", None),
            ("email_body", "TEXT", None),
            ("social_media", "TEXT", None),
            ("tier", "TEXT", None),
            ("fax", "TEXT", None),
            ("contact_page", "TEXT", None),
            ("personalization_notes", "TEXT", None),
            ("notes_internal", "TEXT", None),
            ("last_email_sent_at", "TEXT", None),
        ]
        with engine.begin() as conn:
            for col_name, col_type, pg_type in new_columns:
                if col_name not in existing:
                    sql_type = pg_type if is_postgres and pg_type else col_type
                    sql = f"ALTER TABLE leads ADD COLUMN {col_name} {sql_type}"
                    conn.execute(text(sql))
                    logging.getLogger("main").info("Migrated column: %s (%s)", col_name, sql_type)
    except Exception as e:
        logging.getLogger("main").error("Migration error: %s", e)

_migrate_lead_columns()

# ─── Seed default admin on first startup ──────────────────────────────────────
def _hash(pw: str) -> str:
    return bcrypt.hashpw(pw.encode(), bcrypt.gensalt()).decode()

def _verify_password(plain: str, hashed: str) -> bool:
    if hashed.startswith("$2"):
        return bcrypt.checkpw(plain.encode(), hashed.encode())
    # Legacy SHA-256 fallback — upgrades on next password change
    return hashlib.sha256(plain.encode()).hexdigest() == hashed

def _normalize_email(email: str) -> str:
    return (email or "").strip().lower()

AUTH_SECRET = os.environ.get("AUTH_SECRET", "")
if not AUTH_SECRET or AUTH_SECRET == "dev-only-change-me":
    raise RuntimeError("AUTH_SECRET env var must be set to a strong random value before starting the server.")
AUTH_TOKEN_TTL_SECONDS = int(os.environ.get("AUTH_TOKEN_TTL_SECONDS", str(60 * 60 * 8)))

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
    admin_email = os.environ.get("ADMIN_EMAIL", "")
    admin_password = os.environ.get("ADMIN_PASSWORD", "")
    if not admin_email or not admin_password:
        logger.warning("ADMIN_EMAIL / ADMIN_PASSWORD not set — skipping admin seed.")
        return
    db = SessionLocal()
    try:
        if db.query(models.AdminUser).count() == 0:
            db.add(models.AdminUser(
                name="Admin User",
                email=admin_email.strip().lower(),
                password_hash=_hash(admin_password),
            ))
            db.commit()
            logger.info("Seeded default admin: %s", admin_email)
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

def seed_problem_solution():
    """Populate problem & solution for leads based on industry, if not already set."""
    db = SessionLocal()
    try:
        needs_update = db.query(models.Lead).filter(
            (models.Lead.problem == None) | (models.Lead.problem == "") |
            (models.Lead.solution == None) | (models.Lead.solution == "")
        ).all()
        if not needs_update:
            return

        industry_map = {
            "airlines/aviation": (
                "Lack of immersive, cost-effective crew training and safety drill simulations for ground and flight personnel. Conventional training requires grounding aircraft and incurs high logistical costs.",
                "FY Intech provides immersive VR-based cabin crew and pilot training simulations, enabling realistic emergency drills, aircraft familiarization, and maintenance procedure training without grounding actual aircraft — reducing costs by up to 60% while improving safety readiness.",
            ),
            "aviation & aerospace": (
                "Expensive and logistically complex manufacturing training and design review processes for aerospace components. Physical mockups are costly and slow to iterate.",
                "FY Intech develops VR aerospace manufacturing and design review simulations that enable engineers to collaboratively inspect 3D models at full scale, accelerating design cycles and reducing physical prototyping costs.",
            ),
            "oil & energy": (
                "High-risk on-site safety training for offshore platform and refinery workers. Real-world emergency drills are expensive, infrequent, and cannot safely replicate catastrophic scenarios.",
                "FY Intech deploys VR-powered offshore platform and safety simulations, allowing workers to practice emergency response, equipment handling, and hazard recognition in a zero-risk virtual environment — improving safety compliance and reducing incident rates.",
            ),
            "oil & gas": (
                "High-risk on-site safety training for offshore platform and refinery workers. Real-world emergency drills are expensive, infrequent, and cannot safely replicate catastrophic scenarios.",
                "FY Intech deploys VR-powered offshore platform and safety simulations, allowing workers to practice emergency response, equipment handling, and hazard recognition in a zero-risk virtual environment — improving safety compliance and reducing incident rates.",
            ),
            "construction": (
                "Ineffective stakeholder visualization of architectural designs leading to miscommunication, approval delays, and costly rework during construction phases.",
                "FY Intech delivers VR architectural walkthroughs and construction sequencing simulations, enabling real-time design review and clash detection before breaking ground — saving thousands in rework costs.",
            ),
            "information technology & services": (
                "Difficulty in demonstrating complex IT infrastructure, data center operations, and software solutions to non-technical clients and stakeholders.",
                "FY Intech creates interactive VR product demonstrations and data center walkthroughs that translate complex IT solutions into immersive, easy-to-understand experiences for decision-makers.",
            ),
            "information services": (
                "Difficulty in demonstrating complex IT infrastructure and data management solutions to non-technical clients and stakeholders.",
                "FY Intech creates interactive VR product demonstrations and data center walkthroughs that translate complex information services into immersive, easy-to-understand experiences for decision-makers.",
            ),
            "medical devices": (
                "Limited hands-on product training opportunities for surgeons and clinicians before device deployment. Physical training requires expensive equipment, cadavers, or live procedures.",
                "FY Intech designs VR-based medical device operation simulations, enabling surgeons and clinicians to practice device handling and procedures in a risk-free virtual environment — accelerating adoption and improving patient outcomes.",
            ),
            "hospital & health care": (
                "Insufficient immersive training for medical staff on complex procedures, emergency response, and patient empathy scenarios. Traditional methods lack realism and scalability.",
                "FY Intech builds VR healthcare training modules for surgical procedure simulation, patient interaction scenarios, and hospital emergency response drills — enhancing staff competency and patient care quality.",
            ),
            "logistics & supply chain": (
                "Inefficient warehouse layout planning, safety protocol training, and supply chain process visualization. Traditional training methods are paper-based and ineffective for spatial understanding.",
                "FY Intech provides VR warehouse simulation solutions for layout optimization, forklift safety training, and supply chain process visualization — reducing training time by 40% and improving operational safety.",
            ),
            "telecommunications": (
                "Challenging tower inspection training and network infrastructure visualization for field engineers. On-site training is hazardous and logistically complex.",
                "FY Intech offers VR-based telecom tower inspection simulations and network infrastructure walkthroughs for safer, more effective field engineer training without physical risk exposure.",
            ),
            "staffing & recruiting": (
                "Difficulty in assessing candidate practical skills and providing immersive employer branding experiences during recruitment. Traditional interviews fail to evaluate hands-on competencies.",
                "FY Intech develops VR-based job simulation assessments and virtual office tours that enhance candidate evaluation accuracy and employer brand perception in a competitive talent market.",
            ),
            "property developer": (
                "Limited ability to showcase unbuilt properties to potential buyers and investors. Traditional brochures and 2D renders fail to convey spatial experience and emotional connection.",
                "FY Intech creates photorealistic VR property tours and interactive showroom experiences, allowing buyers to explore properties before construction begins — increasing pre-sales conversion by up to 30%.",
            ),
            "real estate": (
                "Limited ability to showcase unbuilt properties and interiors to potential buyers and investors. Traditional brochures and 2D renders fail to convey spatial experience and emotional connection.",
                "FY Intech creates photorealistic VR property tours and interactive showroom experiences, allowing buyers to explore properties before construction begins — increasing pre-sales conversion by up to 30%.",
            ),
            "local council": (
                "Ineffective public engagement for urban planning proposals and smart city initiatives. Static presentations fail to convey the true impact of development projects to citizens.",
                "FY Intech builds VR urban planning and smart city simulation platforms that enable councils to present development proposals to citizens in an immersive, accessible format — improving public participation and approval rates.",
            ),
            "government administration": (
                "Ineffective public engagement for policy proposals, infrastructure projects, and citizen services. Traditional town halls and printed materials fail to reach younger demographics.",
                "FY Intech builds VR urban planning and smart city simulation platforms that enable government agencies to present proposals to citizens in an immersive, accessible format — improving public participation and approval rates.",
            ),
            "government relations": (
                "Difficulty in visually communicating policy impacts and development plans to diverse stakeholders including legislators, community leaders, and the public.",
                "FY Intech creates VR policy visualization platforms that demonstrate proposed changes and their impacts in an accessible, immersive format — building stakeholder consensus and public trust.",
            ),
            "banking": (
                "Lack of engaging tools for financial data visualization and branch experience innovation. Traditional dashboards overload users with complex spreadsheets and charts.",
                "FY Intech designs VR-based financial data dashboards and virtual branch experiences that transform complex data into intuitive 3D visualizations for faster, better-informed decision-making.",
            ),
            "financial services": (
                "Lack of engaging tools for financial data visualization, client portfolio reviews, and branch experience innovation. Traditional dashboards overload users with complex spreadsheets.",
                "FY Intech designs VR-based financial data dashboards and virtual advisory experiences that transform complex data into intuitive 3D visualizations for faster, better-informed client conversations.",
            ),
            "higher education": (
                "Limited immersive learning tools for technical and vocational subjects. Traditional lectures and textbooks struggle to engage digitally-native students and convey 3D concepts.",
                "FY Intech delivers VR classroom modules and virtual laboratory simulations, enabling students to conduct experiments and explore concepts in a fully immersive environment — improving engagement and knowledge retention.",
            ),
            "education management": (
                "Limited immersive learning tools for technical and vocational subjects. Traditional lectures and textbooks struggle to engage digitally-native students and convey complex 3D concepts.",
                "FY Intech delivers VR classroom modules and virtual laboratory simulations, enabling students to conduct experiments and explore concepts in a fully immersive environment — improving engagement and knowledge retention.",
            ),
            "automotive": (
                "Inefficient vehicle design review process requiring expensive physical prototypes, and limited immersive showroom experiences for customers.",
                "FY Intech provides VR automotive design studios and virtual showroom experiences that accelerate design iteration by 50% and enhance customer engagement through interactive 3D vehicle exploration.",
            ),
            "manufacturing": (
                "High training costs and safety risks for assembly line and equipment operation training. Traditional on-the-job training leads to production downtime and safety incidents.",
                "FY Intech creates VR manufacturing training simulations for assembly line procedures, equipment operation, and workplace safety protocols — reducing training costs and minimizing production disruptions.",
            ),
            "electrical/electronic manufacturing": (
                "High training costs and safety risks for electronics assembly, cleanroom operations, and equipment handling. Traditional training methods are slow and error-prone.",
                "FY Intech creates VR electronics manufacturing training simulations for PCB assembly, component handling, and ESD safety protocols — reducing training costs and improving quality control.",
            ),
            "maritime": (
                "Costly and time-consuming ship design reviews and crew safety training. Physical drills at sea are expensive, dangerous, and logistically complex to coordinate.",
                "FY Intech develops VR ship design walkthroughs and maritime safety training simulations that reduce design review cycles and improve crew emergency preparedness without vessel downtime.",
            ),
            "shipbuilding": (
                "Costly and time-consuming ship design reviews and construction planning. Physical mockups are impractical for large vessels, leading to expensive mid-construction changes.",
                "FY Intech develops VR ship design walkthroughs and construction sequencing simulations that enable full-scale 3D review, reducing costly mid-build modifications and accelerating delivery timelines.",
            ),
            "defense & space": (
                "Expensive and logistically complex tactical training and mission simulation exercises. Live exercises consume significant resources and cannot replicate all threat scenarios.",
                "FY Intech builds VR-based tactical training and mission rehearsal simulations that reduce exercise costs by 70% while maintaining training realism and expanding scenario variety.",
            ),
            "pharmaceuticals": (
                "Stringent cleanroom training requirements and complex manufacturing process visualization needs. GMP compliance training is time-consuming and must be repeated frequently.",
                "FY Intech provides VR cleanroom protocol training and pharmaceutical manufacturing process simulations for GMP compliance and staff competency — reducing training time and improving audit readiness.",
            ),
            "hospitality": (
                "Inability to provide immersive virtual previews of hotel facilities, event spaces, and guest experiences to potential clients and travel agents.",
                "FY Intech creates VR hotel tours and event venue walkthroughs, enabling prospective guests and event planners to explore facilities remotely — increasing direct bookings by 25%.",
            ),
            "retail": (
                "Limited ability to test store layouts and visualize merchandising before physical implementation. Planogram errors and poor layouts lead to lost sales and expensive refits.",
                "FY Intech delivers VR retail space planning and virtual merchandising simulations that optimize store design and customer flow — reducing refit costs and improving sales per square foot.",
            ),
            "architecture & planning": (
                "Clients struggle to visualize 2D plans and renders, leading to approval delays and misaligned expectations between architects and stakeholders.",
                "FY Intech provides immersive VR architectural walkthroughs that transform 2D blueprints into fully explorable 3D environments for client presentations — accelerating approvals and reducing revision cycles.",
            ),
            "civil engineering": (
                "Complex infrastructure projects are difficult to communicate to non-technical stakeholders including government bodies, investors, and affected communities.",
                "FY Intech builds VR infrastructure visualization tools that allow civil engineering firms to showcase bridges, highways, and developments in immersive detail — improving stakeholder buy-in.",
            ),
            "design": (
                "Clients struggle to visualize and approve 2D design concepts before production. Flat renders fail to convey spatial relationships and material qualities.",
                "FY Intech provides VR design review environments where clients can walk through and interact with 3D design concepts in real-time — reducing revision cycles by 40%.",
            ),
            "environmental services": (
                "Difficulty in communicating environmental impact assessments and sustainability plans to stakeholders, regulators, and affected communities.",
                "FY Intech creates VR environmental impact simulations that visualize proposed developments and their ecological effects in an immersive format — improving transparency and public trust.",
            ),
            "renewables & environment": (
                "Difficulty communicating renewable energy project benefits and long-term environmental impact to communities, investors, and regulatory bodies.",
                "FY Intech builds VR renewable energy visualization experiences that demonstrate solar farms, wind turbines, and hydro projects to stakeholders in an immersive, compelling format — accelerating project approvals.",
            ),
            "security & investigations": (
                "Limited realistic scenario training for security personnel and crime scene analysis. Tabletop exercises and classroom training fail to replicate real-world pressure and spatial context.",
                "FY Intech develops VR security scenario training and crime scene reconstruction simulations for enhanced investigative skills and rapid threat response capabilities.",
            ),
            "insurance": (
                "Inefficient risk assessment training and claims process visualization for adjusters. Paper-based case studies lack the spatial context needed for accurate property and liability assessments.",
                "FY Intech provides VR-based risk assessment simulations and claims scenario training that improve adjuster accuracy and decision-making through realistic 3D property walkthroughs.",
            ),
            "professional training & coaching": (
                "Low engagement and knowledge retention in conventional corporate training programs. Slide-based e-learning fails to develop practical skills and decision-making abilities.",
                "FY Intech delivers white-label VR corporate training modules with immersive scenarios that boost engagement by 4x and improve knowledge retention by up to 75% compared to traditional methods.",
            ),
            "food & beverages": (
                "Limited ability to showcase production facilities and quality processes to B2B clients, auditors, and retail partners. Physical tours are disruptive to production.",
                "FY Intech creates VR factory tours and production line walkthroughs, enabling food & beverage companies to demonstrate hygiene and quality standards to potential partners without disrupting operations.",
            ),
            "food production": (
                "Limited ability to showcase production facilities and quality processes to B2B clients, auditors, and retail partners. Physical tours are disruptive to food safety protocols.",
                "FY Intech creates VR factory tours and production line walkthroughs, enabling food production companies to demonstrate hygiene and quality standards to potential partners without disrupting operations.",
            ),
            "computer games": (
                "Need for partnership in developing immersive VR gaming content and experiences that stand out in a competitive entertainment market.",
                "FY Intech offers VR game development collaboration, providing expertise in immersive environments, 3D asset optimization, and user experience design for next-generation gaming experiences.",
            ),
            "semiconductors": (
                "High-cost cleanroom training and complex equipment familiarization for technicians. Contamination risks during physical training are unacceptable in semiconductor fabrication.",
                "FY Intech builds VR cleanroom and semiconductor equipment training simulations that reduce training costs by 50% while eliminating contamination risks during technician onboarding.",
            ),
            "events services": (
                "Clients struggle to visualize event layouts, lighting designs, and venue setups before execution, leading to last-minute changes and client dissatisfaction.",
                "FY Intech provides VR event planning and venue visualization tools that allow clients to experience and refine setups before the actual event — reducing changes and improving satisfaction.",
            ),
            "law practice": (
                "Difficulty in presenting complex case reconstructions and forensic evidence to juries, judges, and clients in an understandable format.",
                "FY Intech develops VR crime scene and accident reconstruction simulations that enhance courtroom presentations, improve juror understanding, and strengthen case arguments.",
            ),
            "sports": (
                "Limited tools for athlete performance analysis, tactical training visualization, and fan engagement experiences beyond traditional video and statistics.",
                "FY Intech creates VR sports training and fan experience modules that visualize player movements and provide immersive stadium experiences — enhancing both athlete development and fan loyalty.",
            ),
            "tobacco": (
                "Limited B2B product demonstration and manufacturing process visualization capabilities for international partners and regulatory audits.",
                "FY Intech provides VR-based product line tours and manufacturing process demonstrations for B2B stakeholder engagement — enabling remote quality assurance and partner collaboration.",
            ),
            "farming": (
                "Lack of immersive training tools for precision agriculture techniques, equipment operation, and sustainable farming practices.",
                "FY Intech develops VR precision farming simulations for crop management training, equipment familiarization, and sustainable farming education — improving agricultural productivity and sustainability.",
            ),
            "chemicals": (
                "High-risk chemical handling training and plant safety protocol education needs. Live training with hazardous materials poses unacceptable safety risks to trainees.",
                "FY Intech creates VR chemical plant safety simulations for hazardous material handling, emergency response, and standard operating procedure training — ensuring safety compliance with zero risk.",
            ),
            "venture capital & private equity": (
                "Difficulty evaluating startup products, manufacturing facilities, and physical assets without costly and time-consuming on-site visits across multiple geographies.",
                "FY Intech builds VR due diligence platforms that allow investors to virtually experience portfolio company products, facilities, and prototypes — accelerating investment decisions.",
            ),
            "investment management": (
                "Difficulty in visualizing portfolio data and presenting complex investment theses to clients and investment committees effectively.",
                "FY Intech provides VR financial data visualization platforms that transform portfolio analytics into immersive 3D dashboards — enabling faster, more intuitive investment decision-making.",
            ),
            "market research": (
                "Limited ability to test consumer reactions to physical products, store layouts, and packaging designs before committing to expensive production runs.",
                "FY Intech provides VR consumer research environments where companies can test product placement, packaging, and store design with realistic consumer feedback — reducing go-to-market risk.",
            ),
            "accounting": (
                "Difficulty in presenting complex financial data, audit findings, and forensic accounting results to non-financial stakeholders in an understandable way.",
                "FY Intech creates VR data visualization dashboards that transform complex financial data into intuitive 3D representations for stakeholder presentations and audit reporting.",
            ),
            "luxury goods & jewelry": (
                "Inability to offer immersive virtual try-on and product showcase experiences for remote high-net-worth clients who expect premium, personalized service.",
                "FY Intech develops VR luxury product showrooms and virtual try-on experiences that enable brands to engage high-value clients regardless of location — expanding market reach.",
            ),
            "apparel & fashion": (
                "Limited ability to showcase collections and offer virtual try-on experiences for online shoppers, leading to high return rates and low online conversion.",
                "FY Intech creates VR fashion showrooms and virtual fitting experiences that bridge the gap between online shopping and in-store experience — reducing returns and boosting online sales.",
            ),
            "nonprofit organization management": (
                "Limited tools to communicate social impact and create emotional connections with donors, volunteers, and stakeholders.",
                "FY Intech builds VR impact storytelling experiences that immerse donors in the communities and causes they support — driving empathy, engagement, and fundraising results.",
            ),
            "civic & social organization": (
                "Limited public engagement tools for community initiatives and social programs. Traditional outreach methods fail to reach younger, digitally-native demographics.",
                "FY Intech develops VR community engagement platforms that visualize social impact initiatives for public and donor audiences — increasing participation and support.",
            ),
            "outsourcing/offshoring": (
                "Difficulty in showcasing operational capabilities, facility standards, and workplace culture to potential offshore clients who cannot visit in person.",
                "FY Intech provides VR facility tours and operational capability demonstrations that build client confidence without requiring physical visits — accelerating client acquisition.",
            ),
            "paper & forest products": (
                "Limited ability to demonstrate sustainable forestry practices and manufacturing processes to environmentally-conscious stakeholders and certification bodies.",
                "FY Intech creates VR sustainability and mill operation walkthroughs that showcase responsible forestry and manufacturing practices — strengthening brand reputation and compliance.",
            ),
            "plastics": (
                "Challenging to demonstrate complex injection molding and extrusion manufacturing processes to B2B clients and new employees.",
                "FY Intech develops VR plastic manufacturing process simulations for client education and workforce training — improving sales conversion and reducing onboarding time.",
            ),
            "publishing": (
                "Limited immersive content delivery channels for digital publications and educational materials in an increasingly visual and interactive media landscape.",
                "FY Intech provides VR publishing platforms that transform traditional content into immersive, interactive reading and learning experiences — opening new revenue streams.",
            ),
            "utilities": (
                "High-risk utility infrastructure training and emergency response drill limitations. Substation, water treatment, and power grid training carries significant safety hazards.",
                "FY Intech builds VR utility infrastructure simulations for power grid, water treatment, and emergency response training — improving safety while maintaining training effectiveness.",
            ),
            "energy": (
                "High-risk utility and energy infrastructure training with limited safe environments for emergency response and equipment handling drills.",
                "FY Intech builds VR energy infrastructure simulations for power generation, grid management, and emergency response training — improving safety and operational efficiency.",
            ),
            "internet": (
                "Need for innovative user experience demonstrations and data center infrastructure visualization for client and investor presentations.",
                "FY Intech creates VR data center walkthroughs and internet infrastructure demonstrations for client and investor presentations — differentiating service offerings in a commodity market.",
            ),
            "international trade & development": (
                "Limited tools for cross-border project visualization and stakeholder alignment across different time zones, languages, and cultural contexts.",
                "FY Intech develops VR project visualization platforms that enable international stakeholders to collaboratively review development projects regardless of physical location — accelerating global partnerships.",
            ),
            "online media": (
                "Need for immersive content formats to differentiate in a crowded digital media landscape where user attention spans continue to decline.",
                "FY Intech provides VR content production services that transform traditional media into immersive 360-degree experiences — capturing audience attention and increasing engagement metrics.",
            ),
            "marketing & advertising": (
                "Traditional advertising media failing to capture audience attention in a saturated market. Consumers increasingly ignore conventional ad formats.",
                "FY Intech creates VR marketing experiences and immersive brand activations that deliver memorable, high-engagement consumer interactions — achieving 5x higher brand recall.",
            ),
            "management consulting": (
                "Limited tools for client workshop facilitation, strategic scenario visualization, and change management communication beyond slide decks and spreadsheets.",
                "FY Intech builds VR strategy visualization environments where consulting firms can run immersive workshops and present complex scenarios to clients — differentiating service delivery.",
            ),
            "consumer services": (
                "Difficulty differentiating service offerings and demonstrating service quality in a competitive market where consumers cannot experience the service before purchase.",
                "FY Intech develops VR service experience previews that allow potential customers to virtually experience service quality before committing — increasing conversion and reducing churn.",
            ),
            "transportation/trucking/railroad": (
                "High training costs and safety risks for drivers and rail operators. Traditional training requires expensive equipment, fuel, and exposes trainees to real-world hazards.",
                "FY Intech creates VR driver training simulations for trucks, rail operators, and logistics vehicles — reducing training costs by 50% and improving safety outcomes through risk-free scenario practice.",
            ),
            "package/freight delivery": (
                "Inefficient warehouse and delivery route training for new logistics staff. High turnover rates make traditional onboarding costly and inconsistent.",
                "FY Intech provides VR logistics training modules for warehouse operations, package handling, and last-mile delivery optimization — accelerating onboarding and reducing operational errors.",
            ),
            "building materials": (
                "Inability to showcase material applications, textures, and finishes in realistic architectural contexts for architects, builders, and property developers.",
                "FY Intech develops VR material showrooms that allow architects and builders to visualize building materials in realistic 3D environments — accelerating specification decisions.",
            ),
            "machinery": (
                "Costly equipment demonstrations and operator training for heavy machinery. Transporting equipment for demos is logistically complex, and training on live machinery poses safety risks.",
                "FY Intech creates VR heavy machinery operation simulations that provide safe, scalable operator training and product demonstrations — reducing demo costs and safety incidents.",
            ),
            "mechanical or industrial engineering": (
                "Complex engineering designs are difficult to review collaboratively with non-technical stakeholders, leading to misunderstandings and late-stage design changes.",
                "FY Intech provides VR engineering design review platforms that enable collaborative 3D model walkthroughs for faster design approval and fewer costly late changes.",
            ),
            "human resources": (
                "Low engagement in employee onboarding, diversity & inclusion training, and soft skills development programs delivered through traditional e-learning formats.",
                "FY Intech develops VR-based employee onboarding and soft skills training modules with immersive role-play scenarios — increasing engagement and behavioral change.",
            ),
            "mental health care": (
                "Limited therapeutic tools for exposure therapy, anxiety management, and creating controlled therapeutic environments for patient treatment.",
                "FY Intech builds VR therapeutic environments for anxiety treatment, phobia exposure therapy, and mindfulness training — expanding treatment options for mental health professionals.",
            ),
            "health": (
                "Generic wellness and health education tools with low user engagement. Traditional health communication fails to motivate behavioral change.",
                "FY Intech develops VR health education and wellness modules that provide immersive anatomy exploration and healthy lifestyle training — improving health literacy and behavior change.",
            ),
            "facilities services": (
                "Difficulty in training staff on complex facility layouts, emergency procedures, and equipment locations across large or multiple sites.",
                "FY Intech provides VR facility familiarization tours and emergency procedure training for facility management staff — accelerating onboarding and improving emergency preparedness.",
            ),
            "leisure": (
                "Need to differentiate leisure experiences and attract digitally-native consumers in a competitive entertainment and recreation market.",
                "FY Intech creates VR-enhanced leisure experiences and virtual attraction previews that drive visitor interest, repeat visits, and social media engagement.",
            ),
            "e-learning": (
                "Low learner engagement and completion rates in traditional online courses. Flat video and text content fails to maintain attention or develop practical skills.",
                "FY Intech provides VR e-learning content development that transforms courses into immersive, interactive learning experiences — achieving 4x higher completion rates.",
            ),
            "research": (
                "Limited tools for collaborative data visualization and complex concept communication among geographically distributed research teams.",
                "FY Intech provides VR research visualization platforms that enable researchers to collaboratively explore complex data sets and molecular models in 3D — accelerating discovery.",
            ),
            "computer & network security": (
                "Limited immersive training for cybersecurity incident response and SOC operations. Tabletop exercises fail to replicate the pressure and complexity of real cyber attacks.",
                "FY Intech creates VR cybersecurity training simulations that place teams in realistic incident response scenarios for hands-on practice — improving response readiness.",
            ),
            "health, wellness & fitness": (
                "Low engagement and retention in health and wellness programs. Traditional fitness and wellness apps fail to provide the immersive motivation needed for sustained behavioral change.",
                "FY Intech develops VR wellness and fitness experiences — including guided meditation environments, immersive workout programs, and therapeutic relaxation spaces — that boost user engagement and program adherence.",
            ),
            "leisure, travel & tourism": (
                "Inability to provide immersive previews of destinations, accommodations, and attractions to potential travelers, limiting booking confidence and conversion.",
                "FY Intech creates VR travel experiences and virtual destination tours that allow travelers to explore hotels, attractions, and destinations before booking — increasing booking confidence and conversion rates.",
            ),
            "rail transportation": (
                "High training costs and safety risks for train operators, maintenance crews, and station staff. Live training on active rail systems is dangerous and disrupts operations.",
                "FY Intech builds VR rail operations training simulations for train driving, track maintenance, and station emergency response — reducing training costs and improving safety compliance.",
            ),
            "conglomerate": (
                "Diverse business units across multiple industries struggling with inconsistent training quality, fragmented stakeholder visualization, and high operational costs.",
                "FY Intech provides enterprise VR solutions across multiple verticals — from employee training and safety simulations to stakeholder presentations and product demonstrations — delivering consistent quality and cost savings across business units.",
            ),
        }

        default_problem = "Traditional methods of training, visualization, and stakeholder engagement are inefficient, costly, and fail to deliver immersive experiences that drive decision-making."
        default_solution = "FY Intech Solution Sdn Bhd provides custom VR solutions — including immersive training simulations, 360° virtual tours, and interactive 3D visualizations — tailored to your industry to reduce costs, improve safety, and accelerate business outcomes."

        updated = 0
        for lead in needs_update:
            industry = (lead.industry or "").strip().lower()
            problem, solution = industry_map.get(industry, (default_problem, default_solution))
            lead.problem = problem
            lead.solution = solution
            updated += 1

        db.commit()
        if updated:
            print(f"Seeded problem/solution for {updated} leads.")
    finally:
        db.close()

def _safe_call(fn, name):
    try:
        fn()
    except Exception as e:
        logging.getLogger("main").error("Startup seed '%s' failed: %s", name, e)

_safe_call(seed_admin, "seed_admin")
_safe_call(seed_leads, "seed_leads")
_safe_call(seed_projects, "seed_projects")
_safe_call(seed_problem_solution, "seed_problem_solution")

limiter = Limiter(key_func=get_remote_address)
app = FastAPI(title="FY Intech CRM API")
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

_raw_origins = os.environ.get("ALLOWED_ORIGINS", "")
_ALLOWED_ORIGINS = [o.strip() for o in _raw_origins.split(",") if o.strip()] or ["*"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.middleware("http")
async def security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    return response

def _validate_env():
    optional_vars = ["FIRECRAWL_API_KEY", "DEEPSEEK_API_KEY", "LIVEAVATAR_API_KEY", "ADMIN_EMAIL", "ADMIN_PASSWORD"]
    for var in optional_vars:
        if not os.environ.get(var):
            logger.warning("Missing env var: %s — some features may not work.", var)

@app.on_event("startup")
def on_startup():
    _validate_env()
    try:
        from scheduler import start_scheduler
        start_scheduler()
    except Exception:
        logger.warning("Scheduler not started (missing deps or config)")

@app.on_event("shutdown")
def on_shutdown():
    try:
        from scheduler import shutdown_scheduler
        shutdown_scheduler()
    except Exception:
        pass

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
    website: str | None = None
    email_primary: str | None = None
    email_additional: str | None = None
    phone: str | None = None
    address: str | None = None
    personnel_data: str | None = None
    priority: str | None = None
    lead_source: str | None = None
    email_subject: str | None = None
    email_body: str | None = None
    social_media: str | None = None
    tier: str | None = None
    fax: str | None = None
    contact_page: str | None = None
    personalization_notes: str | None = None
    notes_internal: str | None = None
    last_email_sent_at: str | None = None

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
            "from": os.environ.get("RESEND_SENDER") or os.environ.get("NOTIFICATION_FROM", "FY Intech CRM <onboarding@resend.dev>"),
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

def _send_gmail_email(to_email: str, subject: str, body: str) -> None:
    sender = os.environ.get("GMAIL_SENDER")
    password = os.environ.get("GMAIL_APP_PASSWORD")
    if not sender or not password:
        raise HTTPException(status_code=500, detail="Gmail credentials are not configured on the backend.")

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = f"FY Intech CRM <{sender}>"
    msg["To"] = to_email

    escaped = html.escape(body).replace("\n", "<br />")
    html_body = f"""<html><body style="font-family:Arial,sans-serif;color:#333;padding:20px;">
      <div style="max-width:600px;margin:0 auto;">
        <p style="line-height:1.8;font-size:14px;">{escaped}</p>
        <hr style="border:none;border-top:1px solid #eee;margin:24px 0;"/>
        <p style="color:#999;font-size:11px;">Sent via FY Intech CRM</p>
      </div>
    </body></html>"""

    msg.attach(MIMEText(body, "plain"))
    msg.attach(MIMEText(html_body, "html"))

    context = ssl.create_default_context()
    with smtplib.SMTP_SSL("smtp.gmail.com", 465, context=context) as server:
        server.login(sender, password)
        server.sendmail(sender, to_email, msg.as_string())

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
@limiter.limit("5/minute")
def login(request: Request, data: LoginRequest, db: Session = Depends(get_db)):
    email = _normalize_email(data.email)
    admin = db.query(models.AdminUser).filter(
        models.AdminUser.email == email
    ).first()
    if not admin or not _verify_password(data.password, admin.password_hash):
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
    if not _verify_password(data.current_password, admin.password_hash):
        raise HTTPException(status_code=401, detail="Current password is incorrect")
    if data.new_email:
        admin.email = _normalize_email(data.new_email)
    if data.new_password:
        if len(data.new_password) < 8:
            raise HTTPException(status_code=400, detail="Password must be at least 8 characters")
        admin.password_hash = _hash(data.new_password)
    if data.new_name:
        admin.name = data.new_name
    if data.new_avatar is not None:
        if len(data.new_avatar) > 2_000_000:
            raise HTTPException(status_code=400, detail="Avatar image too large (max ~2 MB)")
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

LeadStatus = Literal["New", "To Approach", "Proposal Sent", "Negotiation", "Closed Won", "Closed", "In Progress", "Approached"]

@app.get("/api/leads", response_model=List[LeadResponse])
def get_leads(
    skip: int = 0,
    limit: int = 200,
    db: Session = Depends(get_db),
    admin: models.AdminUser = Depends(get_current_admin),
):
    try:
        limit = min(limit, 500)
        from sqlalchemy import case
        status_order = case(
            (models.Lead.status == "Proposal Sent", 0),
            (models.Lead.status == "Approached", 1),
            (models.Lead.status == "To Approach", 2),
            (models.Lead.status == "New", 3),
            else_=4,
        )
        return (
            db.query(models.Lead)
            .order_by(status_order, models.Lead.id.desc())
            .offset(skip)
            .limit(limit)
            .all()
        )
    except Exception as e:
        logger.error("get_leads failed: %s", e)
        raise HTTPException(status_code=500, detail="Failed to fetch leads")

@app.get("/api/metrics")
def get_metrics(
    db: Session = Depends(get_db),
    admin: models.AdminUser = Depends(get_current_admin),
):
    try:
        total_leads = db.query(models.Lead).count()
        hot_prospects = db.query(models.Lead).filter(models.Lead.score >= 80).count()
        deals_closed = db.query(models.Lead).filter(models.Lead.status == "Proposal Sent").count()
        active_projects = db.query(models.Project).count()
    except Exception as e:
        logging.getLogger("main").error("get_metrics failed: %s", e)
        total_leads = 0
        hot_prospects = 0
        deals_closed = 0
        active_projects = 0
    
    return [
        { "id": 1, "title": "Total Leads", "value": str(total_leads), "change": "+5.2%", "isPositive": True },
        { "id": 2, "title": "Hot Prospects", "value": str(hot_prospects), "change": "+12.1%", "isPositive": True },
        { "id": 3, "title": "Proposals Sent", "value": str(deals_closed), "change": "+2.4%", "isPositive": True },
        { "id": 4, "title": "Active Projects", "value": str(active_projects), "change": "+1", "isPositive": True }
    ]

class LeadStatusUpdate(BaseModel):
    status: Optional[str] = None
    problem: Optional[str] = None
    solution: Optional[str] = None
    website: Optional[str] = None
    email_primary: Optional[str] = None
    email_additional: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    personnel_data: Optional[str] = None
    priority: Optional[str] = None
    email_subject: Optional[str] = None
    email_body: Optional[str] = None
    tier: Optional[str] = None
    personalization_notes: Optional[str] = None
    fax: Optional[str] = None
    contact_page: Optional[str] = None
    social_media: Optional[str] = None
    notes_internal: Optional[str] = None

class LeadCreate(BaseModel):
    company: str
    industry: str
    location: str = ""
    score: int = 50
    status: str = "To Approach"
    problem: Optional[str] = None
    solution: Optional[str] = None
    website: Optional[str] = None
    email_primary: Optional[str] = None
    email_additional: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    personnel_data: Optional[str] = None
    priority: Optional[str] = None
    lead_source: Optional[str] = "manual"

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
    if update_data.status is not None:
        lead.status = update_data.status
    if update_data.problem is not None:
        lead.problem = update_data.problem
    if update_data.solution is not None:
        lead.solution = update_data.solution
    if update_data.website is not None:
        lead.website = update_data.website
    if update_data.email_primary is not None:
        lead.email_primary = update_data.email_primary
    if update_data.email_additional is not None:
        lead.email_additional = update_data.email_additional
    if update_data.phone is not None:
        lead.phone = update_data.phone
    if update_data.address is not None:
        lead.address = update_data.address
    if update_data.personnel_data is not None:
        lead.personnel_data = update_data.personnel_data
    if update_data.priority is not None:
        lead.priority = update_data.priority
    if update_data.email_subject is not None:
        lead.email_subject = update_data.email_subject
    if update_data.email_body is not None:
        lead.email_body = update_data.email_body
    if update_data.tier is not None:
        lead.tier = update_data.tier
    if update_data.personalization_notes is not None:
        lead.personalization_notes = update_data.personalization_notes
    if update_data.fax is not None:
        lead.fax = update_data.fax
    if update_data.contact_page is not None:
        lead.contact_page = update_data.contact_page
    if update_data.social_media is not None:
        lead.social_media = update_data.social_media
    if update_data.notes_internal is not None:
        lead.notes_internal = update_data.notes_internal
    db.commit()
    db.refresh(lead)
    if previous_status != lead.status:
        _send_crm_notification(
            db,
            f"Lead Updated: {lead.company}",
            f"{lead.company} has moved from {previous_status} to {lead.status}.\n\nIndustry: {lead.industry}\nLocation: {lead.location}",
        )
    return lead

class SendEmailRequest(BaseModel):
    to_email: Optional[str] = None
    subject: Optional[str] = None
    body: Optional[str] = None

@app.post("/api/leads/{lead_id}/send-email")
def send_lead_email(
    lead_id: int,
    data: SendEmailRequest,
    db: Session = Depends(get_db),
    admin: models.AdminUser = Depends(get_current_admin),
):
    lead = db.query(models.Lead).filter(models.Lead.id == lead_id).first()
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")

    to_email = data.to_email or lead.email_primary
    subject = data.subject or lead.email_subject
    body = data.body or lead.email_body

    if not to_email:
        raise HTTPException(status_code=400, detail="No recipient email address on this lead.")
    if not subject or not body:
        raise HTTPException(status_code=400, detail="Email subject and body cannot be empty.")

    try:
        _send_gmail_email(to_email, subject, body)
    except HTTPException:
        raise
    except Exception as exc:
        logger.error("send_lead_email failed: %s", exc)
        raise HTTPException(status_code=500, detail=f"Failed to send email: {str(exc)}")

    lead.last_email_sent_at = datetime.now(timezone.utc).isoformat()
    db.commit()
    db.refresh(lead)
    return {"ok": True, "sent_to": to_email, "last_email_sent_at": lead.last_email_sent_at}

@app.post("/api/leads", response_model=LeadResponse)
def create_lead(
    data: LeadCreate,
    db: Session = Depends(get_db),
    admin: models.AdminUser = Depends(get_current_admin),
):
    existing = db.query(models.Lead).filter(models.Lead.company == data.company).first()
    if existing:
        raise HTTPException(status_code=409, detail=f"Lead '{data.company}' already exists")
    lead = models.Lead(**data.model_dump())
    db.add(lead)
    db.commit()
    db.refresh(lead)
    return lead

@app.post("/api/leads/batch", response_model=List[LeadResponse])
def create_leads_batch(
    data: List[LeadCreate],
    db: Session = Depends(get_db),
    admin: models.AdminUser = Depends(get_current_admin),
):
    created = []
    skipped = 0
    for item in data:
        existing = db.query(models.Lead).filter(models.Lead.company == item.company).first()
        if existing:
            skipped += 1
            continue
        lead = models.Lead(**item.model_dump())
        db.add(lead)
        created.append(lead)
    db.commit()
    for lead in created:
        db.refresh(lead)
    return created

@app.get("/api/projects", response_model=List[ProjectResponse])
def get_projects(
    skip: int = 0,
    limit: int = 200,
    db: Session = Depends(get_db),
    admin: models.AdminUser = Depends(get_current_admin),
):
    limit = min(limit, 500)
    return db.query(models.Project).offset(skip).limit(limit).all()

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
                try:
                    score = max(0, min(100, int(row.get("VR Potential Score (%)") or 50)))
                except (ValueError, TypeError):
                    score = 50
                db.add(models.Lead(
                    company=company,
                    industry=(row.get("Industry") or "Unknown").strip()[:50],
                    location=(row.get("Location") or "Unknown").strip()[:50],
                    score=score,
                    status=(row.get("Status") or "New").strip(),
                ))
                imported += 1
        db.commit()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    return {"ok": True, "imported": imported, "skipped": skipped}

class LeadEngineTrigger(BaseModel):
    industry: str = "Oil & Gas"
    revenue_range: str = "RM10M-50M"

import threading

_sweep_status = {
    "running": False,
    "total": 0,
    "current": 0,
    "current_desc": "",
    "total_created": 0,
    "total_skipped": 0,
    "errors": 0,
    "results": [],
    "finished": False,
}
_sweep_lock = threading.Lock()

@app.post("/api/admin/lead-engine/sweep")
def sweep_all_industries(
    admin: models.AdminUser = Depends(get_current_admin),
):
    global _sweep_status
    with _sweep_lock:
        if _sweep_status["running"]:
            raise HTTPException(status_code=409, detail="A sweep is already running")
        _sweep_status = {
            "running": True,
            "total": 0,
            "current": 0,
            "current_desc": "Starting...",
            "total_created": 0,
            "total_skipped": 0,
            "errors": 0,
            "results": [],
            "finished": False,
        }

    def _run():
        global _sweep_status
        try:
            from lead_schedule import load_schedule
            from lead_engine import run_pipeline
            entries = [e for e in load_schedule() if e.get("enabled", True)]
            with _sweep_lock:
                _sweep_status["total"] = len(entries)

            for i, entry in enumerate(entries):
                industry = entry["industry"]
                revenue_range = entry["revenue_range"]
                desc = entry.get("description", f"{industry} | {revenue_range}")
                with _sweep_lock:
                    _sweep_status["current"] = i + 1
                    _sweep_status["current_desc"] = desc

                try:
                    result = run_pipeline(industry, revenue_range)
                    created = result.get("created", 0)
                    skipped = result.get("skipped", 0)
                    with _sweep_lock:
                        _sweep_status["total_created"] += created
                        _sweep_status["total_skipped"] += skipped
                        _sweep_status["results"].append({
                            "description": desc,
                            "created": created,
                            "skipped": skipped,
                            "error": result.get("error"),
                        })
                except Exception as e:
                    with _sweep_lock:
                        _sweep_status["errors"] += 1
                        _sweep_status["results"].append({
                            "description": desc,
                            "created": 0,
                            "skipped": 0,
                            "error": str(e),
                        })
            with _sweep_lock:
                _sweep_status["finished"] = True
        except Exception as e:
            with _sweep_lock:
                _sweep_status["errors"] += 1
                _sweep_status["results"].append({
                    "description": "FATAL",
                    "created": 0,
                    "skipped": 0,
                    "error": str(e),
                })
                _sweep_status["finished"] = True
        finally:
            with _sweep_lock:
                _sweep_status["running"] = False

    threading.Thread(target=_run, daemon=True).start()
    return {"started": True}

@app.get("/api/admin/lead-engine/sweep-status")
def sweep_status(
    admin: models.AdminUser = Depends(get_current_admin),
):
    with _sweep_lock:
        return dict(_sweep_status)

@app.post("/api/admin/lead-engine/enrich-existing")
def enrich_existing_leads(
    admin: models.AdminUser = Depends(get_current_admin),
):
    global _enrich_status
    with _enrich_lock:
        if _enrich_status["running"]:
            raise HTTPException(status_code=409, detail="Enrichment already running")
        _enrich_status = {"running": True, "total": 0, "current": 0, "current_company": "", "enriched": 0, "results": [], "finished": False}

    def _run():
        global _enrich_status
        try:
            from lead_engine import draft_outreach_with_ai, deepseek_client
            if not deepseek_client:
                with _enrich_lock:
                    _enrich_status["finished"] = True
                    _enrich_status["running"] = False
                return

            db = SessionLocal()
            try:
                leads = db.query(models.Lead).filter(
                    (models.Lead.email_subject == None)
                    | (models.Lead.email_body == None)
                    | (models.Lead.tier == None)
                    | (models.Lead.personalization_notes == None)
                ).all()

                with _enrich_lock:
                    _enrich_status["total"] = len(leads)

                if not leads:
                    with _enrich_lock:
                        _enrich_status["finished"] = True
                        _enrich_status["running"] = False
                    return

                for lead in leads:
                    with _enrich_lock:
                        _enrich_status["current"] += 1
                        _enrich_status["current_company"] = lead.company

                    try:
                        company_data = [{"name": lead.company, "website": lead.website or "", "industry": lead.industry or "Unknown"}]
                        result = draft_outreach_with_ai(company_data, lead.industry or "Unknown")
                        if result and len(result) > 0:
                            r = result[0]
                            lead.email_subject = (r.get("email_subject") or "")[:500]
                            lead.email_body = (r.get("email_body") or "")[:5000]
                            lead.tier = (r.get("tier") or "")[:20]
                            lead.personalization_notes = (r.get("personalization_notes") or "")[:2000]
                            lead.notes_internal = (r.get("notes") or "")[:2000]
                            lead.fax = (r.get("fax") or "")[:100]
                            lead.contact_page = (r.get("contact_page") or "")[:500]
                            lead.social_media = json.dumps(r.get("social_media") or {}, ensure_ascii=False)[:2000]
                            if not lead.problem:
                                lead.problem = (r.get("pain_points") or "")[:1000]
                            if not lead.solution:
                                lead.solution = (r.get("proposed_solution") or "")[:1000]
                            if not lead.priority:
                                lead.priority = (r.get("priority") or "Warm")[:50]
                            db.commit()
                            with _enrich_lock:
                                _enrich_status["enriched"] += 1
                        time.sleep(2)
                    except Exception as e:
                        logging.getLogger("main").warning("Enrich failed for %s: %s", lead.company, e)
                        with _enrich_lock:
                            _enrich_status["results"].append({"company": lead.company, "error": str(e)})
            finally:
                db.close()
        except Exception as e:
            logging.getLogger("main").error("Enrichment fatal: %s", e)
        finally:
            with _enrich_lock:
                _enrich_status["finished"] = True
                _enrich_status["running"] = False

    threading.Thread(target=_run, daemon=True).start()
    return {"started": True}

_enrich_status = {"running": False, "total": 0, "current": 0, "current_company": "", "enriched": 0, "results": [], "finished": False}
_enrich_lock = threading.Lock()

@app.get("/api/admin/lead-engine/enrich-status")
def enrich_status(
    admin: models.AdminUser = Depends(get_current_admin),
):
    with _enrich_lock:
        return dict(_enrich_status)

_trigger_status = {"running": False, "step": "", "created": 0, "skipped": 0, "industry": "", "revenue_range": "", "error": None, "finished": False}
_trigger_lock = threading.Lock()

@app.post("/api/admin/lead-engine/trigger")
def trigger_lead_engine(
    data: LeadEngineTrigger,
    admin: models.AdminUser = Depends(get_current_admin),
):
    global _trigger_status
    with _trigger_lock:
        if _trigger_status["running"]:
            raise HTTPException(status_code=409, detail="A trigger is already running")
        _trigger_status = {
            "running": True,
            "step": "Searching for companies\u2026",
            "created": 0,
            "skipped": 0,
            "industry": data.industry,
            "revenue_range": data.revenue_range,
            "error": None,
            "finished": False,
        }

    def _run():
        global _trigger_status
        try:
            from lead_engine import run_pipeline
            with _trigger_lock:
                _trigger_status["step"] = "Searching companies via Firecrawl\u2026"
            result = run_pipeline(data.industry, data.revenue_range)
            if result.get("error"):
                with _trigger_lock:
                    _trigger_status["error"] = result["error"]
            else:
                with _trigger_lock:
                    _trigger_status["created"] = result.get("created", 0)
                    _trigger_status["skipped"] = result.get("skipped", 0)
        except Exception as e:
            with _trigger_lock:
                _trigger_status["error"] = str(e)
        finally:
            with _trigger_lock:
                _trigger_status["finished"] = True
                _trigger_status["running"] = False
                _trigger_status["step"] = "Complete"

    threading.Thread(target=_run, daemon=True).start()
    return {"started": True}

@app.get("/api/admin/lead-engine/trigger-status")
def trigger_status(
    admin: models.AdminUser = Depends(get_current_admin),
):
    with _trigger_lock:
        return dict(_trigger_status)

@app.get("/api/admin/lead-engine/schedule")
def get_lead_schedule(
    admin: models.AdminUser = Depends(get_current_admin),
):
    try:
        from lead_schedule import load_schedule
        return load_schedule()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

class FirecrawlTestRequest(BaseModel):
    query: str = "Oil & Gas company Malaysia"

@app.post("/api/admin/lead-engine/test-firecrawl")
def test_firecrawl(
    data: FirecrawlTestRequest,
    admin: models.AdminUser = Depends(get_current_admin),
):
    try:
        key = os.environ.get("FIRECRAWL_API_KEY", "")
        resp = requests.post(
            "https://api.firecrawl.dev/v1/search",
            headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
            json={"query": data.query, "limit": 5},
            timeout=60,
        )
        return {"status": resp.status_code, "response": resp.json()}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/admin/leads/clear-demo")
def clear_demo_leads(
    admin: models.AdminUser = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    try:
        deleted = db.query(models.Lead).filter(
            (models.Lead.lead_source == None) | (models.Lead.lead_source == "manual")
        ).delete(synchronize_session=False)
        db.commit()
        return {"deleted": deleted}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

# ─── AI Avatar Chat Endpoint ──────────────────────────────────────────────────

class ChatRequest(BaseModel):
    message: str
    session_id: Optional[str] = None

class ChatResponse(BaseModel):
    reply: str

@app.post("/api/public/chat", response_model=ChatResponse)
@limiter.limit("10/minute")
def public_chat(request: Request, data: ChatRequest):
    """Public chatbot endpoint for the website AI avatar. No auth required."""
    try:
        from chatbot import chat as chatbot_chat
    except Exception as e:
        return ChatResponse(reply="I'm still warming up! Please try again in a moment.")
    reply = chatbot_chat(data.message, data.session_id or "default")
    return ChatResponse(reply=reply)

# ─── LiveAvatar (Interactive Avatar) Endpoint ─────────────────────────────────

LIVEAVATAR_API_KEY = os.environ.get("LIVEAVATAR_API_KEY", "")
LIVEAVATAR_CONTEXT_ID = os.environ.get("LIVEAVATAR_CONTEXT_ID", "07019418-9343-4f61-a120-f1aeca737598")
LIVEAVATAR_AVATAR_ID = os.environ.get("LIVEAVATAR_AVATAR_ID", "dd73ea75-1218-4ef3-92ce-606d5f7fbc0a")
LIVEAVATAR_VOICE_ID = os.environ.get("LIVEAVATAR_VOICE_ID", "c2527536-6d1f-4412-a643-53a3497dada9")

class AvatarTokenResponse(BaseModel):
    session_token: str
    session_id: str


_context_cache: dict = {"ts": 0.0}
_CONTEXT_CACHE_TTL = 30  # 30 seconds — short enough to always reflect new data


def _update_context_with_live_data():
    """Query the CRM database and inject live stats into the LiveAvatar context.
    Creates its own DB session to avoid dependency injection issues."""
    _log = logging.getLogger("liveavatar")
    now = time.time()
    if now - _context_cache["ts"] < _CONTEXT_CACHE_TTL:
        _log.info("LiveAvatar context cache hit, skipping update")
        return
    try:
        from database import SessionLocal
        db = SessionLocal()

        import models
        # Lead stats
        total_leads = db.query(models.Lead).count()
        new_leads = db.query(models.Lead).filter(models.Lead.status == "New").count()
        in_progress = db.query(models.Lead).filter(models.Lead.status.in_(["To Approach", "Approached", "Proposal Sent"])).count()
        closed_leads = db.query(models.Lead).filter(models.Lead.status == "Closed").count()

        # Recent leads — top 10 newest
        recent = db.query(models.Lead).order_by(models.Lead.id.desc()).limit(10).all()

        # ALL active projects (no stage filter means nothing is missed)
        projects = db.query(models.Project).filter(
            ~models.Project.stage.in_(["Completed", "Deployed", "Closed"])
        ).order_by(models.Project.last_update.desc()).limit(20).all()

        # All projects including completed (so avatar knows full history)
        all_projects = db.query(models.Project).order_by(models.Project.last_update.desc()).limit(30).all()

        db.close()

        # Lead engine schedule
        from lead_schedule import load_schedule
        schedule = load_schedule()
        enabled_count = sum(1 for s in schedule if s.get("enabled", False))

        # Build text
        lines = [
            "LIVE CRM DATA (current as of this session):",
            f"- Total leads in database: {total_leads}",
            f"- New leads: {new_leads}",
            f"- Leads in pipeline (To Approach / Approached / Proposal Sent): {in_progress}",
            f"- Closed leads: {closed_leads}",
        ]
        if recent:
            lines.append("- 10 most recently added companies:")
            for l in recent:
                lines.append(f"  * {l.company} ({l.industry}) — Status: {l.status}, Score: {l.score}%")
        if projects:
            lines.append(f"- Active projects ({len(projects)} total):")
            for p in projects:
                lines.append(f"  * {p.project_name} for {p.client} — Stage: {p.stage}, Last updated: {p.last_update}")
                if p.next_action:
                    lines.append(f"    Next action: {p.next_action}")
        else:
            lines.append("- No active projects currently.")
        if all_projects:
            completed = [p for p in all_projects if p.stage in ["Completed", "Deployed", "Closed"]]
            if completed:
                lines.append(f"- Completed/Deployed projects ({len(completed)}):")
                for p in completed:
                    lines.append(f"  * {p.project_name} for {p.client} — Stage: {p.stage}")
        lines.append(f"- Lead Engine: {enabled_count} of 12 industries scheduled daily (2AM-1PM MYT)")
        
        live_text = "\n".join(lines)
        
        # Fetch current prompt
        get_resp = requests.get(
            f"https://api.liveavatar.com/v1/contexts/{LIVEAVATAR_CONTEXT_ID}",
            headers={"X-API-KEY": LIVEAVATAR_API_KEY},
            timeout=15,
        )
        data = get_resp.json()
        base = data["data"]["prompt"]
        ctx_name = data["data"]["name"]
        ctx_opening = data["data"]["opening_text"]
        
        # Strip any previous live data section (between markers) and append fresh data
        import re
        cleaned = re.sub(r'\n\n--- LIVE CRM DATA START ---\n.*?\n--- LIVE CRM DATA END ---', '', base, flags=re.DOTALL)
        
        updated = f"{cleaned}\n\n--- LIVE CRM DATA START ---\n{live_text}\n--- LIVE CRM DATA END ---\n\nIMPORTANT: When users ask about CRM data, lead counts, recent activity, or anything about this website (fy-intech-crm.vercel.app), use the CRM data above. Say 'as of now' or 'currently' when citing numbers."
        
        requests.patch(
            f"https://api.liveavatar.com/v1/contexts/{LIVEAVATAR_CONTEXT_ID}",
            headers={"X-API-KEY": LIVEAVATAR_API_KEY, "Content-Type": "application/json"},
            json={
                "name": ctx_name,
                "prompt": updated,
                "opening_text": ctx_opening,
            },
            timeout=15,
        )
        _context_cache["ts"] = time.time()
        _log.info("LiveAvatar context updated with live CRM data")
    except Exception as e:
        _log.error("Failed to update LiveAvatar context: %s", e)

@app.post("/api/public/avatar-token")
@limiter.limit("10/minute")
def create_avatar_token(request: Request):
    """Create a LiveAvatar session token for the public website avatar.
    Injects live CRM data into the context before each session. No auth."""
    if not LIVEAVATAR_API_KEY:
        raise HTTPException(status_code=503, detail="LiveAvatar not configured")

    _update_context_with_live_data()  # refresh context with latest CRM data

    try:
        # ── Create session token ─────────────────────────────────────────
        token_resp = requests.post(
            "https://api.liveavatar.com/v1/sessions/token",
            headers={
                "X-API-KEY": LIVEAVATAR_API_KEY,
                "Content-Type": "application/json",
            },
            json={
                "mode": "FULL",
                "is_sandbox": False,
                "max_duration": 300,
                "avatar_id": LIVEAVATAR_AVATAR_ID,
                "avatar_persona": {
                    "voice_id": LIVEAVATAR_VOICE_ID,
                    "context_id": LIVEAVATAR_CONTEXT_ID,
                    "language": "en",
                },
            },
            timeout=30,
        )
        token_data = token_resp.json()
        
        if token_data.get("code") != 1000:
            detail = str(token_data.get("message", "Unknown error"))
            if "concurrency" in detail.lower():
                raise HTTPException(status_code=429, detail="Avatar is busy right now. Please wait a moment and try again.")
            raise HTTPException(status_code=502, detail=f"LiveAvatar error: {detail}")
        
        return AvatarTokenResponse(
            session_token=token_data["data"]["session_token"],
            session_id=token_data["data"]["session_id"],
        )
    except requests.RequestException as e:
        logger.error("LiveAvatar request failed: %s", e)
        raise HTTPException(status_code=502, detail=f"Avatar service unavailable. Try again later.")

@app.post("/api/public/avatar-embed")
@limiter.limit("10/minute")
def create_avatar_embed(request: Request):
    """Create a LiveAvatar embed for the public website. No auth."""
    if not LIVEAVATAR_API_KEY:
        raise HTTPException(status_code=503, detail="LiveAvatar not configured")

    _update_context_with_live_data()  # refresh context with latest CRM data

    try:
        # ── Create the embed ─────────────────────────────────────────────
        resp = requests.post(
            "https://api.liveavatar.com/v2/embeddings",
            headers={
                "X-API-KEY": LIVEAVATAR_API_KEY,
                "Content-Type": "application/json",
            },
            json={
                "avatar_id": LIVEAVATAR_AVATAR_ID,
                "context_id": LIVEAVATAR_CONTEXT_ID,
                "voice_id": LIVEAVATAR_VOICE_ID,
                "is_sandbox": False,
                "max_duration": 300,
                "default_language": "en",
            },
            timeout=30,
        )
        data = resp.json()
        
        if data.get("code") != 1000:
            detail = str(data.get("message", "Unknown error"))
            raise HTTPException(status_code=502, detail=f"LiveAvatar error: {detail}")
        
        return {"url": data["data"]["url"], "embed_id": data["data"]["embed_id"]}
    except requests.RequestException as e:
        logger.error("LiveAvatar embed request failed: %s", e)
        raise HTTPException(status_code=502, detail=f"Avatar service unavailable. Try again later.")
