@echo off
echo Starting FY Intech CRM Development Environment...

echo Starting FastAPI Backend...
start cmd /k "cd backend && python -m uvicorn main:app --host 0.0.0.0 --reload --port 8000"

echo Starting Vite Frontend...
start cmd /k "npm run dev -- --host"

echo Both servers are starting up!
pause
