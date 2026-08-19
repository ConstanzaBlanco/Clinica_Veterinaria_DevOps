# FastAPI application backed by a PostgreSQL database via SQLModel.
# The FastAPI lifespan handler creates database tables at startup.
# Endpoints: GET / (greeting), POST /heroes/ (create), GET /heroes/ (list).
# See https://fastapi.tiangolo.com/ and https://sqlmodel.tiangolo.com/

from collections.abc import AsyncGenerator, Sequence
from contextlib import asynccontextmanager

from fastapi import FastAPI
from sqlmodel import SQLModel, create_engine

from config import settings

# Crea el motor que SQLModel va a utilizar para comunicarse con PostrgeSQL
engine = create_engine(str(settings.SQLALCHEMY_DATABASE_URI))

#Crea las tablas declaradas con SQLModel que todavía no existan
def create_db_and_tables() -> None:
    SQLModel.metadata.create_all(engine)

#Ejecuta el de la creacion de tablas cuando FastAPI incia
@asynccontextmanager
async def lifespan(_app: FastAPI) -> AsyncGenerator[None, None]:
    create_db_and_tables()
    yield


app = FastAPI(lifespan=lifespan)


@app.get("/")
def hello() -> str:
    return "Hello, Docker!"


