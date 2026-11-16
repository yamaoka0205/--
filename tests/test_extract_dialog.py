import sys
from pathlib import Path
from datetime import date, timedelta
from unittest.mock import MagicMock

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from booking.extract import extract_with_rules  # noqa: E402
from booking.dialog import handle_reservation_turn  # noqa: E402
from booking.faq import match_faq, answer_faq  # noqa: E402
from booking.availability import AvailabilityResult  # noqa: E402
from booking.confirm import ConfirmResult  # noqa: E402


def test_extract_tomorrow_evening_party():
    slots = extract_with_rules("明日の19時半に4人でお願いします")
    tomorrow = date.today() + timedelta(days=1)
    # rules use Asia/Tokyo "today" via local_now — accept either today+1 in Tokyo
    assert slots.time == "19:30"
    assert slots.party_size == 4
    assert slots.date is not None


def test_extract_weekday():
    slots = extract_with_rules("来週の金曜日の18時に2名")
    assert slots.time == "18:00"
    assert slots.party_size == 2
    assert slots.date is not None


def test_dialog_collects_then_confirms(monkeypatch):
    store = MagicMock()

    def fake_avail(*args, **kwargs):
        return AvailabilityResult(
            status="available",
            tenantId="t_demo_001",
            date=kwargs["date_s"],
            startTime=kwargs["start_time_s"],
            endTime="21:00",
            partySize=kwargs["party_size"],
            tableId="T4-01",
            capacity=4,
            candidateTableIds=["T4-01"],
            standardDurationMin=120,
        )

    monkeypatch.setattr("booking.dialog.check_availability", fake_avail)

    r1 = handle_reservation_turn(
        store,
        tenant_id="t_demo_001",
        utterance="明日の19時に4人、ヤマダです",
    )
    assert r1["action"] == "confirm_dtmf"
    assert r1["phase"] == "confirm"
    assert "よろしいですか" in r1["prompt"]

    def fake_confirm(*args, **kwargs):
        return ConfirmResult(
            status="confirmed",
            tenantId="t_demo_001",
            reservationId="rid1",
            date=kwargs["date_s"],
            startTime=kwargs["start_time_s"],
            endTime="21:00",
            partySize=kwargs["party_size"],
            tableId="T4-01",
            capacity=4,
            customerName=kwargs["customer_name"],
            source="ai_phone",
            standardDurationMin=120,
        )

    monkeypatch.setattr("booking.dialog.confirm_reservation", fake_confirm)
    r2 = handle_reservation_turn(
        store,
        tenant_id="t_demo_001",
        utterance="",
        state_data=r1,
        dtmf="1",
    )
    assert r2["phase"] == "done"
    assert r2["resultStatus"] == "confirmed"
    assert "承りました" in r2["prompt"]


def test_faq_match():
    faqs = [
        {
            "SK": "FAQ#hours",
            "question": "営業時間は何時から何時までですか",
            "answer": "11時から22時です",
            "tags": ["営業", "時間"],
        }
    ]
    m = match_faq(faqs, "営業時間を教えて")
    assert m is not None
    assert m["SK"] == "FAQ#hours"
