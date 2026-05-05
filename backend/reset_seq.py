import os
from sqlalchemy import create_engine, text

def main():
    cloud_url = 'postgresql://neondb_owner:npg_h2AFeVGsmOt5@ep-empty-term-aq4jw87i.c-8.us-east-1.aws.neon.tech/neondb?sslmode=require'
    engine = create_engine(cloud_url)
    with engine.connect() as conn:
        conn.execute(text("SELECT setval(pg_get_serial_sequence('leads', 'id'), coalesce(max(id), 1), max(id) IS NOT null) FROM leads;"))
        conn.execute(text("SELECT setval(pg_get_serial_sequence('projects', 'id'), coalesce(max(id), 1), max(id) IS NOT null) FROM projects;"))
        conn.commit()
    print('Sequences updated.')

if __name__ == '__main__':
    main()
