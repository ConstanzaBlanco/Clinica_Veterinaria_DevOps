from collections.abc import Generator

from sqlmodel import Session, create_engine

from app.config import settings


engine = create_engine(str(settings.SQLALCHEMY_DATABASE_URI))


def get_session() -> Generator[Session, None, None]:
    """Dependencia de FastAPI: entrega una sesión de SQLAlchemy por request y
    la cierra al terminar. No reintenta ante fallas de conexión (ver CLAUDE.md,
    sección de reintentos) ni guarda estado entre requests."""
    with Session(engine) as session:
        yield session