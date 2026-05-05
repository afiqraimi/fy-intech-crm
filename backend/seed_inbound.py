import sqlite3
from datetime import datetime, timedelta
import random

def seed_inbound():
    conn = sqlite3.connect("crm.db")
    cursor = conn.cursor()

    # Create table if it doesn't exist (just to be safe, though SQLAlchemy will create it on boot)
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS inbound_leads (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        company VARCHAR,
        contact_name VARCHAR,
        email VARCHAR,
        requested_service VARCHAR,
        budget VARCHAR,
        message VARCHAR,
        status VARCHAR,
        created_at VARCHAR
    )
    ''')

    # Clear existing data if any
    cursor.execute("DELETE FROM inbound_leads")

    inbounds = [
        {
            "company": "NextGen Healthcare Partners",
            "contact_name": "Dr. Sarah Jenkins",
            "email": "s.jenkins@nextgenhealth.org",
            "requested_service": "VR Surgical Simulation",
            "budget": "$150k - $250k",
            "message": "We saw your recent showcase on XR training. We urgently need a reliable partner to build a VR cardiovascular simulation for our incoming residents. Looking to deploy within 6 months. Let's discuss.",
            "status": "New",
            "days_ago": 0
        },
        {
            "company": "Apex Industrial Logistics",
            "contact_name": "Marcus Thorne",
            "email": "m.thorne@apexlogistics.com",
            "requested_service": "AR Smart Glasses Integration",
            "budget": "$50k - $100k",
            "message": "Interested in exploring AR overlays for our warehouse pickers. Our error rate is climbing and we need spatial routing. Do you have off-the-shelf solutions or is it all custom dev?",
            "status": "New",
            "days_ago": 1
        },
        {
            "company": "Horizon Architectonics",
            "contact_name": "Elena Rostova",
            "email": "erostova@horizonarch.io",
            "requested_service": "MR Digital Twin",
            "budget": "$300k+",
            "message": "We are designing a new sports stadium and the client wants to walk through the VIP sections in Mixed Reality before approving the blueprints. We have the CAD files ready. Please contact me ASAP.",
            "status": "New",
            "days_ago": 2
        },
        {
            "company": "Zenith Education Group",
            "contact_name": "David Chen",
            "email": "d.chen@zenithedu.net",
            "requested_service": "XR Classroom Modules",
            "budget": "$10k - $50k",
            "message": "Looking for basic AR modules to supplement our high school chemistry curriculum. What is your pricing model for educational institutions?",
            "status": "Reviewed",
            "days_ago": 5
        }
    ]

    for lead in inbounds:
        created_date = (datetime.now() - timedelta(days=lead["days_ago"], hours=random.randint(1, 10))).strftime("%Y-%m-%d %H:%M")
        cursor.execute('''
        INSERT INTO inbound_leads (company, contact_name, email, requested_service, budget, message, status, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ''', (lead["company"], lead["contact_name"], lead["email"], lead["requested_service"], lead["budget"], lead["message"], lead["status"], created_date))

    conn.commit()
    conn.close()
    print("Inbound leads successfully seeded!")

if __name__ == "__main__":
    seed_inbound()
