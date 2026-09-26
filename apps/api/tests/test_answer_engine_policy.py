from uuid import UUID, uuid4

import pytest
from conftest import make_integration_client, make_test_settings
from fastapi.testclient import TestClient
from pydantic import ValidationError

from careeros_api.answer_classifier import validate_semantic_classifications
from careeros_api.answer_engine import classify_sensitive_question
from careeros_api.answer_engine_schemas import (
    AnswerConfidence,
    AnswerResolutionRequest,
    CanonicalFieldKey,
    NormalizedControlType,
    QuestionCategory,
    SemanticClassificationBatch,
    SemanticFieldClassification,
    SemanticFieldInput,
)
from careeros_api.main import create_app


def field(
    field_id: str,
    *,
    canonical_key: str | None,
    question: str,
    control_type: str = "TEXT",
    required: bool = True,
    mapping_confidence: str = "HIGH",
) -> dict[str, object]:
    return {
        "field_id": field_id,
        "canonical_key": canonical_key,
        "question": question,
        "control_type": control_type,
        "required": required,
        "mapping_confidence": mapping_confidence,
        "options": [],
    }


def test_answer_engine_rejects_unauthenticated_requests() -> None:
    application = create_app(make_test_settings())
    with TestClient(application) as client:
        response = client.post(
            "/answer-engine/resolve",
            json={
                "fields": [
                    {
                        "field_id": "field-1",
                        "canonical_key": "CONTACT_EMAIL",
                        "question": "Email",
                        "control_type": "EMAIL",
                        "required": True,
                        "mapping_confidence": "HIGH",
                    }
                ]
            },
        )
    assert response.status_code == 401


@pytest.mark.parametrize(
    ("question", "expected"),
    [
        ("Will you now or later require visa sponsorship?", QuestionCategory.SPONSORSHIP),
        ("Are you legally authorized to work here?", QuestionCategory.WORK_AUTHORIZATION),
        ("What are your salary expectations?", QuestionCategory.COMPENSATION),
        ("Please provide your disability status", QuestionCategory.DISABILITY),
        ("Please select your veteran status", QuestionCategory.VETERAN),
        ("What is your ethnicity?", QuestionCategory.DEMOGRAPHIC),
        ("Enter your Social Security number", QuestionCategory.GOVERNMENT_ID),
        ("Type your digital signature", QuestionCategory.SIGNATURE),
        ("I certify that this information is correct", QuestionCategory.LEGAL_ATTESTATION),
    ],
)
def test_sensitive_question_classifier_is_deterministic(
    question: str, expected: QuestionCategory
) -> None:
    assert classify_sensitive_question(question) == expected


def test_resolution_request_rejects_duplicate_field_ids() -> None:
    field = {
        "field_id": "same-field",
        "canonical_key": None,
        "question": "Custom question",
        "control_type": "TEXT",
        "required": True,
        "mapping_confidence": "LOW",
    }
    with pytest.raises(ValidationError, match="field_id values must be unique"):
        AnswerResolutionRequest.model_validate({"fields": [field, field]})


def test_semantic_classifier_cannot_claim_high_confidence() -> None:
    with pytest.raises(ValidationError, match="cannot claim HIGH confidence"):
        SemanticFieldClassification(
            field_id="field-1",
            canonical_key=CanonicalFieldKey.CONTACT_EMAIL,
            confidence=AnswerConfidence.HIGH,
        )


def test_semantic_classifier_must_return_exact_owned_field_ids() -> None:
    fields = [
        SemanticFieldInput(
            field_id="field-1",
            question="Electronic mail",
            control_type=NormalizedControlType.TEXT,
        )
    ]
    result = SemanticClassificationBatch(
        classifications=[
            SemanticFieldClassification(
                field_id=str(uuid4()),
                canonical_key=CanonicalFieldKey.CONTACT_EMAIL,
                confidence=AnswerConfidence.MEDIUM,
            )
        ]
    )
    with pytest.raises(ValueError, match="exactly one result per field"):
        validate_semantic_classifications(result, fields)


def test_semantic_classifier_cannot_infer_file_controls() -> None:
    fields = [
        SemanticFieldInput(
            field_id="field-1",
            question="Upload a document",
            control_type=NormalizedControlType.FILE,
        )
    ]
    result = SemanticClassificationBatch(
        classifications=[
            SemanticFieldClassification(
                field_id="field-1",
                canonical_key=CanonicalFieldKey.CONTACT_EMAIL,
                confidence=AnswerConfidence.MEDIUM,
            )
        ]
    )
    with pytest.raises(ValueError, match="cannot classify file controls"):
        validate_semantic_classifications(result, fields)


@pytest.mark.asyncio
@pytest.mark.integration
async def test_contact_info_first_name_fills_person_first_name() -> None:
    user_id = UUID("20000000-0000-4000-8000-000000000001")
    async with make_integration_client(user_id=user_id) as client:
        contact = await client.put(
            "/contact-info",
            json={"first_name": "Jane"},
        )
        assert contact.status_code == 200
        contact_id = contact.json()["id"]

        response = await client.post(
            "/answer-engine/resolve",
            json={
                "fields": [
                    field(
                        "first-name",
                        canonical_key="PERSON_FIRST_NAME",
                        question="First name",
                    )
                ]
            },
        )

        assert response.status_code == 200, response.text
        decision = response.json()["decisions"][0]
        assert decision["action"] == "FILL"
        assert decision["proposed_answer"] == "Jane"
        assert decision["source_category"] == "USER_CONTACT_INFO"
        assert decision["source_reference_id"] == contact_id


@pytest.mark.asyncio
@pytest.mark.integration
async def test_missing_contact_info_asks_for_name_fields() -> None:
    async with make_integration_client() as client:
        response = await client.post(
            "/answer-engine/resolve",
            json={
                "fields": [
                    field(
                        "first-name",
                        canonical_key="PERSON_FIRST_NAME",
                        question="First name",
                    ),
                    field(
                        "last-name",
                        canonical_key="PERSON_LAST_NAME",
                        question="Last name",
                        required=False,
                    ),
                ]
            },
        )

        assert response.status_code == 200, response.text
        decisions = {item["field_id"]: item for item in response.json()["decisions"]}
        assert decisions["first-name"]["action"] == "ASK"
        assert decisions["first-name"]["proposed_answer"] is None
        assert decisions["last-name"]["action"] == "UNKNOWN"
        assert decisions["last-name"]["proposed_answer"] is None


@pytest.mark.asyncio
@pytest.mark.integration
@pytest.mark.parametrize(
    ("canonical_key", "payload_field", "payload_value", "expected_answer", "source_category"),
    [
        ("PERSON_LAST_NAME", "last_name", "Doe", "Doe", "USER_CONTACT_INFO"),
        (
            "CONTACT_EMAIL",
            "contact_email",
            "jobs@example.com",
            "jobs@example.com",
            "USER_CONTACT_INFO",
        ),
        ("CONTACT_PHONE", "phone", "+1 (555) 123-4567", "+1 (555) 123-4567", "USER_CONTACT_INFO"),
        ("CONTACT_WECHAT", "wechat_id", "wx-career", "wx-career", "USER_CONTACT_INFO"),
        ("ADDRESS_LINE_1", "address_line_1", "123 Main St", "123 Main St", "USER_CONTACT_INFO"),
        ("ADDRESS_LINE_2", "address_line_2", "Apt 4", "Apt 4", "USER_CONTACT_INFO"),
        ("ADDRESS_CITY", "city", "Boston", "Boston", "USER_CONTACT_INFO"),
        ("ADDRESS_DISTRICT", "district", "Chaoyang", "Chaoyang", "USER_CONTACT_INFO"),
        ("ADDRESS_REGION", "region", "MA", "MA", "USER_CONTACT_INFO"),
        ("ADDRESS_POSTAL_CODE", "postal_code", "02108", "02108", "USER_CONTACT_INFO"),
        ("ADDRESS_COUNTRY", "country_code", "us", "US", "USER_CONTACT_INFO"),
        (
            "PROFESSIONAL_GITHUB_URL",
            "github_url",
            "https://github.com/janedoe",
            "https://github.com/janedoe",
            "USER_CONTACT_INFO",
        ),
        (
            "PROFESSIONAL_LINKEDIN_URL",
            "linkedin_url",
            "https://linkedin.com/in/janedoe",
            "https://linkedin.com/in/janedoe",
            "USER_CONTACT_INFO",
        ),
        (
            "PROFESSIONAL_PORTFOLIO_URL",
            "portfolio_url",
            "https://janedoe.dev",
            "https://janedoe.dev/",
            "USER_CONTACT_INFO",
        ),
    ],
)
async def test_contact_info_field_mappings(
    canonical_key: str,
    payload_field: str,
    payload_value: str,
    expected_answer: str,
    source_category: str,
) -> None:
    async with make_integration_client() as client:
        saved = await client.put("/contact-info", json={payload_field: payload_value})
        assert saved.status_code == 200

        response = await client.post(
            "/answer-engine/resolve",
            json={
                "fields": [
                    field(
                        "mapped-field",
                        canonical_key=canonical_key,
                        question=f"Field for {canonical_key}",
                    )
                ]
            },
        )

        assert response.status_code == 200, response.text
        decision = response.json()["decisions"][0]
        assert decision["action"] == "FILL"
        assert decision["proposed_answer"] == expected_answer
        assert decision["source_category"] == source_category


@pytest.mark.asyncio
@pytest.mark.integration
async def test_person_full_name_combines_first_and_last() -> None:
    async with make_integration_client() as client:
        saved = await client.put(
            "/contact-info",
            json={
                "first_name": "Jane",
                "last_name": "Doe",
                "name_order": "GIVEN_FAMILY",
            },
        )
        assert saved.status_code == 200

        response = await client.post(
            "/answer-engine/resolve",
            json={
                "fields": [
                    field(
                        "full-name",
                        canonical_key="PERSON_FULL_NAME",
                        question="Full name",
                    )
                ]
            },
        )

        assert response.status_code == 200, response.text
        decision = response.json()["decisions"][0]
        assert decision["action"] == "FILL"
        assert decision["proposed_answer"] == "Jane Doe"
        assert decision["source_category"] == "USER_CONTACT_INFO"


@pytest.mark.asyncio
@pytest.mark.integration
@pytest.mark.parametrize(
    ("market", "form_locale", "expected"),
    [
        ("CHINA", "zh-CN", "王小明"),
        ("NORTH_AMERICA", "en-US", "Xiaoming Wang"),
    ],
)
async def test_person_full_name_uses_confirmed_market_representation(
    market: str, form_locale: str, expected: str
) -> None:
    async with make_integration_client() as client:
        saved = await client.put(
            "/contact-info",
            json={
                "full_name_native": "王小明",
                "full_name_latin": "Xiaoming Wang",
                "first_name": "小明",
                "last_name": "王",
                "name_order": "FAMILY_GIVEN",
            },
        )
        assert saved.status_code == 200

        response = await client.post(
            "/answer-engine/resolve",
            json={
                "market": market,
                "form_locale": form_locale,
                "fields": [
                    field(
                        "full-name",
                        canonical_key="PERSON_FULL_NAME",
                        question="姓名" if market == "CHINA" else "Full name",
                    )
                ],
            },
        )

        assert response.status_code == 200, response.text
        assert response.json()["decisions"][0]["proposed_answer"] == expected


@pytest.mark.asyncio
@pytest.mark.integration
async def test_unconfirmed_name_order_does_not_guess_full_name() -> None:
    async with make_integration_client() as client:
        saved = await client.put(
            "/contact-info",
            json={"first_name": "小明", "last_name": "王"},
        )
        assert saved.status_code == 200

        response = await client.post(
            "/answer-engine/resolve",
            json={
                "fields": [
                    field(
                        "full-name",
                        canonical_key="PERSON_FULL_NAME",
                        question="Full name",
                    )
                ]
            },
        )
        assert response.status_code == 200
        assert response.json()["decisions"][0]["action"] == "ASK"


@pytest.mark.asyncio
@pytest.mark.integration
async def test_sensitive_policies_override_contact_info_name() -> None:
    async with make_integration_client() as client:
        saved = await client.put(
            "/contact-info",
            json={"first_name": "Jane", "last_name": "Doe"},
        )
        assert saved.status_code == 200

        response = await client.post(
            "/answer-engine/resolve",
            json={
                "fields": [
                    field(
                        "demographic-name",
                        canonical_key="PERSON_FIRST_NAME",
                        question="What is your ethnicity?",
                    )
                ]
            },
        )

        assert response.status_code == 200, response.text
        decision = response.json()["decisions"][0]
        assert decision["action"] == "ASK"
        assert decision["proposed_answer"] is None
        assert decision["question_category"] == "DEMOGRAPHIC"
        assert decision["policy_category"] == "SENSITIVE"
