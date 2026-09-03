FROM public.ecr.aws/lambda/python:3.14

ARG LIBREOFFICE_VERSION=25.8.7
ARG DENO_VERSION=2.3.3

# Runtime lib used by onnxruntime/numba wheels + LibreOffice system deps.
RUN dnf install -y \
      libgomp fontconfig dejavu-sans-fonts \
      libX11 libXext libXrender libXinerama libX11-xcb \
      cups-libs \
      nss \
      libxslt \
            tar gzip xz unzip \
    && dnf clean all

# LibreOffice is not in the AL2023 DNF repos — download RPMs directly.
RUN curl -fsSL \
      "https://download.documentfoundation.org/libreoffice/stable/${LIBREOFFICE_VERSION}/rpm/x86_64/LibreOffice_${LIBREOFFICE_VERSION}_Linux_x86-64_rpm.tar.gz" \
            --retry 10 \
            --retry-all-errors \
            --retry-delay 5 \
            --connect-timeout 30 \
            --max-time 1200 \
            --continue-at - \
            -o /tmp/libreoffice.tar.gz \
        && tar xzf /tmp/libreoffice.tar.gz -C /tmp/ \
    && rpm -ivh --nodeps /tmp/LibreOffice_*/RPMS/*.rpm \
    && ln -sf $(ls -d /opt/libreoffice*/program/soffice | head -1) /usr/local/bin/soffice \
    && rm -rf /tmp/LibreOffice_* /tmp/libreoffice.tar.gz

# yt-dlp uses Deno and its EJS scripts to solve YouTube's JavaScript challenges.
RUN curl -fsSL \
            "https://github.com/denoland/deno/releases/download/v${DENO_VERSION}/deno-x86_64-unknown-linux-gnu.zip" \
            -o /tmp/deno.zip \
        && unzip -q /tmp/deno.zip -d /usr/local/bin \
        && chmod +x /usr/local/bin/deno \
        && rm -f /tmp/deno.zip

# FFmpeg (static build) for video/audio conversions.
RUN curl -fsSL "https://johnvansickle.com/ffmpeg/releases/ffmpeg-release-amd64-static.tar.xz" \
      | tar xJ -C /tmp/ \
    && cp /tmp/ffmpeg-*/ffmpeg /usr/local/bin/ffmpeg \
    && chmod +x /usr/local/bin/ffmpeg \
    && rm -rf /tmp/ffmpeg-*

# Install Python dependencies into Lambda task root.
COPY backend/requirements.txt /tmp/backend-requirements.txt
COPY lambda/requirements.txt /tmp/lambda-requirements.txt
RUN pip install --no-cache-dir -r /tmp/backend-requirements.txt -t ${LAMBDA_TASK_ROOT} \
    && pip install --no-cache-dir -r /tmp/lambda-requirements.txt -t ${LAMBDA_TASK_ROOT}

# Preload rembg model at build time to avoid runtime download failures/timeouts.
ENV U2NET_HOME=${LAMBDA_TASK_ROOT}/.u2net
ENV NUMBA_DISABLE_JIT=1
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
