from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from database import engine, Base
import models.presentation  # noqa: F401 — registers model with Base
import models.version        # noqa: F401
import models.topic_resource  # noqa: F401 — registers model with Base
from resources import router as resources_router
from export import router as export_router

from routers import presentations, versions

app = FastAPI(title="Presentation Generator API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:5174"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(presentations.router)
app.include_router(versions.router)
app.include_router(resources_router.router)
app.include_router(export_router.router)


@app.on_event("startup")
def on_startup():
    Base.metadata.create_all(bind=engine)


@app.get("/health")
def health():
    return {"status": "ok"}
