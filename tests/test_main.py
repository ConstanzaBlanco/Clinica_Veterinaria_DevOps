import os

os.environ["JWT_SECRET_KEY"] = "clave-secreta-para-tests-de-mas-de-32-caracteres"
os.environ["POSTGRES_PASSWORD"] = "password-de-prueba"
os.environ["POSTGRES_SERVER"] = "localhost"
os.environ["POSTGRES_USER"] = "petcore_app"
os.environ["POSTGRES_DB"] = "postgres"

from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_health():
    response = client.get("/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}