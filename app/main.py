from fastapi import FastAPI, Depends

from app.Middleware.middleware import JWTMiddleware
from app.Auth.login.controller import router as login_router
from app.Auth.me.controller import router as me_router
from app.Auth.Register.clients.controller import router as register_client_router
from app.tipos_atencion.controller import (
    router as tipos_atencion_router,
)


app = FastAPI(
    title="Pet-Core API",
)

app.add_middleware(JWTMiddleware)

app.include_router(login_router)
app.include_router(register_client_router)
app.include_router(me_router)
app.include_router(tipos_atencion_router)



@app.get("/")
def hello():
    return "Hello, Docker!"