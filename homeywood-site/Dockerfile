FROM python:3.13-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

# Dependensi dulu supaya layer ter-cache
COPY requirements.txt .
RUN pip install -r requirements.txt gunicorn

COPY . .

# User non-root (UID 1000 agar cocok dengan bind-mount di host Linux umumnya)
ARG UID=1000
RUN useradd --create-home --uid ${UID} appuser \
    && mkdir -p /app/uploads /app/logs \
    && chown -R appuser:appuser /app
USER appuser

# Aplikasi mendengarkan di port 80 di dalam container
EXPOSE 80

# REVISI: Mengarah ke route /health (pastikan route ini ada di Flask)
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD python -c "import urllib.request,sys; sys.exit(0 if urllib.request.urlopen('http://127.0.0.1:80/health', timeout=3).status == 200 else 1)"

CMD ["gunicorn", "--bind", "0.0.0.0:80", "--workers", "3", "--access-logfile", "-", "--error-logfile", "-", "run:app"]