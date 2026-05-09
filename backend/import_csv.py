import csv
import os
from database import SessionLocal, engine, Base
import models

CSV_PATH = os.path.join(os.path.dirname(__file__), "..", "leads_database_export.csv")

Base.metadata.create_all(bind=engine)

db = SessionLocal()
imported = 0
skipped = 0

try:
    with open(CSV_PATH, "r", encoding="utf-8") as f:
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
    print(f"Done: {imported} leads imported, {skipped} skipped (duplicates)")
finally:
    db.close()
