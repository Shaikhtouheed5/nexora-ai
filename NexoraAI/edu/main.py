from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from datetime import datetime
from routers import auth, edu, content_gen, telegram

app = FastAPI(title="PhishGuard Edu API")

# --- Middleware ---
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Routers ---
app.include_router(auth.router, prefix="/auth", tags=["auth"])
app.include_router(edu.router, tags=["edu"])
app.include_router(content_gen.router, prefix="/api/edu", tags=["content-gen"])
app.include_router(telegram.router, tags=["telegram"])

@app.get("/")
async def root():
    return {
        "status": "PhishGuard Edu API is online",
        "version": "1.0.0",
        "documentation": "/docs",
        "timestamp": str(datetime.now())
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8001, reload=True)
