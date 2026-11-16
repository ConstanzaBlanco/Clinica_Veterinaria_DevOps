# ---------------------------------------------------------------------------
# Etapa 1: construcción. Instala uv y arma el entorno virtual con las
# dependencias. Nada de esta etapa llega a la imagen final, salvo /app/.venv.
# ---------------------------------------------------------------------------
FROM python:3.13.18-slim-trixie AS builder
# Mantiene Python 3.13 y fija una versión concreta.

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

# Actualiza herramientas de instalación y uv.
RUN python -m pip install --no-cache-dir --upgrade \
    pip setuptools "uv==0.13.6"

# Copia la definición de dependencias y su lockfile.
COPY pyproject.toml uv.lock ./

# Instala solo las dependencias de producción en /app/.venv.
RUN uv sync --locked --no-dev --no-cache

# ---------------------------------------------------------------------------
# Etapa 2: imagen final. Misma base y misma ruta (/app), para que el entorno
# virtual copiado siga funcionando. No incluye uv ni las herramientas de
# instalación.
# ---------------------------------------------------------------------------
FROM python:3.13.18-slim-trixie

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

# Actualiza paquetes Debian con los parches disponibles y elimina pip, que
# solo se necesita al construir.
RUN apt-get update \
    && apt-get upgrade -y \
    && rm -rf /var/lib/apt/lists/* \
    && python -m pip uninstall -y pip

# Crea un usuario y grupo sin privilegios.
RUN groupadd --gid 10001 app \
    && useradd --uid 10001 --gid 10001 --create-home app

# Copia solo el entorno con las dependencias ya instaladas.
COPY --from=builder --chown=10001:10001 /app/.venv /app/.venv

# Copia el código.
COPY --chown=10001:10001 app ./app

# Ejecuta la aplicación sin root.
USER 10001:10001

EXPOSE 8000

# Usa directamente FastAPI desde el entorno instalado.
CMD ["/app/.venv/bin/fastapi", "run", "app/main.py", "--port", "8000"]
