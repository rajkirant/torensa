FROM public.ecr.aws/lambda/python:3.14

# Runtime lib used by onnxruntime/numba wheels.
RUN dnf install -y libgomp && dnf clean all

# Install Python dependencies into Lambda task root.
COPY backend/requirements.txt /tmp/backend-requirements.txt
COPY lambda/requirements.txt /tmp/lambda-requirements.txt
RUN pip install --no-cache-dir -r /tmp/backend-requirements.txt -t ${LAMBDA_TASK_ROOT} \
    && pip install --no-cache-dir -r /tmp/lambda-requirements.txt -t ${LAMBDA_TASK_ROOT}

# Preload rembg model at build time to avoid runtime download failures/timeouts.
ENV U2NET_HOME=${LAMBDA_TASK_ROOT}/.u2net
RUN mkdir -p ${U2NET_HOME} \
    && python - <<'PY'
from rembg import new_session
new_session("u2netp")
print("u2netp model prepared")
PY

# Copy application code.
COPY backend ${LAMBDA_TASK_ROOT}/backend
COPY lambda ${LAMBDA_TASK_ROOT}/lambda

# Keep metadata colocated for tool-chat metadata resolution in Lambda.
RUN mkdir -p ${LAMBDA_TASK_ROOT}/backend/metadata
COPY frontend/src/metadata/ ${LAMBDA_TASK_ROOT}/backend/metadata/

CMD ["lambda.django_handler.lambda_handler"]
