from fastapi import FastAPI, Depends

from app.Middleware.middleware import JWTMiddleware
from app.login.controller import router as login_router
from app.tipos_atencion.controller import (
    router as tipos_atencion_router,
)


app = FastAPI(
    title="Pet-Core API",
)

app.add_middleware(JWTMiddleware)

app.include_router(login_router)
app.include_router(tipos_atencion_router)


@app.get("/")
def hello():
    return "Hello, Docker!"