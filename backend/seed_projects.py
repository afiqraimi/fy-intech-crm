import sqlite3

def seed_projects():
    conn = sqlite3.connect("crm.db")
    cursor = conn.cursor()

    # Create the projects table
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS projects (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        client VARCHAR,
        project_name VARCHAR,
        service_type VARCHAR,
        stage VARCHAR,
        description VARCHAR,
        next_action VARCHAR,
        start_date VARCHAR,
        last_update VARCHAR
    )
    ''')

    # Clear and re-seed
    cursor.execute("DELETE FROM projects")

    projects = [
        (
            "Majlis Bandaraya Johor Bahru (MBJB)",
            "VR City Planning Proof-of-Concept",
            "VR",
            "Awaiting Feedback",
            "FY Intech developed and delivered a full Virtual Reality Proof-of-Concept simulation for MBJB. The POC demonstrated an immersive walkthrough of proposed urban development zones within Johor Bahru's central district, allowing council members to experience scale and spatial planning in a way 2D blueprints never could. The live presentation was delivered to senior council leadership and was received positively.",
            "Awaiting official written feedback and decision from MBJB council regarding potential full-scale project engagement. Follow up with primary contact if no response by end of month.",
            "2025-02-10",
            "2025-04-28"
        ),
        (
            "Majlis Bandaraya Diraja Klang (MBDK)",
            "VR Heritage District Walkthrough POC",
            "VR",
            "POC Complete",
            "FY Intech successfully completed the Virtual Reality POC showcasing the proposed redevelopment of Klang's heritage corridor. The simulation enabled stakeholders to virtually walk through the proposed pedestrian-friendly streetscape and visualize architectural heritage preservation overlaid with modern urban amenities. The deliverable was submitted and the POC phase is now officially closed.",
            "Present findings to MBDK decision-makers. Prepare a formal project proposal document outlining the scope and cost of a full deployment.",
            "2025-03-01",
            "2025-05-02"
        ),
        (
            "Majlis Bandaraya Melaka Bersejarah (MBMB)",
            "VR Tourism & Heritage Experience POC",
            "VR",
            "POC Complete",
            "FY Intech completed the VR Proof-of-Concept for Majlis Bandaraya Melaka Bersejarah, focused on creating an immersive virtual tourism experience for Melaka's UNESCO World Heritage zones. The simulation allows visitors and planners to virtually explore Jonker Street, A Famosa, and surrounding heritage sites in high fidelity VR, demonstrating the potential for heritage preservation education and digital tourism.",
            "Schedule a formal presentation session with MBMB council. Explore potential for Melaka Digital Tourism grant funding to support full deployment.",
            "2025-03-15",
            "2025-05-03"
        ),
    ]

    for p in projects:
        cursor.execute('''
        INSERT INTO projects (client, project_name, service_type, stage, description, next_action, start_date, last_update)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ''', p)

    conn.commit()
    conn.close()
    print(f"Seeded {len(projects)} active projects successfully!")

if __name__ == "__main__":
    seed_projects()
