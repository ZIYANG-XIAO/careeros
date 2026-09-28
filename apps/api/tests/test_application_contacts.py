from uuid import uuid4

import pytest
from conftest import make_integration_client
from test_application_memory import external_payload

pytestmark = pytest.mark.integration


@pytest.mark.asyncio
async def test_contacts_crud_and_cascade_with_application() -> None:
    async with make_integration_client() as client:
        application = (await client.post("/applications", json=external_payload())).json()
        base = f"/applications/{application['id']}/contacts"

        created = await client.post(
            base,
            json={
                "name": "Jordan Lee",
                "relationship_type": "RECRUITER",
                "email": "jordan@example.com",
                "profile_url": "https://www.linkedin.com/in/example",
                "notes": "Met at career fair",
            },
        )
        assert created.status_code == 201, created.text
        contact = created.json()
        assert contact["relationship_type"] == "RECRUITER"

        assert (
            await client.post(base, json={"name": "X", "email": "not-an-email"})
        ).status_code == 422
        assert (
            await client.post(base, json={"name": "X", "relationship_type": "BOSS"})
        ).status_code == 422

        updated = await client.patch(
            f"{base}/{contact['id']}", json={"relationship_type": "REFERRER", "notes": ""}
        )
        assert updated.status_code == 200
        assert updated.json()["relationship_type"] == "REFERRER"
        assert updated.json()["notes"] is None
        assert updated.json()["email"] == "jordan@example.com"

        listed = (await client.get(base)).json()
        assert [item["name"] for item in listed] == ["Jordan Lee"]

        export = (await client.get("/me/export")).json()
        assert export["application_contacts"][0]["name"] == "Jordan Lee"

        assert (await client.delete(f"/applications/{application['id']}")).status_code == 204
        assert (await client.get(base)).status_code == 404


@pytest.mark.asyncio
async def test_contacts_are_owner_scoped() -> None:
    async with make_integration_client() as owner:
        application = (await owner.post("/applications", json=external_payload())).json()
        base = f"/applications/{application['id']}/contacts"
        contact = (await owner.post(base, json={"name": "Sam"})).json()
        async with make_integration_client(user_id=uuid4(), brain_id=uuid4()) as other:
            assert (await other.get(base)).status_code == 404
            assert (await other.post(base, json={"name": "Intruder"})).status_code == 404
            assert (
                await other.patch(f"{base}/{contact['id']}", json={"name": "Hacked"})
            ).status_code == 404
            assert (await other.delete(f"{base}/{contact['id']}")).status_code == 404
        assert (await owner.delete(f"{base}/{contact['id']}")).status_code == 204
        assert (await owner.get(base)).json() == []
