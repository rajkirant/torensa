import io
import pandas as pd

from rest_framework.decorators import (
    api_view,
    permission_classes,
    authentication_classes,
)
from rest_framework.permissions import AllowAny
from rest_framework.authentication import SessionAuthentication
from rest_framework.response import Response
from rest_framework import status
from django.http import HttpResponse


class CsrfExemptSessionAuthentication(SessionAuthentication):
    """
    Allows POST file uploads without CSRF blocking (matches your old @csrf_exempt).
    """
    def enforce_csrf(self, request):
        return


@api_view(["POST"])
@authentication_classes([CsrfExemptSessionAuthentication])
@permission_classes([AllowAny])
def excel_to_csv(request):
    """
    Accepts Excel file and returns CSV as download.
    """
    uploaded_file = request.FILES.get("file")

    # ---------- Validation ----------
    if not uploaded_file:
        return Response(
            {"error": "No file uploaded"},
            status=status.HTTP_400_BAD_REQUEST,
        )

    if not uploaded_file.name.lower().endswith((".xlsx", ".xls")):
        return Response(
            {"error": "Invalid file type. Only Excel files are supported."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    try:
        # ---------- Read Excel ----------
        df = pd.read_excel(uploaded_file, dtype=str)
        df = df.fillna("")

        # ---------- Convert to CSV ----------
        csv_buffer = io.StringIO()
        df.to_csv(csv_buffer, index=False)
        csv_buffer.seek(0)

        # ---------- Prepare response ----------
        output_filename = (
            uploaded_file.name.rsplit(".", 1)[0] + ".csv"
        )

        response = HttpResponse(
            csv_buffer.getvalue(),
            content_type="text/csv",
        )

        response["Content-Disposition"] = (
            f'attachment; filename="{output_filename}"'
        )

        return response

    except Exception as e:
        return Response(
            {
                "error": "Failed to convert Excel to CSV",
                "details": str(e),
            },
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )
