from fastapi.testclient import TestClient

from app.main import app


client = TestClient(app)


def test_health():
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"


def test_levels_are_available():
    response = client.get("/api/levels")
    assert response.status_code == 200
    keys = {item["key"] for item in response.json()}
    assert {"one_bee", "two_bee", "three_bee"}.issubset(keys)


def test_practice_is_limited_to_100():
    response = client.get("/api/practice?level=one_bee&limit=100")
    assert response.status_code == 200
    assert len(response.json()["words"]) == 100

