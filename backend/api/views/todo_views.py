from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from ..models import TodoCategory, TodoItem


def _serialize_category(category):
    return {
        "id": category.id,
        "name": category.name,
        "items": [
            {"id": item.id, "text": item.text, "completed": item.completed}
            for item in category.items.all()
        ],
    }


@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated])
def todo_categories_view(request):
    if request.method == "GET":
        categories = TodoCategory.objects.filter(user=request.user).prefetch_related("items")
        return Response([_serialize_category(category) for category in categories])

    name = (request.data.get("name") or "").strip()
    if not name:
        return Response({"error": "Category name is required."}, status=status.HTTP_400_BAD_REQUEST)
    if len(name) > 255:
        return Response({"error": "Category name is too long."}, status=status.HTTP_400_BAD_REQUEST)
    if TodoCategory.objects.filter(user=request.user, name__iexact=name).exists():
        return Response({"error": "A category with this name already exists."}, status=status.HTTP_400_BAD_REQUEST)

    category = TodoCategory.objects.create(user=request.user, name=name)
    return Response(_serialize_category(category), status=status.HTTP_201_CREATED)


@api_view(["DELETE"])
@permission_classes([IsAuthenticated])
def todo_category_delete_view(request, category_id):
    deleted, _ = TodoCategory.objects.filter(id=category_id, user=request.user).delete()
    if not deleted:
        return Response({"error": "Category not found."}, status=status.HTTP_404_NOT_FOUND)
    return Response({"success": True})


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def todo_item_create_view(request, category_id):
    text = (request.data.get("text") or "").strip()
    if not text:
        return Response({"error": "Item text is required."}, status=status.HTTP_400_BAD_REQUEST)
    if len(text) > 500:
        return Response({"error": "Item text is too long."}, status=status.HTTP_400_BAD_REQUEST)
    category = TodoCategory.objects.filter(id=category_id, user=request.user).first()
    if not category:
        return Response({"error": "Category not found."}, status=status.HTTP_404_NOT_FOUND)

    item = TodoItem.objects.create(category=category, text=text)
    return Response(
        {"id": item.id, "text": item.text, "completed": item.completed},
        status=status.HTTP_201_CREATED,
    )


@api_view(["PATCH", "DELETE"])
@permission_classes([IsAuthenticated])
def todo_item_detail_view(request, item_id):
    item = TodoItem.objects.filter(id=item_id, category__user=request.user).first()
    if not item:
        return Response({"error": "Item not found."}, status=status.HTTP_404_NOT_FOUND)

    if request.method == "DELETE":
        item.delete()
        return Response({"success": True})

    if "completed" not in request.data or not isinstance(request.data["completed"], bool):
        return Response({"error": "Completed must be a boolean."}, status=status.HTTP_400_BAD_REQUEST)
    item.completed = request.data["completed"]
    item.save(update_fields=["completed"])
    return Response({"id": item.id, "text": item.text, "completed": item.completed})