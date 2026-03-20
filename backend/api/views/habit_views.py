from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status
from datetime import date, timedelta

from ..models import Habit, HabitLog


@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated])
def habits_view(request):
    """GET: list habits. POST: create a habit."""
    if request.method == "GET":
        habits = Habit.objects.filter(user=request.user).values(
            "id", "name", "points", "created_at"
        )
        return Response(list(habits))

    # POST
    name = (request.data.get("name") or "").strip()
    points = request.data.get("points")

    if not name:
        return Response(
            {"error": "Habit name is required."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    if len(name) > 255:
        return Response(
            {"error": "Name is too long."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    try:
        points = int(points)
        if points < 1 or points > 1000:
            raise ValueError
    except (TypeError, ValueError):
        return Response(
            {"error": "Points must be between 1 and 1000."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    habit = Habit.objects.create(user=request.user, name=name, points=points)
    return Response(
        {"id": habit.id, "name": habit.name, "points": habit.points},
        status=status.HTTP_201_CREATED,
    )


@api_view(["DELETE"])
@permission_classes([IsAuthenticated])
def habit_delete_view(request, habit_id):
    """Delete a habit owned by the current user."""
    deleted, _ = Habit.objects.filter(id=habit_id, user=request.user).delete()
    if not deleted:
        return Response(
            {"error": "Habit not found."},
            status=status.HTTP_404_NOT_FOUND,
        )
    return Response({"success": True})


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def habit_toggle_view(request, habit_id):
    """Toggle completion of a habit for a given date (defaults to today)."""
    raw_date = request.data.get("date")
    try:
        log_date = date.fromisoformat(raw_date) if raw_date else date.today()
    except (TypeError, ValueError):
        return Response(
            {"error": "Invalid date format. Use YYYY-MM-DD."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    habit = Habit.objects.filter(id=habit_id, user=request.user).first()
    if not habit:
        return Response(
            {"error": "Habit not found."},
            status=status.HTTP_404_NOT_FOUND,
        )

    log, created = HabitLog.objects.get_or_create(
        user=request.user, habit=habit, date=log_date
    )
    if not created:
        log.delete()

    return Response({"done": created, "date": str(log_date)})


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def habit_logs_view(request):
    """Return completion logs for the last N days (default 14)."""
    try:
        days = int(request.query_params.get("days", 14))
        days = min(max(days, 1), 90)
    except (TypeError, ValueError):
        days = 14

    since = date.today() - timedelta(days=days - 1)
    logs = HabitLog.objects.filter(
        user=request.user, date__gte=since
    ).values_list("habit_id", "date")

    # group by date string
    result: dict[str, list[int]] = {}
    for habit_id, log_date in logs:
        key = str(log_date)
        result.setdefault(key, []).append(habit_id)

    return Response(result)
