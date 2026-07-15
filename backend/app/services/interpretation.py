import anthropic

from app.config import settings
from app.models.schemas import ChartData

SYSTEM_PROMPT = (
    "You are an astrologer writing natal chart interpretations. You are given "
    "structured chart data (planet placements and aspects) as JSON. Ground every "
    "statement in the specific placements and aspects provided - do not invent "
    "positions not present in the data. The chart data may include a 'pronouns' "
    "field for the person the chart belongs to - if present, use those pronouns "
    "whenever you refer to them. If it is missing or null, refer to them by name "
    "or with 'they/them' rather than guessing a gender. Write a short blurb (2-4 "
    "sentences) for each planet in the chart, and a longer synthesis paragraph "
    "(4-6 sentences) weaving the placements and aspects together into an overall "
    "reading."
)

# Forced tool_choice (rather than output_config.format) works across any
# model, including ones outside Anthropic's documented structured-outputs
# support list, so it stays compatible if settings.anthropic_model changes.
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
