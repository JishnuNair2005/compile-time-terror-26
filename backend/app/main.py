from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.routes import router as api_router

app = FastAPI(title="Classroom Feedback API")

# Configure CORS so your React frontend can talk to it
#to run backend on localhost:8000 every ip should be able to connect use command uvicorn app.main:app --reload --host 0.0.0 --port 8000 
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register the routes
app.include_router(api_router, prefix="/api")

# Run via command line: uvicorn app.main:app --reload