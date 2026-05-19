"""
FY Intech AI Avatar Chatbot — the brain that powers the website AI assistant.
Uses DeepSeek API with comprehensive knowledge base + LIVE CRM data.
"""
import os
import logging
from openai import OpenAI

logger = logging.getLogger("chatbot")

DEEPSEEK_API_KEY = os.environ.get("DEEPSEEK_API_KEY", "")
DEEPSEEK_BASE = "https://api.deepseek.com"

deepseek = None
if DEEPSEEK_API_KEY:
    deepseek = OpenAI(api_key=DEEPSEEK_API_KEY, base_url=DEEPSEEK_BASE)

# ─── FY INTECH KNOWLEDGE BASE ─────────────────────────────────────────────────

FY_INTECH_KNOWLEDGE = """
## COMPANY OVERVIEW
FY Intech Solution Sdn Bhd is a Malaysian technology company specializing in Virtual Reality (VR), 
Augmented Reality (AR), Mixed Reality (MR), and Extended Reality (XR) solutions for enterprises 
and government agencies.

## CORE SERVICES
1. **VR Training Simulations** — Industrial high-risk simulation for safety training, equipment 
   operation, and emergency response. Replaces traditional onboarding with immersive VR.
2. **Digital Twin** — 3D digital replicas of physical assets, facilities, or cities for planning.
3. **360° Virtual Tours** — Photorealistic VR property tours and interactive showroom experiences.
4. **Smart Classroom / Industrial LMS** — VR-based learning management system for TVET institutions.
5. **IoT Integration** — Connecting VR/AR with IoT sensors for real-time data visualization.
6. **Bespoke VR/AR Development** — Custom solutions tailored to client needs.

## TARGET INDUSTRIES
Oil & Gas, Manufacturing & Engineering, Healthcare & Medical, Construction & Infrastructure,
Telecommunications, Aerospace & Aviation, Logistics & Transportation, Banking & Finance,
Education & Training, Property Developer & Real Estate, Energy & Utilities, Government & GLC.

## KEY DIFFERENTIATORS
- Competency analytics with VR training — track trainee performance
- Mobile VR studio — on-site deployment capability
- Bespoke solutions — tailored to each client
- Based in Malaysia, serving Southeast Asia

## COMPANY DETAILS
- Website: www.fyintech.com
- Email: ask@fyintech.com
- Phone: +603-2188-71240
- Chief Project Officer: Farhan Yun Hanimi
- Location: Malaysia

## BENEFITS OF VR TRAINING
- Reduces training costs by up to 60%
- Improves safety compliance and reduces incident rates
- 4x higher engagement than traditional e-learning
- 75% better knowledge retention
- Zero-risk environment for dangerous scenarios

## PRICING
FY Intech provides custom quotes based on project scope. Contact for consultation.
"""

SYSTEM_PROMPT_TEMPLATE = """You are the AI assistant for FY INTECH SOLUTION SDN BHD, a Malaysian company 
specializing in VR/AR/MR/XR solutions for enterprises. You are friendly, professional, and helpful.

RULES:
1. Answer based on the knowledge provided below. If asked something outside this scope, 
   say you don't have that info and suggest contacting ask@fyintech.com.
2. Keep responses CONCISE — 2-4 sentences for spoken responses, slightly longer for lists.
3. Be conversational and warm.
4. Never make up information. If unsure, direct them to www.fyintech.com.
5. When mentioning the company, say "FY Intech".
6. When showing project lists, format them cleanly with bullet points.
7. If LIVE DATA is provided below, use it to answer questions about current projects/leads.

KNOWLEDGE BASE:
{FY_INTECH_KNOWLEDGE}

LIVE CRM DATA:
{live_data}
"""

CONVERSATION_HISTORY = {}


def _get_live_data() -> str:
    """Fetch current projects and stats from the CRM database."""
    try:
        from database import SessionLocal
        import models
        db = SessionLocal()
        try:
            # Active projects (not completed/deployed)
            projects = db.query(models.Project).filter(
                ~models.Project.stage.in_(["Completed", "Deployed", "Closed"])
            ).order_by(models.Project.last_update.desc()).limit(10).all()
            
            # Lead stats
            total_leads = db.query(models.Lead).count()
            new_leads = db.query(models.Lead).filter(models.Lead.status == "New").count()
            in_progress = db.query(models.Lead).filter(models.Lead.status == "In Progress").count()
            
            lines = []
            
            if projects:
                lines.append("## CURRENT PROJECTS:")
                for p in projects:
                    lines.append(f"- {p.project_name} (Client: {p.client}, Stage: {p.stage})")
            else:
                lines.append("## CURRENT PROJECTS: No active projects at the moment.")
            
            lines.append(f"\n## LEAD STATS: {total_leads} total leads, {new_leads} new, {in_progress} in progress")
            
            return "\n".join(lines)
        finally:
            db.close()
    except Exception as e:
        logger.warning("Failed to fetch live data: %s", e)
        return "## LIVE DATA: Temporarily unavailable"


def chat(message: str, session_id: str = "default") -> str:
    """Process a user message and return the AI avatar's response."""
    if not deepseek:
        return ("I'm sorry, the AI service is not configured yet. "
                "Please contact ask@fyintech.com for assistance.")

    # Fetch live CRM data
    live_data = _get_live_data()
    
    system_prompt = SYSTEM_PROMPT_TEMPLATE.format(
        FY_INTECH_KNOWLEDGE=FY_INTECH_KNOWLEDGE,
        live_data=live_data,
    )

    if session_id not in CONVERSATION_HISTORY:
        CONVERSATION_HISTORY[session_id] = [
            {"role": "system", "content": system_prompt}
        ]
    else:
        # Update system prompt with latest live data each turn
        CONVERSATION_HISTORY[session_id][0] = {"role": "system", "content": system_prompt}

    history = CONVERSATION_HISTORY[session_id]
    history.append({"role": "user", "content": message})

    # Keep last 10 messages
    if len(history) > 11:
        history = [history[0]] + history[-10:]
        CONVERSATION_HISTORY[session_id] = history

    try:
        response = deepseek.chat.completions.create(
            model="deepseek-chat",
            messages=history,
            temperature=0.7,
            max_tokens=300,
        )
        reply = response.choices[0].message.content or "I'm not sure about that. Let me connect you with our team at ask@fyintech.com."
        history.append({"role": "assistant", "content": reply})
        return reply
    except Exception as e:
        logger.error("Chat error: %s", e)
        return ("I'm having a moment. Please try again or reach us at "
                "ask@fyintech.com — we'd love to help!")
