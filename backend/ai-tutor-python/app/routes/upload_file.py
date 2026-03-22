from pathlib import Path
from uuid import uuid4
import re

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status

from ..utils.auth import get_current_user

router = APIRouter()

UPLOAD_ROOT = Path(__file__).resolve().parents[2] / "uploads"
MAX_FILE_SIZE = 25 * 1024 * 1024


def sanitize_filename(filename: str) -> str:
    cleaned = re.sub(r"[^A-Za-z0-9._-]+", "_", filename).strip("._")
    return cleaned or "file"


@router.post("")
async def upload_file(
    file: UploadFile = File(...),
    user_id: str = Depends(get_current_user),
):
    if not file.filename:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="File name is required.")

    user_dir = UPLOAD_ROOT / user_id
    user_dir.mkdir(parents=True, exist_ok=True)

    original_name = sanitize_filename(file.filename)
    stored_name = f"{uuid4().hex}_{original_name}"
    destination = user_dir / stored_name

    size = 0
    try:
        with destination.open("wb") as output:
            while True:
                chunk = await file.read(1024 * 1024)
                if not chunk:
                    break
                size += len(chunk)
                if size > MAX_FILE_SIZE:
                    raise HTTPException(
                        status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                        detail="File is too large. Max size is 25 MB.",
                    )
                output.write(chunk)
    except HTTPException:
        if destination.exists():
            destination.unlink()
        raise
    finally:
        await file.close()

    return {
        "filename": original_name,
        "stored_filename": stored_name,
        "content_type": file.content_type,
        "size": size,
        "path": str(destination.relative_to(UPLOAD_ROOT.parent)),
    }
