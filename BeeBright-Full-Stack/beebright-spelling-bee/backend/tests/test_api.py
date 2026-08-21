from fastapi.testclient import TestClient

from app.main import app
from app.services.distractors import generate_distractors
from app.services.merriam_webster import _safe_dictionary_result


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


def test_every_practice_word_has_one_correct_and_three_wrong_options():
    for level in ("one_bee", "two_bee", "three_bee"):
        response = client.get(f"/api/practice?level={level}&limit=100")
        assert response.status_code == 200
        for item in response.json()["words"]:
            assert len(item["options"]) == 4
            assert len(set(item["options"])) == 4
            assert item["options"].count(item["word"]) == 1


def test_requested_equestrian_example():
    assert generate_distractors("equestrian") == [
        "equestian",
        "equestrean",
        "equestrain",
    ]


def test_dictionary_hints_hide_the_target_and_use_a_complete_sentence():
    result = _safe_dictionary_result(
        {
            "definition": "An equestrian is a person who rides horses.",
            "origin": "Equestrian comes from a Latin term.",
            "sentence": "The equestrian guided the horse.",
        },
        "equestrian",
    )
    assert "equestrian" not in result["definition"].lower()
    assert "equestrian" not in result["origin"].lower()
    assert "equestrian" not in result["sentence"].lower()
    assert "__________" in result["sentence"]
    assert result["sentence"].endswith(".")
