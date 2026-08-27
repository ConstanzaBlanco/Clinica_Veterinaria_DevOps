from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware

from app.Middleware.middleware import JWTMiddleware
from app.Auth.login.controller import router as login_router
from app.Auth.me.controller import router as me_router
from app.Auth.Register.clients.controller import router as register_client_router
from app.Mascotas.controller import router as mascotas_router
from app.tipos_atencion.controller import (
    router as tipos_atencion_router,
)
from app.veterinarios.controller import router as veterinarios_router
from app.turnos.controller import router as turnos_router
from app.especies.controller import router as especies_router
from app.disponibilidad.controller import router as disponibilidad_router
from app.agenda.controller import router as agenda_router


app = FastAPI(
    title="Pet-Core API",
)

# Permite que el frontend (Vite, en desarrollo) llame a la API desde el navegador.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.add_middleware(JWTMiddleware)

app.include_router(login_router)
app.include_router(register_client_router)
app.include_router(me_router)
app.include_router(tipos_atencion_router)
app.include_router(mascotas_router)
app.include_router(veterinarios_router)
app.include_router(turnos_router)
app.include_router(especies_router)
app.include_router(disponibilidad_router)
app.include_router(agenda_router)

@app.get("/")
def hello():
    return "Hello, Docker!"

#Verifica que la API esté funcionando correctamente.
@app.get("/health")
def health() -> dict:
    return {"status": "ok"}