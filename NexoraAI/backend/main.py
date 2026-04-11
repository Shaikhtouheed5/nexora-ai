import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from core.config import settings
from routers import auth, scanner, edu, challenges, voice, image_scan
from ml.scanner_engine import ScannerEngine
from utils.logger import logger


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting NexoraAI backend v2.0.0")
    app.state.scanner = ScannerEngine()
    await app.state.scanner.initialize()
    logger.info("Scanner engine initialized")
    yield
    logger.info("Shutting down NexoraAI backend")


app = FastAPI(
    title="NexoraAI API",
    version="2.0.0",
    description="Nexora AI Cybersecurity Platform — Unified Backend",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"Unhandled exception: {exc}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={"error": str(exc), "status_code": 500},
    )


app.include_router(auth.router, prefix="/auth", tags=["auth"])
app.include_router(scanner.router, prefix="/scan", tags=["scanner"])
app.include_router(image_scan.router, prefix="/api", tags=["image-scan"])
app.include_router(edu.router, prefix="/edu", tags=["edu"])
app.include_router(challenges.router, prefix="/challenges", tags=["challenges"])
app.include_router(voice.router, prefix="/voice", tags=["voice"])


@app.get("/health")
async def health():
    return {"status": "ok", "version": "2.0.0"}
