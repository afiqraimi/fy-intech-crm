import csv
import sys
import os
from database import SessionLocal
import models

def export_to_csv():
    db = SessionLocal()
    leads = db.query(models.Lead).all()
    
    # We will save the CSV in the main project folder instead of backend folder
    csv_file_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "leads_database_export.csv")
    
    with open(csv_file_path, mode="w", newline="", encoding="utf-8") as file:
        writer = csv.writer(file)
        writer.writerow(["ID", "Company Name", "Industry", "Location", "VR Potential Score (%)", "Status"])
        
        for lead in leads:
            writer.writerow([lead.id, lead.company, lead.industry, lead.location, lead.score, lead.status])
            
    db.close()
    print(f"Successfully exported {len(leads)} leads to {csv_file_path}")

if __name__ == "__main__":
    export_to_csv()
