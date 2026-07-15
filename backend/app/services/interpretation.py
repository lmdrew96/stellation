import anthropic

from app.config import settings
from app.models.schemas import ChartData, SynastryData

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


SYNASTRY_SYSTEM_PROMPT = (
    "You are an astrologer writing a synastry (relationship compatibility) reading "
    "comparing two people's natal charts. You are given structured data for both "
    "people (their planet placements) and the cross-chart aspects between their "
    "placements, as JSON. Ground every statement in the specific placements and "
    "aspects provided - do not invent positions not present in the data. Each "
    "person's 'pronouns' field, if present, tells you which pronouns to use for "
    "them; if missing, use their name or 'they/them' rather than guessing. From "
    "the full list of cross-chart aspects, select the 5-8 most significant "
    "(tightest orb, and prioritizing aspects involving the Sun, Moon, Venus, and "
    "Mars) and write a short blurb (2-4 sentences) for each, explaining what that "
    "specific connection means for how these two people relate. Then write a "
    "longer synthesis paragraph (4-6 sentences) describing the overall shape of "
    "the relationship - where there's ease, where there's friction, and what "
    "these two charts draw out in each other. This is a combined reading about "
    "the pairing, not two separate individual readings."
)

SYNASTRY_INTERPRETATION_TOOL = {
    "name": "record_synastry_interpretation",
    "description": "Record the synastry interpretation as structured data.",
    "input_schema": {
        "type": "object",
        "properties": {
            "aspect_interpretations": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "planet_a": {
                            "type": "string",
                            "description": (
                                "Just the planet name from person A's chart, e.g. "
                                "'Mercury' - do not include the person's name."
                            ),
                        },
                        "planet_b": {
                            "type": "string",
                            "description": (
                                "Just the planet name from person B's chart, e.g. "
                                "'Sun' - do not include the person's name."
                            ),
                        },
                        "aspect_type": {"type": "string"},
                        "blurb": {"type": "string"},
                    },
                    "required": ["planet_a", "planet_b", "aspect_type", "blurb"],
                },
            },
            "synthesis": {"type": "string"},
        },
        "required": ["aspect_interpretations", "synthesis"],
    },
}


def generate_synastry_interpretation(synastry: SynastryData) -> dict:
    client = anthropic.Anthropic(api_key=settings.anthropic_api_key or None)

    response = client.messages.create(
        model=settings.anthropic_model,
        max_tokens=4096,
        system=SYNASTRY_SYSTEM_PROMPT,
        tools=[SYNASTRY_INTERPRETATION_TOOL],
        tool_choice={"type": "tool", "name": "record_synastry_interpretation"},
        messages=[{"role": "user", "content": synastry.model_dump_json()}],
    )

    tool_use = next(b for b in response.content if b.type == "tool_use")
    return tool_use.input
