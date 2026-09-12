"""Small, auditable OpenAI Responses API client for evidence explanations."""

from __future__ import annotations

import json

import httpx

from app.config import settings
from app.models.responses import CollocationResponse

_INSTRUCTIONS = """You are OceanLens Briefing Mode, an explanation layer for an ocean-science evidence workspace.
Use ONLY the facts in EVIDENCE. This is a locally cached historical demonstration, not live data and not a forecast.
Do not add measurements, causes, hazards, recommendations, sources, or certainty not present in EVIDENCE.
Be concise, plain-language, and explicit about limitations. Never call it real-time.
Answer the supplied question if present; otherwise give a short operational briefing with Situation, Evidence, Confidence, and Limitation headings."""


def _evidence_payload(result: CollocationResponse) -> dict[str, object]:
    return {
        "observation_id": result.observation_id,
        "variable": result.variable,
        "unit": result.unit,
        "observation_source": result.observation_source,
        "model_source": result.model_source,
        "observation_timestamp": result.observation_timestamp,
        "model_timestamp": result.model_timestamp,
        "horizontal_distance_km": result.horizontal_distance_km,
        "time_offset_hours": result.time_offset_hours,
        "sample_count": result.sample_count,
        "rmse": result.rmse,
        "mean_bias": result.mean_bias,
        "interpretation": result.interpretation,
        "depth_bands": [band.model_dump() for band in result.bands],
        "historical_label": "Locally cached historical demonstration data; not a live feed or forecast.",
    }


async def generate_briefing(result: CollocationResponse, *, question: str | None) -> str:
    payload = {"evidence": _evidence_payload(result), "question": (question or "").strip()[:500]}
    async with httpx.AsyncClient(timeout=25) as client:
        response = await client.post(
            "https://api.openai.com/v1/responses",
            headers={"Authorization": f"Bearer {settings.openai_api_key}", "Content-Type": "application/json"},
            json={
                "model": settings.openai_model,
                "instructions": _INSTRUCTIONS,
                "input": json.dumps(payload),
                "store": False,
                # A small reasoning allowance prevents a valid answer from
                # being cut off before its message item is emitted.
                "reasoning": {"effort": "minimal"},
                "max_output_tokens": 800,
            },
        )
    if response.status_code >= 400:
        raise RuntimeError("OpenAI response failed")
    # `output_text` is an SDK convenience helper; the raw REST response
    # carries text in message content items. Do not assume output[0] is a
    # message: reasoning items can precede it.
    text_parts = [
        content.get("text", "")
        for item in response.json().get("output", [])
        if item.get("type") == "message"
        for content in item.get("content", [])
        if content.get("type") == "output_text" and isinstance(content.get("text"), str)
    ]
    text = "\n".join(text_parts).strip()
    if not text:
        raise RuntimeError("OpenAI response was empty")
    return text
