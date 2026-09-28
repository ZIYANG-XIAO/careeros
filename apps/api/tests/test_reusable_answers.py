from uuid import uuid4

import pytest
from conftest import make_integration_client

from careeros_api.reusable_answer_lookup import question_key

pytestmark = pytest.mark.integration


def custom_field(
    field_id: str,
    question: str,
    *,
    control_type: str = "TEXT",
    options: list[str] | None = None,
) -> dict[str, object]:
    return {
        "field_id": field_id,
        "canonical_key": None,
        "question": question,
        "control_type": control_type,
        "required": True,
        "mapping_confidence": "LOW",
        "options": options or [],
    }


def test_question_key_ignores_required_markers_case_and_punctuation() -> None:
    assert question_key("How did you hear about us? *") == "how did you hear about us"
    assert question_key("HOW did you  hear about us (required):") == "how did you hear about us"
    assert question_key("您从哪里了解到我们？（必填）") == "您从哪里了解到我们"


@pytest.mark.asyncio
async def test_save_list_replace_and_revoke_preserves_single_active_answer() -> None:
    async with make_integration_client() as client:
        first = await client.post(
            "/reusable-answers",
            json={"question_text": "How did you hear about us?", "answer_text": "LinkedIn"},
        )
        assert first.status_code == 201
        second = await client.post(
            "/reusable-answers",
            json={"question_text": "How did you hear about us *", "answer_text": "A friend"},
        )
        assert second.status_code == 201
        listed = (await client.get("/reusable-answers")).json()
        assert [item["answer_text"] for item in listed] == ["A friend"]

        assert (await client.delete(f"/reusable-answers/{second.json()['id']}")).status_code == 204
        assert (await client.get("/reusable-answers")).json() == []
        assert (await client.delete(f"/reusable-answers/{second.json()['id']}")).status_code == 404


@pytest.mark.asyncio
async def test_sensitive_questions_cannot_be_saved() -> None:
    async with make_integration_client() as client:
        for question in (
            "Will you now or in the future require visa sponsorship?",
            "What are your salary expectations?",
            "Do you have a disability?",
        ):
            response = await client.post(
                "/reusable-answers", json={"question_text": question, "answer_text": "No"}
            )
            assert response.status_code == 422
            assert response.json()["detail"]["code"] == "SENSITIVE_QUESTION"


@pytest.mark.asyncio
async def test_answers_are_owner_scoped() -> None:
    async with make_integration_client() as owner:
        saved = await owner.post(
            "/reusable-answers",
            json={"question_text": "Favorite programming language", "answer_text": "Python"},
        )
        async with make_integration_client(user_id=uuid4(), brain_id=uuid4()) as other:
            assert (await other.get("/reusable-answers")).json() == []
            assert (
                await other.delete(f"/reusable-answers/{saved.json()['id']}")
            ).status_code == 404
            resolved = await other.post(
                "/answer-engine/resolve",
                json={"fields": [custom_field("f1", "Favorite programming language")]},
            )
            assert resolved.json()["decisions"][0]["action"] == "ASK"


@pytest.mark.asyncio
async def test_engine_fills_custom_question_from_saved_answer() -> None:
    async with make_integration_client() as client:
        saved = await client.post(
            "/reusable-answers",
            json={"question_text": "How did you hear about us?", "answer_text": "LinkedIn"},
        )
        await client.post(
            "/reusable-answers",
            json={"question_text": "Are you open to relocation?", "answer_text": "Yes"},
        )
        response = await client.post(
            "/answer-engine/resolve",
            json={
                "fields": [
                    custom_field("f1", "How did you hear about us *"),
                    custom_field(
                        "f2",
                        "Are you open to relocation?",
                        control_type="SELECT",
                        options=["Yes", "No"],
                    ),
                    custom_field(
                        "f3",
                        "Are you open to relocation?",
                        control_type="RADIO_GROUP",
                        options=["Open", "Not open"],
                    ),
                    custom_field("f4", "Unrelated question"),
                ]
            },
        )
        assert response.status_code == 200
        decisions = {item["field_id"]: item for item in response.json()["decisions"]}
        assert decisions["f1"]["action"] == "FILL"
        assert decisions["f1"]["proposed_answer"] == "LinkedIn"
        assert decisions["f1"]["source_category"] == "REUSABLE_CONFIRMED_ANSWER"
        assert decisions["f1"]["source_reference_id"] == saved.json()["id"]
        assert decisions["f2"]["proposed_answer"] == "Yes"
        # A saved choice that is not one of the offered options is not reused.
        assert decisions["f3"]["action"] == "ASK"
        assert decisions["f4"]["action"] == "ASK"
        assert decisions["f4"]["save_intent_required"] is True
