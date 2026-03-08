import logging
import os
import subprocess
import tempfile
import uuid
from pathlib import Path

from django.http import HttpResponse
from rest_framework.decorators import api_view, parser_classes, permission_classes
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

logger = logging.getLogger(__name__)

MAX_UPLOAD_BYTES = 20 * 1024 * 1024  # 20 MB

ALLOWED_MIME_TYPES = {
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/msword",
}

SOFFICE_CANDIDATES = [
    "libreoffice",
    "soffice",
    "/usr/local/bin/soffice",   # symlink created in Lambda container image
    "/usr/bin/libreoffice",
    "/usr/bin/soffice",
    "/opt/libreoffice/program/soffice",
    "/opt/instdir/program/soffice",  # Lambda layer path
    r"C:\Program Files\LibreOffice\program\soffice.exe",  # Windows default install
    r"C:\Program Files (x86)\LibreOffice\program\soffice.exe",
]


def _find_soffice() -> str | None:
    import shutil

    for candidate in SOFFICE_CANDIDATES:
        if shutil.which(candidate) or Path(candidate).exists():
            return candidate
    return None


def _convert_to_pdf(input_path: str, output_dir: str) -> str:
    """Run LibreOffice headless conversion and return the output PDF path."""
    soffice = _find_soffice()
    if soffice is None:
        raise RuntimeError(
            "LibreOffice is not installed. "
            "On Windows: winget install TheDocumentFoundation.LibreOffice\n"
            "On Linux:   apt-get install -y libreoffice\n"
            "On macOS:   brew install --cask libreoffice"
        )

    env = {
        **os.environ,
        "HOME": "/tmp",  # required in Lambda / read-only FS environments
    }

    result = subprocess.run(
        [
            soffice,
            "--headless",
            "--convert-to",
            "pdf",
            "--outdir",
            output_dir,
            input_path,
        ],
        capture_output=True,
        text=True,
        timeout=120,
        env=env,
    )

    if result.returncode != 0:
        logger.error("LibreOffice stderr: %s", result.stderr)
        raise RuntimeError(f"LibreOffice conversion failed: {result.stderr[:500]}")

    stem = Path(input_path).stem
    pdf_path = Path(output_dir) / f"{stem}.pdf"
    if not pdf_path.exists():
        raise RuntimeError(
            f"Expected output PDF not found at {pdf_path}. "
            f"stdout={result.stdout!r} stderr={result.stderr!r}"
        )

    return str(pdf_path)


@api_view(["POST"])
@permission_classes([AllowAny])
@parser_classes([MultiPartParser, FormParser])
def word_to_pdf_view(request):
    doc_file = request.FILES.get("file")
    if doc_file is None:
        return Response({"error": "No file uploaded. Send a DOCX file as 'file'."}, status=400)

    content_type = (doc_file.content_type or "").split(";")[0].strip().lower()
    if content_type not in ALLOWED_MIME_TYPES:
        # Also accept by extension for browsers that send generic MIME types
        name_lower = (doc_file.name or "").lower()
        if not (name_lower.endswith(".docx") or name_lower.endswith(".doc")):
            return Response(
                {
                    "error": (
                        f"Unsupported file type '{content_type}'. "
                        "Please upload a .docx or .doc file."
                    )
                },
                status=415,
            )

    if doc_file.size > MAX_UPLOAD_BYTES:
        return Response(
            {"error": f"File too large. Maximum allowed size is {MAX_UPLOAD_BYTES // 1024 // 1024} MB."},
            status=413,
        )

    with tempfile.TemporaryDirectory(prefix="torensa_docconv_") as tmpdir:
        # Use a safe unique input filename to avoid collisions
        ext = ".docx" if (doc_file.name or "").lower().endswith(".docx") else ".doc"
        input_filename = f"{uuid.uuid4().hex}{ext}"
        input_path = os.path.join(tmpdir, input_filename)

        with open(input_path, "wb") as fh:
            for chunk in doc_file.chunks():
                fh.write(chunk)

        try:
            pdf_path = _convert_to_pdf(input_path, tmpdir)
        except RuntimeError as exc:
            logger.exception("Word-to-PDF conversion error")
            return Response({"error": str(exc)}, status=500)
        except subprocess.TimeoutExpired:
            return Response({"error": "Conversion timed out. Please try a smaller file."}, status=500)

        with open(pdf_path, "rb") as fh:
            pdf_bytes = fh.read()

    original_stem = Path(doc_file.name or "document").stem
    output_name = f"{original_stem}.pdf"

    response = HttpResponse(pdf_bytes, content_type="application/pdf")
    response["Content-Disposition"] = f'attachment; filename="{output_name}"'
    response["Content-Length"] = str(len(pdf_bytes))
    return response
