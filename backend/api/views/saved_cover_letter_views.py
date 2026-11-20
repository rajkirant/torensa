import json

from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from ..models import CoverLetterTemplate, SavedCoverLetter

MAX_TITLE_CHARS = 255
MAX_CONTENT_CHARS = 20000
MAX_STATE_BYTES = 100_000
MAX_LETTERS_PER_USER = 100


def _summary(letter):
    return {
        "id": letter.id,
        "title": letter.title,
        "updatedAt": letter.updated_at.isoformat(),
    }


def _detail(letter):
    return {**_summary(letter), "content": letter.content, "state": letter.state}


def _validated(data, partial):
    """Returns (fields, error) from a request body."""
    fields = {}
    if "title" in data or not partial:
        title = data.get("title")
        if not isinstance(title, str) or not title.strip():
            return None, "Title is required."
        if len(title.strip()) > MAX_TITLE_CHARS:
            return None, "Title is too long."
        fields["title"] = title.strip()
    if "content" in data or not partial:
        content = data.get("content")
        if not isinstance(content, str) or not content.strip():
            return None, "The cover letter is empty."
        if len(content) > MAX_CONTENT_CHARS:
            return None, f"The cover letter must be at most {MAX_CONTENT_CHARS} characters."
        fields["content"] = content
    if "state" in data:
        state = data.get("state")
        if not isinstance(state, dict):
            return None, "State must be an object."
        if len(json.dumps(state)) > MAX_STATE_BYTES:
            return None, "The saved letter is too large."
        fields["state"] = state
    return fields, None


@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated])
def saved_cover_letters_view(request):
    """GET: the user's saved letters (newest first). POST: save a new one."""
    letters = SavedCoverLetter.objects.filter(user=request.user)
    if request.method == "GET":
        return Response([_summary(letter) for letter in letters])

    if letters.count() >= MAX_LETTERS_PER_USER:
        return Response(
            {"error": f"You can save up to {MAX_LETTERS_PER_USER} cover letters. Delete one first."},
            status=status.HTTP_400_BAD_REQUEST,
        )
    fields, error = _validated(request.data, partial=False)
    if error:
        return Response({"error": error}, status=status.HTTP_400_BAD_REQUEST)
    letter = SavedCoverLetter.objects.create(user=request.user, **fields)
    return Response(_detail(letter), status=status.HTTP_201_CREATED)


@api_view(["GET", "PATCH", "DELETE"])
@permission_classes([IsAuthenticated])
def saved_cover_letter_detail_view(request, letter_id):
    letter = SavedCoverLetter.objects.filter(id=letter_id, user=request.user).first()
    if not letter:
        return Response({"error": "Cover letter not found."}, status=status.HTTP_404_NOT_FOUND)

    if request.method == "GET":
        return Response(_detail(letter))
    if request.method == "DELETE":
        letter.delete()
        return Response({"success": True})

    fields, error = _validated(request.data, partial=True)
    if error:
        return Response({"error": error}, status=status.HTTP_400_BAD_REQUEST)
    for name, value in fields.items():
        setattr(letter, name, value)
    letter.save()
    return Response(_detail(letter))


# ── templates ────────────────────────────────────────────

MAX_TEMPLATE_NAME_CHARS = 100
MAX_TEMPLATES_PER_USER = 50


def _template_json(template):
    return {
        "id": template.id,
        "name": template.name,
        "body": template.body,
        "updatedAt": template.updated_at.isoformat(),
    }


def _validated_template(data, partial):
    fields = {}
    if "name" in data or not partial:
        name = data.get("name")
        if not isinstance(name, str) or not name.strip():
            return None, "Template name is required."
        if len(name.strip()) > MAX_TEMPLATE_NAME_CHARS:
            return None, f"Template name must be at most {MAX_TEMPLATE_NAME_CHARS} characters."
        fields["name"] = name.strip()
    if "body" in data or not partial:
        body = data.get("body")
        if not isinstance(body, str) or not body.strip():
            return None, "The template is empty."
        if len(body) > MAX_CONTENT_CHARS:
            return None, f"The template must be at most {MAX_CONTENT_CHARS} characters."
        fields["body"] = body
    return fields, None


@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated])
def cover_letter_templates_view(request):
    """GET: the user's templates. POST: save a new template."""
    templates = CoverLetterTemplate.objects.filter(user=request.user)
    if request.method == "GET":
        return Response([_template_json(template) for template in templates])

    if templates.count() >= MAX_TEMPLATES_PER_USER:
        return Response(
            {"error": f"You can save up to {MAX_TEMPLATES_PER_USER} templates. Delete one first."},
            status=status.HTTP_400_BAD_REQUEST,
        )
    fields, error = _validated_template(request.data, partial=False)
    if error:
        return Response({"error": error}, status=status.HTTP_400_BAD_REQUEST)
    template = CoverLetterTemplate.objects.create(user=request.user, **fields)
    return Response(_template_json(template), status=status.HTTP_201_CREATED)


@api_view(["PATCH", "DELETE"])
@permission_classes([IsAuthenticated])
def cover_letter_template_detail_view(request, template_id):
    template = CoverLetterTemplate.objects.filter(id=template_id, user=request.user).first()
    if not template:
        return Response({"error": "Template not found."}, status=status.HTTP_404_NOT_FOUND)

    if request.method == "DELETE":
        template.delete()
        return Response({"success": True})

    fields, error = _validated_template(request.data, partial=True)
    if error:
        return Response({"error": error}, status=status.HTTP_400_BAD_REQUEST)
    for name, value in fields.items():
        setattr(template, name, value)
    template.save()
    return Response(_template_json(template))
