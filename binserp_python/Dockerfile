# ==============================================================================
# Stage 1: Build & Compile Wheels
# ==============================================================================
FROM python:3.11-slim AS builder

WORKDIR /app

# Install minimal build tools for compiling dlib / C extensions
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    cmake \
    libopenblas-dev \
    liblapack-dev \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .

# Pre-compile wheels for all dependencies (cached layer)
RUN pip install --no-cache-dir --upgrade pip setuptools wheel && \
    pip wheel --no-cache-dir --wheel-dir /app/wheels -r requirements.txt

# ==============================================================================
# Stage 2: Ultra-Lightweight Production Runtime
# ==============================================================================
FROM python:3.11-slim

WORKDIR /app

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PORT=8001

# Install only minimal runtime shared libraries (no dev or GUI packages)
# - libopenblas0 & liblapack3: fast numerical math
# - libgomp1: OpenMP parallel execution for onnxruntime/OpenCV
# - libglib2.0-0: core GLib runtime for image codecs
RUN apt-get update && apt-get install -y --no-install-recommends \
    libopenblas0 \
    liblapack3 \
    libgomp1 \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/* \
    && rm -rf /tmp/* /var/tmp/*

# Install pre-built wheels from builder
COPY --from=builder /app/wheels /wheels
COPY requirements.txt .
RUN pip install --no-cache-dir --no-index --find-links=/wheels -r requirements.txt \
    && rm -rf /wheels

# Copy application source code
COPY . .

# Ensure data and models persistence directories exist
RUN mkdir -p /app/data/companies /app/models

EXPOSE 8001

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8001/health')" || exit 1

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8001", "--workers", "1"]
