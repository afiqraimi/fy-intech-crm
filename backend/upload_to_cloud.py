import os
import sys
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from models import Base, Lead, Project

def main():
    print("=" * 60)
    print("FY INTECH CRM - CLOUD DATA MIGRATION")
    print("=" * 60)
    
    # 1. Connect to Local SQLite Database
    local_db_url = "sqlite:///./crm.db"
    try:
        local_engine = create_engine(local_db_url)
        LocalSession = sessionmaker(bind=local_engine)
        local_session = LocalSession()
        print("[OK] Connected to local database (crm.db).")
    except Exception as e:
        print(f"[ERROR] Error connecting to local database: {e}")
        return

    # 2. Get Cloud Database URL from user
    print("\nPaste your Neon DATABASE_URL below (starts with postgresql:// or postgres://):")
    cloud_url = input("> ").strip()
    
    if not cloud_url:
        print("[ERROR] No URL provided. Aborting.")
        return
        
    if cloud_url.startswith("postgres://"):
        cloud_url = cloud_url.replace("postgres://", "postgresql://", 1)

    # 3. Connect to Cloud Database
    try:
        cloud_engine = create_engine(cloud_url)
        CloudSession = sessionmaker(bind=cloud_engine)
        cloud_session = CloudSession()
        print("\n[OK] Connected to cloud database successfully.")
    except Exception as e:
        print(f"[ERROR] Error connecting to cloud database: {e}")
        return

    # 4. Ensure tables exist in the cloud
    print("[...] Creating tables in the cloud if they don't exist...")
    Base.metadata.create_all(bind=cloud_engine)

    # 5. Fetch local data
    print("[...] Fetching local data...")
    local_leads = local_session.query(Lead).all()
    local_projects = local_session.query(Project).all()
    print(f"    Found {len(local_leads)} Leads and {len(local_projects)} Active Projects locally.")

    # 6. Push to Cloud
    print("\n[...] Pushing data to the cloud. This might take a minute...")
    try:
        # Clear existing data in cloud to prevent duplicates if ran twice
        cloud_session.query(Project).delete()
        cloud_session.query(Lead).delete()
        cloud_session.commit()

        # Insert Leads
        for lead in local_leads:
            cloud_session.add(Lead(
                id=lead.id,
                company=lead.company,
                industry=lead.industry,
                location=lead.location,
                score=lead.score,
                status=lead.status,
                problem=lead.problem,
                solution=lead.solution
            ))
        
        # Insert Projects
        for proj in local_projects:
            cloud_session.add(Project(
                id=proj.id,
                client=proj.client,
                project_name=proj.project_name,
                service_type=proj.service_type,
                stage=proj.stage,
                description=proj.description,
                next_action=proj.next_action,
                start_date=proj.start_date,
                last_update=proj.last_update,
                source_lead_id=proj.source_lead_id,
                source_lead_name=proj.source_lead_name
            ))
            
        cloud_session.commit()
        print("[OK] All data successfully pushed to the cloud!")

        # 7. Reset Postgres ID sequences
        print("[...] Resetting database ID sequences...")
        with cloud_engine.connect() as conn:
            conn.execute("SELECT setval(pg_get_serial_sequence('leads', 'id'), coalesce(max(id), 1), max(id) IS NOT null) FROM leads;")
            conn.execute("SELECT setval(pg_get_serial_sequence('projects', 'id'), coalesce(max(id), 1), max(id) IS NOT null) FROM projects;")
        
        print("\n[SUCCESS] MIGRATION COMPLETE! Your global CRM is now ready to use.")
        
    except Exception as e:
        cloud_session.rollback()
        print(f"\n[ERROR] Error during migration: {e}")
    finally:
        local_session.close()
        cloud_session.close()

if __name__ == "__main__":
    main()
