"""Spoiler-safe API and deterministic walkthrough for The Midnight Mail."""


def _new_session(client):
    response = client.post("/sessions", json={"case_id": "midnight_mail"})
    assert response.status_code == 200, response.text
    return response.json()["id"]


def test_midnight_mail_is_listed_and_spoiler_safe(client):
    assert "midnight_mail" in {item["id"] for item in client.get("/cases").json()["cases"]}
    detail = client.get("/cases/midnight_mail")
    assert detail.status_code == 200, detail.text
    body = detail.json()
    assert "truth" not in body
    assert all("reveals" not in item for item in body["evidence"])
    assert all("text" not in node for node in body["dialogues"])


def test_midnight_mail_validation_and_full_accusation_walkthrough(client):
    validation = client.get("/cases/midnight_mail/validate")
    assert validation.status_code == 200, validation.text
    assert validation.json()["valid"] is True, validation.text

    sid = _new_session(client)
    for object_id in (
        "finn_punch", "station_clock", "empty_pouch", "wax_seal", "ticket_punch",
        "sorting_list", "van_key", "signal_notice", "guard_ledger", "coal_gloves",
        "scratched_trunk", "debt_letter",
    ):
        response = client.post(f"/sessions/{sid}/interactions/{object_id}")
        assert response.status_code == 200, (object_id, response.text)
    for node_id in ("ada_mail_01", "arthur_guard_01", "finn_platform_01"):
        response = client.post(f"/sessions/{sid}/dialogue", json={"node_id": node_id})
        assert response.status_code == 200, (node_id, response.text)

    verdict = client.post(f"/sessions/{sid}/accuse", json={"suspect": "ada"})
    assert verdict.status_code == 200, verdict.text
    assert verdict.json()["correct"] is True
