from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from datetime import datetime
from routers import auth, scanner, edu

app = FastAPI(title="PhishGuard AI API")

# --- Middleware ---
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Routers ---
app.include_router(auth.router, prefix="/auth", tags=["auth"])
app.include_router(scanner.router, tags=["scanner"])
app.include_router(edu.router, tags=["edu"])

@app.get("/")
async def root():
    return {
        "status": "PhishGuard AI API is online",
        "version": "1.0.0",
        "documentation": "/docs",
        "timestamp": str(datetime.now())
    }


if __name__ == "__main__":
    import uvicorn
    # Respect the user's manual port change to 8100
    uvicorn.run("main:app", host="0.0.0.0", port=8001, reload=True)
