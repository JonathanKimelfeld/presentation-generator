from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from sqlalchemy.orm import Session

from database import get_db
from models.presentation import Presentation
from models.version import Version
from export.pptx_builder import build_pptx

router = APIRouter(prefix="/presentations", tags=["export"])


@router.get("/{presentation_id}/export/pptx")
def export_pptx(presentation_id: str, db: Session = Depends(get_db)):
    pres = db.query(Presentation).filter(Presentation.id == presentation_id).first()
    if not pres:
        raise HTTPException(status_code=404, detail="Presentation not found")

    version = db.query(Version).filter(Version.id == pres.current_version_id).first()
    if not version:
        raise HTTPException(status_code=404, detail="Version not found")

    pptx_bytes = build_pptx(pres.topic, version.slides)

    safe_name = "".join(c if c.isalnum() or c in " -_" else "_" for c in pres.topic)[:60]
    filename = safe_name.strip() + ".pptx"

    return Response(
        content=pptx_bytes,
        media_type="application/vnd.openxmlformats-officedocument.presentationml.presentation",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
