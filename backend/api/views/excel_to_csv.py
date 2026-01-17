from django.http import HttpResponse, JsonResponse
from django.views.decorators.http import require_POST
from django.views.decorators.csrf import csrf_exempt
from django.contrib.auth.decorators import login_required

import pandas as pd
import io


@require_POST
@csrf_exempt
def excel_to_csv(request):
    """
    Accepts an Excel file (.xlsx/.xls),
    converts it to CSV using pandas,
    and returns the CSV as a downloadable file.
    """

    uploaded_file = request.FILES.get("file")

    # ---------- Validation ----------
    if not uploaded_file:
        return JsonResponse(
            {"error": "No file uploaded"},
            status=400,
        )

    if not uploaded_file.name.lower().endswith((".xlsx", ".xls")):
        return JsonResponse(
            {"error": "Invalid file type. Only Excel files are supported."},
            status=400,
        )

    try:
        # ---------- Read Excel (robust for inconsistent data) ----------
        df = pd.read_excel(uploaded_file, dtype=str)
        df = df.fillna("")

        # ---------- Convert to CSV (in-memory) ----------
        csv_buffer = io.StringIO()
        df.to_csv(csv_buffer, index=False)
        csv_buffer.seek(0)

        # ---------- Prepare response ----------
        response = HttpResponse(
            csv_buffer.getvalue(),
            content_type="text/csv",
        )

        output_filename = uploaded_file.name.rsplit(".", 1)[0] + ".csv"
        response["Content-Disposition"] = (
            f'attachment; filename="{output_filename}"'
        )

        return response

    except Exception as e:
        return JsonResponse(
            {
                "error": "Failed to convert Excel to CSV",
                "details": str(e),
            },
            status=500,
        )
