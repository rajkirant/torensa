import io
import logging
import os
import zipfile
from pathlib import Path

from django.http import HttpResponse
from rest_framework.decorators import api_view, authentication_classes, parser_classes, permission_classes
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

logger = logging.getLogger(__name__)

MAX_UPLOAD_BYTES = 20 * 1024 * 1024  # 20 MB

ALLOWED_EXCEL_MIME_TYPES = {
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/vnd.ms-excel",
}

NEW_LOGO_PATH = Path(__file__).resolve().parent.parent.parent.parent / "frontend" / "public" / "marketdeed_logo.png"

# Map uploaded image extension/mime to the internal content-type used in [Content_Types].xml
MIME_BY_EXT = {
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".gif": "image/gif",
    ".bmp": "image/bmp",
    ".tiff": "image/tiff",
    ".tif": "image/tiff",
    ".emf": "image/x-emf",
    ".wmf": "image/x-wmf",
}


@api_view(["POST"])
@authentication_classes([])
@parser_classes([MultiPartParser, FormParser])
@permission_classes([AllowAny])
def excel_logo_swap_view(request):
    """
    POST multipart/form-data:
      - file : the Excel (.xlsx) file

    Replaces every image inside xl/media/ with the hardcoded marketdeed logo,
    preserving the drawing anchors and sizes already defined in the workbook.
    """
    excel_file = request.FILES.get("file")

    if not excel_file:
        return Response({"error": "No Excel file provided (field: 'file')."}, status=400)

    if excel_file.size > MAX_UPLOAD_BYTES:
        return Response({"error": "Excel file exceeds 20 MB limit."}, status=400)

    content_type = excel_file.content_type or ""
    if content_type not in ALLOWED_EXCEL_MIME_TYPES and not excel_file.name.lower().endswith((".xlsx", ".xls")):
        return Response({"error": "Uploaded file is not a valid Excel file."}, status=400)

    if not NEW_LOGO_PATH.exists():
        return Response({"error": "Logo asset not found on server."}, status=500)

    try:
        excel_bytes = excel_file.read()
        new_logo_bytes = NEW_LOGO_PATH.read_bytes()
        new_logo_ext = ".png"
        new_logo_mime = "image/png"

        # Collect all media image entries from the zip
        with zipfile.ZipFile(io.BytesIO(excel_bytes), "r") as zin:
            all_names = zin.namelist()
            media_images = [
                n for n in all_names
                if n.startswith("xl/media/") and not n.endswith("/")
            ]

        if not media_images:
            return Response({"error": "No images found in the Excel file."}, status=400)

        # Rebuild the zip, swapping every media image with the new logo
        output = io.BytesIO()
        with zipfile.ZipFile(io.BytesIO(excel_bytes), "r") as zin:
            with zipfile.ZipFile(output, "w", compression=zipfile.ZIP_DEFLATED) as zout:
                for item in zin.infolist():
                    if item.filename in media_images:
                        # Replace image bytes; keep the same internal filename
                        # (drawing rels already point to it by name)
                        old_ext = os.path.splitext(item.filename)[-1].lower()
                        if old_ext == new_logo_ext:
                            # Same format — straight swap
                            zout.writestr(item, new_logo_bytes)
                        else:
                            # Different format — rename the file inside the zip
                            new_internal_name = item.filename.rsplit(".", 1)[0] + new_logo_ext
                            new_info = zipfile.ZipInfo(new_internal_name)
                            new_info.compress_type = zipfile.ZIP_DEFLATED
                            zout.writestr(new_info, new_logo_bytes)

                            # Patch drawing rels so they reference the new filename
                            # We'll do that below by rewriting rels files
                    else:
                        zout.writestr(item, zin.read(item.filename))

        # If the extension changed we also need to patch the .rels files and [Content_Types].xml
        old_ext = os.path.splitext(media_images[0])[-1].lower()
        if old_ext != new_logo_ext:
            output = _patch_refs(output, media_images, old_ext, new_logo_ext, new_logo_mime)

        output.seek(0)
        original_name = os.path.splitext(excel_file.name)[0]
        response = HttpResponse(
            output.read(),
            content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        )
        response["Content-Disposition"] = f'attachment; filename="{original_name}_updated.xlsx"'
        response["X-Logos-Replaced"] = str(len(media_images))
        return response

    except Exception as e:
        logger.exception("excel_logo_swap_view error")
        return Response({"error": str(e)}, status=500)


def _patch_refs(zip_bytes_io, media_images, old_ext, new_ext, new_mime):
    """Rewrite .rels and [Content_Types].xml to point at the renamed media files."""
    zip_bytes_io.seek(0)
    original_bytes = zip_bytes_io.read()

    output = io.BytesIO()
    with zipfile.ZipFile(io.BytesIO(original_bytes), "r") as zin:
        with zipfile.ZipFile(output, "w", compression=zipfile.ZIP_DEFLATED) as zout:
            for item in zin.infolist():
                data = zin.read(item.filename)

                if item.filename.endswith(".rels") or item.filename == "[Content_Types].xml":
                    # Simple text replacement of old extension references
                    text = data.decode("utf-8")
                    for img_path in media_images:
                        old_basename = os.path.basename(img_path)
                        new_basename = old_basename.rsplit(".", 1)[0] + new_ext
                        text = text.replace(old_basename, new_basename)

                    # Also fix content-type declaration
                    old_mime = _mime_by_ext(old_ext)
                    text = text.replace(old_mime, new_mime)
                    # Fix Extension entry in [Content_Types].xml
                    text = text.replace(
                        f'Extension="{old_ext.lstrip(".")}"',
                        f'Extension="{new_ext.lstrip(".")}"',
                    )
                    data = text.encode("utf-8")

                zout.writestr(item, data)

    output.seek(0)
    return output


def _mime_by_ext(ext):
    return MIME_BY_EXT.get(ext, "image/png")
