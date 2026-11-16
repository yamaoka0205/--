import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from booking.inbound import (  # noqa: E402
    CALL_PHONE,
    CALL_PHONE_ANONYMOUS,
    CALL_WEBRTC,
    DEFAULT_DEMO_CALLER_NUMBER,
    DEFAULT_DEMO_INBOUND_NUMBER,
    endpoints_from_contact,
)


def tel(address):
    return {"Address": address, "Type": "TELEPHONE_NUMBER"}


def test_normal_phone_uses_both_numbers():
    ep = endpoints_from_contact(
        {
            "InitiationMethod": "INBOUND",
            "SystemEndpoint": tel("+81312345678"),
            "CustomerEndpoint": tel("+819012345678"),
        }
    )
    assert ep.call_type == CALL_PHONE
    assert ep.inbound_id == "+81312345678"
    assert ep.caller_number == "+819012345678"
    assert ep.caller_number_available
    assert not ep.inbound_is_demo and not ep.caller_is_demo


def test_withheld_caller_keeps_real_inbound_and_empty_caller():
    for caller in ("anonymous", "Anonymous", ""):
        contact = {"InitiationMethod": "INBOUND", "SystemEndpoint": tel("+81312345678")}
        if caller:
            contact["CustomerEndpoint"] = tel(caller)
        ep = endpoints_from_contact(contact)
        assert ep.call_type == CALL_PHONE_ANONYMOUS
        assert ep.inbound_id == "+81312345678"
        assert ep.caller_number == ""
        assert not ep.caller_number_available
        assert not ep.inbound_is_demo


def test_webrtc_by_initiation_method_fills_demo_numbers():
    ep = endpoints_from_contact({"InitiationMethod": "WEBRTC_API"})
    assert ep.call_type == CALL_WEBRTC
    assert ep.inbound_id == DEFAULT_DEMO_INBOUND_NUMBER
    assert ep.caller_number == DEFAULT_DEMO_CALLER_NUMBER
    assert ep.inbound_is_demo and ep.caller_is_demo
    assert not ep.caller_number_available


def test_webrtc_by_segment_subtype():
    ep = endpoints_from_contact(
        {"SegmentAttributes": {"connect:Subtype": {"ValueString": "connect:WebRTC"}}}
    )
    assert ep.call_type == CALL_WEBRTC


def test_webrtc_keeps_provided_inbound():
    ep = endpoints_from_contact(
        {"InitiationMethod": "WEBRTC_API", "SystemEndpoint": tel("+81312345678")}
    )
    assert ep.inbound_id == "+81312345678"
    assert not ep.inbound_is_demo


def test_phone_without_dialed_number_does_not_fall_back_to_demo_store():
    ep = endpoints_from_contact(
        {"InitiationMethod": "INBOUND", "CustomerEndpoint": tel("+819012345678")}
    )
    assert ep.call_type == CALL_PHONE
    assert ep.inbound_id == ""
