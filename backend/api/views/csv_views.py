from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status

from ..models import SavedCsv

MAX_NAME_LEN = 255
MAX_CONTENT_LEN = 5 * 1024 * 1024  # 5 MB of CSV text
MAX_SAVED = 100  # per-user cap


@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated])
def csv_list_create(request):
    """
    GET  – return all saved CSVs for the current user (without full content).
    POST – save a new CSV (or update by name if one with the same name exists).
    """
    if request.method == "GET":
        rows = SavedCsv.objects.filter(user=request.user).values(
            "id", "name", "updated_at"
        )
        return Response(list(rows))

    # POST – create or update
    name = (request.data.get("name") or "").strip()
    content = request.data.get("content") or ""

    if not name:
        return Response(
            {"error": "Name is required."},
            status=status.HTTP_400_BAD_REQUEST,
        )
    if len(name) > MAX_NAME_LEN:
        return Response(
            {"error": "Name is too long (max 255 characters)."},
            status=status.HTTP_400_BAD_REQUEST,
        )
    if len(content) > MAX_CONTENT_LEN:
        return Response(
            {"error": "CSV content is too large (max 5 MB)."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    # Check cap (only when creating a brand-new name)
    existing = SavedCsv.objects.filter(user=request.user, name=name).first()
    if not existing:
        count = SavedCsv.objects.filter(user=request.user).count()
        if count >= MAX_SAVED:
            return Response(
                {"error": f"You can save up to {MAX_SAVED} CSVs. Delete some to make room."},
                status=status.HTTP_400_BAD_REQUEST,
            )

    obj, created = SavedCsv.objects.update_or_create(
        user=request.user,
        name=name,
        defaults={"content": content},
    )

    return Response(
        {"id": obj.id, "name": obj.name, "updated_at": obj.updated_at},
        status=status.HTTP_201_CREATED if created else status.HTTP_200_OK,
    )


@api_view(["GET", "DELETE"])
@permission_classes([IsAuthenticated])
def csv_detail(request, csv_id):
    """
    GET    – return the full CSV content for one saved file.
    DELETE – delete a saved CSV.
    """
    try:
        obj = SavedCsv.objects.get(id=csv_id, user=request.user)
    except SavedCsv.DoesNotExist:
        return Response({"error": "Not found."}, status=status.HTTP_404_NOT_FOUND)

    if request.method == "GET":
        return Response(
            {"id": obj.id, "name": obj.name, "content": obj.content, "updated_at": obj.updated_at}
        )

    # DELETE
    obj.delete()
    return Response({"success": True})
