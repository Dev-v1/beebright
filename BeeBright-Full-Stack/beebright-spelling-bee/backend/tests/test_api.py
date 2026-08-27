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


def test_built_in_word_list_is_published():
    response = client.get("/api/word-lists")
    assert response.status_code == 200
    assert response.json()[0]["id"] == "champions-2024"
    assert response.json()[0]["built_in"] is True


def test_access_status_requires_a_clerk_session():
    response = client.get("/api/access")
    assert response.status_code == 401


def test_pdf_import_requires_an_admin_session():
    response = client.post(
        "/api/admin/word-lists/import",
        data={"title": "Unauthorized list"},
        files={"file": ("words.pdf", b"not-a-pdf", "application/pdf")},
    )
    assert response.status_code == 401


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
    assert "___" in result["sentence"]
    assert result["sentence"].endswith(".")


def test_sky_sentence_uses_a_three_character_blank():
    result = _safe_dictionary_result(
        {
            "definition": "The region visible above the earth.",
            "origin": "Old Norse origin.",
            "sentence": "The sky was clear today.",
        },
        "sky",
    )
    assert result["sentence"] == "The ___ was clear today."


def test_missing_example_uses_word_specific_definition_sentence():
    result = _safe_dictionary_result(
        {
            "definition": "A large gray animal with a trunk.",
            "origin": "Greek origin.",
            "sentence": "Example sentence unavailable.",
        },
        "elephant",
    )
    assert result["sentence"] == "___ means a large gray animal with a trunk."
    assert "elephant" not in result["sentence"].lower()
