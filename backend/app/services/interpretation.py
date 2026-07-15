import anthropic

from app.config import settings
from app.models.schemas import ChartData

SYSTEM_PROMPT = (
    "You are an astrologer writing natal chart interpretations. You are given "
    "structured chart data (planet placements and aspects) as JSON. Ground every "
    "statement in the specific placements and aspects provided - do not invent "
    "positions not present in the data. Write a short blurb (2-4 sentences) for "
    "each planet in the chart, and a longer synthesis paragraph (4-6 sentences) "
    "weaving the placements and aspects together into an overall reading."
)

# Forced tool use rather than output_config.format: structured outputs are only
# documented for Fable 5 / Opus 4.8 / Sonnet 5 / Haiku 4.5, and this app is
# pinned to claude-sonnet-4-6 (see settings.anthropic_model) which isn't on
# that list. Forced tool_choice is the widely-compatible way to get typed JSON.
INTERPRETATION_TOOL = {
    "name": "record_interpretation",
    "description": "Record the natal chart interpretation as structured data.",
    "input_schema": {
        "type": "object",
        "properties": {
            "planet_interpretations": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "planet": {"type": "string"},
                        "blurb": {"type": "string"},
                    },
                    "required": ["planet", "blurb"],
                },
            },
            "synthesis": {"type": "string"},
        },
        "required": ["planet_interpretations", "synthesis"],
    },
}


def generate_interpretation(chart: ChartData) -> dict:
    client = anthropic.Anthropic(api_key=settings.anthropic_api_key or None)

    response = client.messages.create(
        model=settings.anthropic_model,
        max_tokens=4096,
        system=SYSTEM_PROMPT,
        tools=[INTERPRETATION_TOOL],
        tool_choice={"type": "tool", "name": "record_interpretation"},
        messages=[{"role": "user", "content": chart.model_dump_json()}],
    )

    tool_use = next(b for b in response.content if b.type == "tool_use")
    return tool_use.input
