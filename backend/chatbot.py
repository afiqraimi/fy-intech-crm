"""
FY Intech AI Avatar Chatbot — the brain that powers the website AI assistant.
Uses DeepSeek API with a comprehensive knowledge base about FY Intech.
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
2. **Digital Twin** — 3D digital replicas of physical assets, facilities, or cities for planning 
   and monitoring.
3. **360° Virtual Tours** — Photorealistic VR property tours and interactive showroom experiences 
   for real estate, hotels, and events.
4. **Smart Classroom / Industrial LMS** — VR-based learning management system for TVET institutions 
   and corporate training.
5. **IoT Integration** — Connecting VR/AR with IoT sensors for real-time data visualization.
6. **Bespoke VR/AR Development** — Custom solutions tailored to client needs.

## TARGET INDUSTRIES
Oil & Gas, Manufacturing & Engineering, Healthcare & Medical, Construction & Infrastructure,
Telecommunications, Aerospace & Aviation, Logistics & Transportation, Banking & Finance,
Education & Training, Property Developer & Real Estate, Energy & Utilities, Government & GLC.

## KEY DIFFERENTIATORS
- Competency analytics with VR training — track trainee performance
- Mobile VR studio — on-site deployment capability
- Bespoke solutions — not off-the-shelf, tailored to each client
- Based in Malaysia, serving Southeast Asia

## NOTABLE PROJECTS
1. **MBJB VR City Planning POC** — Virtual Reality proof-of-concept for Majlis Bandaraya Johor Bahru, 
   demonstrating immersive walkthrough of proposed urban development zones.
2. **MBDK VR Heritage Walkthrough POC** — VR simulation for Majlis Bandaraya Diraja Klang, 
   showcasing redevelopment of Klang's heritage corridor with pedestrian-friendly streetscape.
3. **MBMB VR Tourism POC** — Immersive virtual tourism experience for Majlis Bandaraya Melaka 
   Bersejarah's UNESCO World Heritage zones (Jonker Street, A Famosa).

## COMPANY DETAILS
- Company: FY Intech Solution Sdn Bhd
- Website: www.fyintech.com
- Email: ask@fyintech.com
- Phone: +603-2188-71240
- Chief Project Officer: Farhan Yun Hanimi
- Location: Malaysia
- Specialization: Industrial high-risk simulation through Virtual Reality

## BENEFITS OF VR TRAINING
- Reduces training costs by up to 60%
- Improves safety compliance and reduces incident rates
- 4x higher engagement compared to traditional e-learning
- 75% better knowledge retention than classroom training
- Zero-risk environment for practicing dangerous scenarios
- Reduces onboarding time and decision errors

## HOW TO GET STARTED
Contact ask@fyintech.com or call +603-2188-71240 for a free consultation.
The team typically offers a 20-minute demo session to show how VR can fit your training strategy.
"""

SYSTEM_PROMPT = f"""You are the AI assistant for FY INTECH SOLUTION SDN BHD, a Malaysian company 
specializing in VR/AR/MR/XR solutions for enterprises. You are friendly, professional, and helpful.

RULES:
1. ONLY answer based on the knowledge provided below. If asked something outside this scope, 
   politely say you don't have that information and suggest contacting ask@fyintech.com.
2. Keep responses CONCISE — 2-4 sentences max. This is for a talking avatar, so answers 
   must be short and spoken naturally.
3. Be conversational. Start responses with phrases like "Great question!", "Sure!", 
   "I'd be happy to help with that."
4. If someone asks about pricing, say that FY Intech provides custom quotes based on project 
   scope and to contact the team for a consultation.
5. Never make up information. If unsure, direct them to www.fyintech.com or ask@fyintech.com.
6. When mentioning the company, say "FY Intech" (not "FY Intech Solution" in full every time).

KNOWLEDGE BASE:
{FY_INTECH_KNOWLEDGE}
"""

CONVERSATION_HISTORY = {}  # session_id -> list of messages


def chat(message: str, session_id: str = "default") -> str:
    """
    Process a user message and return the AI avatar's response.
    Uses DeepSeek API with FY Intech knowledge base.
    """
    if not deepseek:
        return ("I'm sorry, the AI service is not configured yet. "
                "Please contact ask@fyintech.com for assistance.")

    # Maintain short conversation history per session
    if session_id not in CONVERSATION_HISTORY:
        CONVERSATION_HISTORY[session_id] = [
            {"role": "system", "content": SYSTEM_PROMPT}
        ]
    
    history = CONVERSATION_HISTORY[session_id]
    history.append({"role": "user", "content": message})
    
    # Keep only last 10 messages to manage context
    if len(history) > 11:  # system prompt + 10 messages
        history = [history[0]] + history[-10:]
        CONVERSATION_HISTORY[session_id] = history

    try:
        response = deepseek.chat.completions.create(
            model="deepseek-chat",
            messages=history,
            temperature=0.7,
            max_tokens=200,  # Keep responses short for avatar speech
        )
        reply = response.choices[0].message.content or "I'm not sure about that. Let me connect you with our team at ask@fyintech.com."
        history.append({"role": "assistant", "content": reply})
        return reply
    except Exception as e:
        logger.error("Chat error: %s", e)
        return ("I'm having a moment. Please try again or reach us at "
                "ask@fyintech.com — we'd love to help!")
