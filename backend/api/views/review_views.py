from django.db.models import Avg, Count
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated, IsAuthenticatedOrReadOnly
from rest_framework.response import Response
from rest_framework import status

from ..models import ToolReview


@api_view(["GET", "POST"])
@permission_classes([IsAuthenticatedOrReadOnly])
def reviews_view(request):
    """
    GET  /api/reviews/?tool_path=<path>  — list reviews + summary for a tool
    POST /api/reviews/                   — create or update own review (auth required)
    """
    if request.method == "GET":
        tool_path = (request.query_params.get("tool_path") or "").strip()
        if not tool_path:
            return Response({"error": "tool_path is required."}, status=status.HTTP_400_BAD_REQUEST)

        qs = ToolReview.objects.filter(tool_path=tool_path).select_related("user")
        reviews = [
            {
                "id": r.id,
                "username": r.user.username,
                "rating": r.rating,
                "comment": r.comment,
                "created_at": r.created_at.isoformat(),
                "is_own": request.user.is_authenticated and r.user_id == request.user.id,
            }
            for r in qs
        ]

        agg = qs.aggregate(avg=Avg("rating"), count=Count("id"))
        summary = {
            "average_rating": round(agg["avg"], 1) if agg["avg"] else None,
            "total_reviews": agg["count"],
        }

        user_review = None
        if request.user.is_authenticated:
            own = qs.filter(user=request.user).first()
            if own:
                user_review = {"rating": own.rating, "comment": own.comment}

        return Response({"reviews": reviews, "summary": summary, "user_review": user_review})

    # POST — create or update
    tool_path = (request.data.get("tool_path") or "").strip()
    rating = request.data.get("rating")
    comment = (request.data.get("comment") or "").strip()

    if not tool_path:
        return Response({"error": "tool_path is required."}, status=status.HTTP_400_BAD_REQUEST)

    if len(tool_path) > 255:
        return Response({"error": "tool_path is too long."}, status=status.HTTP_400_BAD_REQUEST)

    try:
        rating = int(rating)
        if rating < 1 or rating > 5:
            raise ValueError
    except (TypeError, ValueError):
        return Response({"error": "Rating must be between 1 and 5."}, status=status.HTTP_400_BAD_REQUEST)

    if len(comment) > 2000:
        return Response({"error": "Comment must be 2000 characters or fewer."}, status=status.HTTP_400_BAD_REQUEST)

    review, created = ToolReview.objects.update_or_create(
        user=request.user,
        tool_path=tool_path,
        defaults={"rating": rating, "comment": comment},
    )

    return Response(
        {"id": review.id, "rating": review.rating, "comment": review.comment},
        status=status.HTTP_201_CREATED if created else status.HTTP_200_OK,
    )


@api_view(["DELETE"])
@permission_classes([IsAuthenticated])
def review_delete_view(request, review_id):
    """DELETE /api/reviews/<id>/ — delete own review."""
    deleted, _ = ToolReview.objects.filter(id=review_id, user=request.user).delete()
    if not deleted:
        return Response({"error": "Review not found."}, status=status.HTTP_404_NOT_FOUND)
    return Response({"success": True})
