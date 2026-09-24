from uuid import uuid4

import pytest
from conftest import make_test_settings
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
