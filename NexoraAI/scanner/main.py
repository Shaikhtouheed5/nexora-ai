from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from datetime import datetime
from routers import scanner
from ml.scanner_engine import ScannerEngine
from utils.logger import get_logger

logger = get_logger("main")


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting NexoraAI scanner service")
    app.state.scanner = ScannerEngine()
    await app.state.scanner.initialize()
    logger.info("ScannerEngine initialized")
    yield
    logger.info("Shutting down NexoraAI scanner service")


app = FastAPI(lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(scanner.router, prefix="")

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
