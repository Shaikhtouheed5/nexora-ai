from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from datetime import datetime
from routers import auth, scanner, edu

app = FastAPI()

# --- Middleware ---
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Routers ---
app.include_router(auth.router, prefix="/auth")
app.include_router(scanner.router, prefix="/scanner")
app.include_router(edu.router, prefix="/edu")

@app.get("/")
async def root():
    return {
        "status": "PhishGuard Scanner API is online",
        "version": "1.0.0",
        "documentation": "/docs",
        "timestamp": str(datetime.now())
    }

@app.get("/health")
def health_check():
    return {"status": "ok"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8002, reload=True)
