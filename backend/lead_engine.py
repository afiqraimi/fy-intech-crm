import os
import json
import time
import logging
from typing import Optional

import requests
from openai import OpenAI

from database import SessionLocal
import models

logger = logging.getLogger("lead_engine")

FIRECRAWL_API_KEY = os.environ.get("FIRECRAWL_API_KEY", "")
FIRECRAWL_BASE = "https://api.firecrawl.dev/v1"
FIRECRAWL_TIMEOUT = 300

DEEPSEEK_API_KEY = os.environ.get("DEEPSEEK_API_KEY", "")
DEEPSEEK_BASE = "https://api.deepseek.com"

deepseek_client: Optional[OpenAI] = None
if DEEPSEEK_API_KEY:
    deepseek_client = OpenAI(api_key=DEEPSEEK_API_KEY, base_url=DEEPSEEK_BASE)


def _firecrawl_headers():
    return {
        "Authorization": f"Bearer {FIRECRAWL_API_KEY}",
        "Content-Type": "application/json",
    }



def _generate_search_queries(industry: str, revenue_range: str) -> list[str]:
    if not deepseek_client:
        return [f"{industry} company Malaysia {revenue_range}"]

    try:
        response = deepseek_client.chat.completions.create(
            model="deepseek-chat",
            messages=[
                {"role": "system", "content": "You are a search query generator. Output only a JSON array of strings. No other text."},
                {
                    "role": "user",
                    "content": (
                        f"Generate 5 short keyword search queries (3-7 words each) "
                        f"to find companies in the {industry} industry with revenue {revenue_range} "
                        f"in Malaysia and Singapore. Prioritize Berhad, GLC, and large private companies. "
                        f"Return as JSON array. Example: [\"Oil & Gas company Malaysia Berhad\", \"petroleum services firm Kuala Lumpur\"]"
                    ),
                },
            ],
            temperature=0.4,
            max_tokens=512,
        )
        raw = response.choices[0].message.content or ""
        start = raw.find("[")
        end = raw.rfind("]") + 1
        if start != -1 and end > start:
            queries = json.loads(raw[start:end])
            if isinstance(queries, list) and queries:
                return queries[:5]
    except Exception as e:
        logger.warning("Query generation failed: %s", e)

    return [f"{industry} company Malaysia {revenue_range}"]


def _fallback_known_companies(industry: str, revenue_range: str, limit: int = 15) -> list[dict]:
    if not deepseek_client:
        return []

    try:
        response = deepseek_client.chat.completions.create(
            model="deepseek-chat",
            messages=[
                {"role": "system", "content": "You are a business directory. Return only valid JSON. No other text."},
                {
                    "role": "user",
                    "content": (
                        f"List {limit} REAL companies in the {industry} industry with revenue around {revenue_range} "
                        f"operating in Malaysia or Singapore. Include publicly listed (Berhad), GLC, and large private companies. "
                        f"Return as JSON array with objects: "
                        f'{{"name": "Full Company Name", "website": "https://official-website.com"}}. '
                        f"Include only REAL companies you are confident exist."
                    ),
                },
            ],
            temperature=0.3,
            max_tokens=4096,
        )
        raw = response.choices[0].message.content or ""
        start = raw.find("[")
        end = raw.rfind("]") + 1
        if start != -1 and end > start:
            companies = json.loads(raw[start:end])
            if isinstance(companies, list):
                return companies[:limit]
    except Exception as e:
        logger.warning("Fallback company listing failed: %s", e)

    return []


def search_companies(industry: str, revenue_range: str, limit: int = 15) -> list[dict]:
    if not FIRECRAWL_API_KEY:
        raise RuntimeError("FIRECRAWL_API_KEY not configured")

    queries = _generate_search_queries(industry, revenue_range)
    logger.info("Searching with %d queries for: %s | %s", len(queries), industry, revenue_range)

    for i, query in enumerate(queries):
        logger.info("  Query %d/%d: %s", i + 1, len(queries), query)
        try:
            resp = requests.post(
                f"{FIRECRAWL_BASE}/search",
                headers=_firecrawl_headers(),
                json={"query": query, "limit": limit},
                timeout=FIRECRAWL_TIMEOUT,
            )
            logger.info("  Firecrawl response: status=%d", resp.status_code)

            try:
                body_text = resp.text[:300]
            except Exception:
                body_text = "(cannot read)"

            data = resp.json()

            if data.get("success") and data.get("data"):
                results = []
                for item in data["data"]:
                    name = item.get("title") or item.get("name") or ""
                    website = item.get("url") or ""
                    if name and website:
                        results.append({"name": name.strip(), "website": website.strip()})
                if results:
                    logger.info("Found %d companies via query: %s", len(results), query)
                    return results
                logger.info("  Query returned 0 usable results. Body: %s", body_text)
            else:
                logger.info("  Query returned no success. Body: %s", body_text)

        except Exception as e:
            logger.warning("  Search query '%s' failed: %s", query, e)

    logger.info("All %d search queries returned 0 results. Trying DeepSeek fallback...", len(queries))
    fallback = _fallback_known_companies(industry, revenue_range, limit)
    if fallback:
        logger.info("DeepSeek fallback returned %d companies", len(fallback))
        return fallback

    logger.warning("No companies found after search + fallback")
    return []
def scrape_contacts(companies: list[dict]) -> list[dict]:
    if not FIRECRAWL_API_KEY:
        raise RuntimeError("FIRECRAWL_API_KEY not configured")

    enriched = []
    for i, company in enumerate(companies):
        url = company["website"]
        logger.info("Scraping [%d/%d] %s", i + 1, len(companies), url)
        try:
            resp = requests.post(
                f"{FIRECRAWL_BASE}/scrape",
                headers=_firecrawl_headers(),
                json={
                    "url": url,
                    "formats": ["markdown"],
                    "onlyMainContent": True,
                    "timeout": 60000,
                },
                timeout=FIRECRAWL_TIMEOUT,
            )
            resp.raise_for_status()
            data = resp.json()
            markdown = ""
            if data.get("success") and data.get("data"):
                markdown = data["data"].get("markdown", "")

            company["scraped_content"] = markdown[:15000]
            company["scraped_url"] = data.get("data", {}).get("metadata", {}).get("url", url) if data.get("success") else url
            enriched.append(company)
        except Exception as e:
            logger.warning("Scrape failed for %s: %s", url, e)
            company["scraped_content"] = ""
            company["scraped_url"] = url
            enriched.append(company)

        time.sleep(1.5)

    return enriched


def extract_contacts_with_ai(companies: list[dict]) -> list[dict]:
    if not deepseek_client:
        raise RuntimeError("DEEPSEEK_API_KEY not configured")

    urls_text = "\n".join(
        f"{i+1}. {c['name']} — {c['website']}"
        for i, c in enumerate(companies)
    )

    content_parts = []
    for c in companies:
        if c.get("scraped_content"):
            content_parts.append(
                f"=== {c['name']} ({c['website']}) ===\n{c['scraped_content'][:3000]}"
            )
    content_text = "\n\n".join(content_parts) if content_parts else "(no content scraped)"

    system_prompt = (
        "You are a B2B contact extraction specialist. Extract contact information "
        "from scraped website content. For each company, find:\n"
        "- Primary email address\n"
        "- Additional emails (if any)\n"
        "- Phone number(s)\n"
        "- Full physical address\n"
        "- Key personnel names and titles (decision makers, C-suite, department heads)\n\n"
        "Return your response as a valid JSON array with this exact structure:\n"
        '[{"name": "Company Name", "website": "https://...", '
        '"email_primary": "email@example.com", "email_additional": "other@example.com", '
        '"phone": "+60-3-1234-5678", "address": "Full address here", '
        '"personnel_data": "Name - Title; Name - Title"}]'
    )

    logger.info("Extracting contacts with DeepSeek for %d companies", len(companies))
    response = deepseek_client.chat.completions.create(
        model="deepseek-chat",
        messages=[
            {"role": "system", "content": system_prompt},
            {
                "role": "user",
                "content": (
                    f"COMPANIES TO PROCESS:\n{urls_text}\n\n"
                    f"SCRAPED WEBSITE CONTENT:\n{content_text}\n\n"
                    f"Extract contact information from the scraped content above. "
                    f"If the scraped content is empty, leave fields as empty strings. "
                    f"Return only the JSON array, no other text."
                ),
            },
        ],
        temperature=0.3,
        max_tokens=4096,
    )

    raw = response.choices[0].message.content or ""
    json_start = raw.find("[")
    json_end = raw.rfind("]") + 1
    if json_start != -1 and json_end > json_start:
        raw = raw[json_start:json_end]

    try:
        extracted = json.loads(raw)
        logger.info("Extracted contact info for %d companies", len(extracted))
        return extracted
    except json.JSONDecodeError:
        logger.warning("Failed to parse contact extraction JSON")
        return companies


def draft_outreach_with_ai(companies: list[dict], industry: str) -> list[dict]:
    if not deepseek_client:
        raise RuntimeError("DEEPSEEK_API_KEY not configured")

    companies_json = json.dumps(companies, ensure_ascii=False, indent=2)

    system_prompt = (
        "### FY INTECH VR OUTREACH AGENT\n\n"
        "You are a B2B outreach agent for FY INTECH Solution — "
        "specialising in industrial high-risk simulation through Virtual Reality.\n\n"
        "For each company, draft a personalised outreach email (300-400 words) "
        "and fill in ALL fields. Tailor pain points to each company's actual "
        "industry, operations, and known risks — never reuse the same pain points.\n\n"
        "EMAIL TEMPLATE:\n"
        "Subject: Reducing training risk at [Company Name]\n"
        "Body:\n"
        "Dear [Name / Team],\n\n"
        "Noticed [Company] is expanding/handling [specific high-risk operation].\n\n"
        "We are from FY Intech, specialising in industrial high-risk simulation "
        "through Virtual Reality. We help industrial teams replace traditional "
        "induction with immersive VR simulations — reducing decision errors, "
        "onboarding time, and safety exposure.\n\n"
        "Would you be open to a 20-minute session to see how this fits "
        "[Company]'s training strategy?\n\n"
        "Warm regards,\n"
        "FY INTECH Solution - Business Development Team\n"
        "ask@fyintech.com | +603-2188-71240 | www.fyintech.com\n\n"
        "Return a JSON array with this EXACT structure for each company:\n"
        '[{"name": "", "industry": "", "website": "", "email_primary": "", '
        '"email_additional": "", "phone": "", "address": "", '
        '"personnel_data": "", "priority": "Hot|Warm|Cold", '
        '"pain_points": "", "email_subject": "", "email_body": "", '
        '"notes": ""}]'
    )

    user_prompt = (
        f"INDUSTRY: {industry}\n\n"
        f"COMPANIES WITH CONTACT DATA:\n{companies_json}\n\n"
        f"INSTRUCTIONS:\n"
        f"- Process ALL companies listed above\n"
        f"- Process each company exactly once\n"
        f"- Draft email subject and body for each\n"
        f"- Assign priority (Hot/Warm/Cold) based on company size, industry fit, "
        f"and likelihood of needing VR training\n"
        f"- PAIN POINTS must be specific to each company (2-3 sentences)\n"
        f"- NOTES should include key talking points for the sales team\n"
        f"- Return ONLY the JSON array, no other text"
    )

    logger.info("Drafting outreach for %d companies", len(companies))
    response = deepseek_client.chat.completions.create(
        model="deepseek-chat",
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        temperature=0.5,
        max_tokens=16384,
    )

    raw = response.choices[0].message.content or ""
    json_start = raw.find("[")
    json_end = raw.rfind("]") + 1
    if json_start != -1 and json_end > json_start:
        raw = raw[json_start:json_end]

    try:
        enriched = json.loads(raw)
        logger.info("Drafted outreach for %d companies", len(enriched))
        return enriched
    except json.JSONDecodeError:
        logger.warning("Failed to parse outreach JSON")
        return companies


def save_to_crm(leads: list[dict]) -> dict:
    db = SessionLocal()
    created = 0
    skipped = 0

    try:
        for lead in leads:
            company_name = (lead.get("name") or lead.get("company") or "").strip()
            if not company_name:
                continue

            exists = db.query(models.Lead).filter(
                models.Lead.company == company_name
            ).first()
            if exists:
                skipped += 1
                continue

            db.add(models.Lead(
                company=company_name,
                industry=(lead.get("industry") or "Unknown")[:100],
                location=(lead.get("address") or lead.get("location") or "Malaysia")[:200],
                score=60,
                status="To Approach",
                problem=lead.get("pain_points") or lead.get("problem"),
                website=(lead.get("website") or "")[:500],
                email_primary=(lead.get("email_primary") or "")[:255],
                email_additional=(lead.get("email_additional") or "")[:500],
                phone=(lead.get("phone") or "")[:100],
                address=(lead.get("address") or "")[:500],
                personnel_data=(lead.get("personnel_data") or "")[:2000],
                priority=(lead.get("priority") or "Warm")[:50],
                lead_source="n8n",
            ))
            created += 1

        db.commit()
        logger.info("Saved %d leads to CRM, %d skipped (duplicates)", created, skipped)
    finally:
        db.close()

    return {"created": created, "skipped": skipped}


def run_pipeline(industry: str, revenue_range: str) -> dict:
    log_lines = []

    def log(msg):
        logger.info(msg)
        log_lines.append(msg)

    if not FIRECRAWL_API_KEY:
        return {"error": "FIRECRAWL_API_KEY not configured", "log": log_lines}
    if not DEEPSEEK_API_KEY:
        return {"error": "DEEPSEEK_API_KEY not configured", "log": log_lines}

    log(f"Pipeline start — {industry} | {revenue_range}")

    log("Step 1: Searching for companies...")
    companies = search_companies(industry, revenue_range)
    if not companies:
        return {"error": "No companies found", "log": log_lines}
    log(f"  Found {len(companies)} companies")

    log("Step 2: Scraping contacts...")
    scraped = scrape_contacts(companies)

    log("Step 3: Extracting contacts with AI...")
    with_contacts = extract_contacts_with_ai(scraped)

    log("  Waiting 60 seconds for API rate limits...")
    time.sleep(60)

    log("Step 4: Drafting outreach emails...")
    enriched = draft_outreach_with_ai(with_contacts, industry)

    log("Step 5: Saving to CRM...")
    result = save_to_crm(enriched)
    log(f"  Done: {result['created']} created, {result['skipped']} skipped")

    log("Pipeline complete.")
    return {
        "created": result["created"],
        "skipped": result["skipped"],
        "industry": industry,
        "revenue_range": revenue_range,
        "log": log_lines,
    }

