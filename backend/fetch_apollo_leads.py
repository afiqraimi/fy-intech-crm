import os
import requests
import json
import random
import time
from database import SessionLocal, engine, Base
import models

# Ensure tables exist
Base.metadata.create_all(bind=engine)

API_KEY = "We4rzTi6B7x0Iot8qk7bjw"
URL = "https://api.apollo.io/v1/organizations/search"

HEADERS = {
    "Cache-Control": "no-cache",
    "Content-Type": "application/json",
    "X-Api-Key": API_KEY
}

def fetch_apollo_leads():
    db = SessionLocal()
    
    # We want ~1000 leads. Apollo max per_page is usually around 100 or 200. We'll do 100 per page for 10 pages.
    # Note: Free tier might limit results, but we'll try to fetch as many as possible up to 1000.
    total_fetched = 0
    pages_to_fetch = 10
    
    print("Starting Apollo.io data extraction...")
    
    for page in range(1, pages_to_fetch + 1):
        payload = {
            "q_organization_keyword_tags": ["manufacturing", "factory", "oil", "healthcare", "training", "logistics", "aerospace", "aviation", "engineering", "construction"],
            "organization_locations": ["Malaysia", "Singapore"],
            "organization_num_employees_ranges": ["50,100000"],
            "page": page,
            "per_page": 100
        }
        
        try:
            response = requests.post(URL, headers=HEADERS, json=payload)
            response.raise_for_status()
            data = response.json()
            
            organizations = data.get("organizations", [])
            
            if not organizations:
                print(f"No more organizations found on page {page}. Stopping.")
                break
                
            new_leads = []
            for org in organizations:
                # Map Apollo data to our schema
                company_name = org.get("name") or "Unknown Company"
                
                # Try to get industry, fallback to keywords, or generic
                industry = org.get("industry")
                if not industry and org.get("keywords"):
                    industry = org.get("keywords")[0].capitalize()
                if not industry:
                    industry = "Enterprise"
                    
                city = org.get("city") or ""
                country = org.get("country") or ""
                location = f"{city}, {country}".strip(", ")
                if not location:
                    location = "Malaysia/Singapore"
                    
                # Generate a random VR Potential Score between 60 and 99
                score = random.randint(60, 99)
                
                # Status is "New"
                status = "New"
                
                # Check if company already exists to avoid duplicates
                exists = db.query(models.Lead).filter(models.Lead.company == company_name).first()
                if not exists:
                    lead = models.Lead(
                        company=company_name,
                        industry=industry[:50], # Truncate just in case
                        location=location[:50],
                        score=score,
                        status=status
                    )
                    new_leads.append(lead)
            
            if new_leads:
                db.bulk_save_objects(new_leads)
                db.commit()
                total_fetched += len(new_leads)
                print(f"Page {page}: Successfully added {len(new_leads)} new leads. (Total so far: {total_fetched})")
            else:
                print(f"Page {page}: No new unique leads to add.")
            
            # Sleep to respect rate limits (Apollo limit is usually 50 requests/minute or similar)
            time.sleep(1)
            
        except requests.exceptions.RequestException as e:
            print(f"Error fetching page {page} from Apollo API: {e}")
            break
            
    db.close()
    print(f"Finished! Successfully injected a total of {total_fetched} high-value leads into the database.")

if __name__ == "__main__":
    fetch_apollo_leads()
