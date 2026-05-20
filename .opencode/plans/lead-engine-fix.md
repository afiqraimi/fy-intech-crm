# Lead Engine Fix — Complete Code Changes

## Problem
`search_companies()` sends a long natural-language sentence to Firecrawl `/v1/search`.  
Firecrawl expects short keyword queries. Returns 0 results every time.

## Fix: 3 Files

---

### File 1: `backend/lead_engine.py`

**DELETE lines 34-67** (the entire `search_companies` function)

**INSERT this before it** (after `_firecrawl_headers()` on line 31):

```python
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
```

**REPLACE the old `search_companies` function (lines 34-67)** with:

```python
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
```

---

### File 2: `backend/main.py`

**ADD at the end of the file** (after the existing lead engine endpoints):

```python
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
```

---

### File 3: `src/components/SettingsTab.jsx`

**FIND line with** `<details className="text-xs text-crm-textMuted">`

**CHANGE TO**:
```jsx
<details open={!!engineResult?.error} className="text-xs text-crm-textMuted">
```

---

## Summary
3 files, ~80 lines total. Changes:
1. DeepSeek generates 5 keyword queries → tried one by one
2. Falls back to DeepSeek's own knowledge if all queries fail
3. Every Firecrawl request/response logged verbosely
4. Test endpoint to verify Firecrawl key works
5. Log auto-expands on failure
