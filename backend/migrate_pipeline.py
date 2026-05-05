import sqlite3
conn = sqlite3.connect("crm.db")
c = conn.cursor()
c.execute("UPDATE leads SET status = 'To Approach' WHERE status = 'New'")
c.execute("UPDATE leads SET status = 'Approached' WHERE status = 'In Progress'")
c.execute("UPDATE leads SET status = 'Proposal Sent' WHERE status = 'Closed'")
conn.commit()
rows = c.execute("SELECT status, COUNT(*) FROM leads GROUP BY status").fetchall()
for r in rows:
    print(r)
conn.close()
print("Pipeline migration done.")
