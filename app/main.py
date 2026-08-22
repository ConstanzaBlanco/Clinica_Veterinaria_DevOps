from fastapi import FastAPI

from app.tipos_atencion.controller import router as tipos_atencion_router


app = FastAPI(
    title="Pet-Core API",
)


app.include_router(tipos_atencion_router)


@app.get("/")
def hello() -> str:
    return "Hello, Docker!"