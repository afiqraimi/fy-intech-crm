from database import SessionLocal, engine, Base
import models

# Ensure tables are created
Base.metadata.create_all(bind=engine)

def seed_db():
    db = SessionLocal()
    
    # Check if database is already seeded
    if db.query(models.Lead).count() > 0:
        print("Database already seeded.")
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
        lead = models.Lead(**data)
        db.add(lead)
    
    db.commit()
    print("Database successfully seeded with Malaysian entities!")
    db.close()

if __name__ == "__main__":
    seed_db()
