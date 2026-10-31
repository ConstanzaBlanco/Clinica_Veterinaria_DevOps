FROM python:3.13.18-slim-trixie
# Mantiene Python 3.13 y fija una versión concreta.

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

# Actualiza paquetes Debian con los parches disponibles.
RUN apt-get update \
    && apt-get upgrade -y \
    && rm -rf /var/lib/apt/lists/*

# Actualiza herramientas de instalación y uv.
RUN python -m pip install --no-cache-dir --upgrade \
    pip setuptools "uv==0.13.6"

# Copia la definición de dependencias y su lockfile.
COPY pyproject.toml uv.lock ./

# Instala las dependencias y elimina pip, que solo se necesita al construir.
RUN uv sync --locked --no-dev --no-cache \
    && python -m pip uninstall -y pip

# Crea un usuario y grupo sin privilegios.
RUN groupadd --gid 10001 app \
    && useradd --uid 10001 --gid 10001 --create-home app

# Copia el código.
COPY --chown=10001:10001 app ./app

# Ejecuta la aplicación sin root.
USER 10001:10001

EXPOSE 8000

# Usa directamente FastAPI desde el entorno instalado.
CMD ["/app/.venv/bin/fastapi", "run", "app/main.py", "--port", "8000"]