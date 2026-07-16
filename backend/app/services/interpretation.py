import json

import anthropic

from app.config import settings
from app.models.schemas import Aspect, ChartData, SynastryAspect, SynastryData, TransitData

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


# The same cross-chart aspects mean something different depending on what these
# two people are to each other - a Venus-Mars square reads as romantic tension
# between partners, but is beside the point between siblings. Each framing names
# the planets/houses that matter most for that relationship and tells the model
# what to de-emphasize, rather than leaving it to guess from the aspect list alone.
SYNASTRY_RELATIONSHIP_FRAMING = {
    "romantic": (
        "These two people are romantic partners. Emphasize attraction, intimacy, "
        "long-term compatibility, and how they handle conflict and desire together. "
        "Weight aspects involving Venus, Mars, and the 5th, 7th, and 8th houses most "
        "heavily."
    ),
    "platonic": (
        "These two people are friends. Emphasize shared values, communication style, "
        "mutual support, and what makes the friendship easy or effortful. Weight "
        "aspects involving Mercury, Jupiter, and the 11th house most heavily, and "
        "do not frame the connection in romantic or sexual terms even where Venus "
        "or Mars aspects appear."
    ),
    "familial": (
        "These two people are family members. Emphasize inherited patterns, "
        "obligation versus autonomy, emotional caretaking, and long-run loyalty. "
        "Weight aspects involving the Moon, Saturn, and the 4th house most heavily, "
        "and do not frame the connection in romantic or sexual terms even where "
        "Venus or Mars aspects appear."
    ),
}


def _synastry_system_prompt(relationship_type: str) -> str:
    return (
        "You are an astrologer writing a synastry (relationship compatibility) reading "
        "comparing two people's natal charts. You are given structured data for both "
        "people (their planet placements) and the cross-chart aspects between their "
        "placements, as JSON. Ground every statement in the specific placements and "
        "aspects provided - do not invent positions not present in the data. Each "
        "person's 'pronouns' field, if present, tells you which pronouns to use for "
        "them; if missing, use their name or 'they/them' rather than guessing. "
        f"{SYNASTRY_RELATIONSHIP_FRAMING[relationship_type]} From the full list of "
        "cross-chart aspects, select the 5-8 most significant (tightest orb, and "
        "prioritizing the placements called out above) and write a short blurb (2-4 "
        "sentences) for each, explaining what that specific connection means for how "
        "these two people relate. Then write a longer synthesis paragraph (4-6 "
        "sentences) describing the overall shape of the relationship - where there's "
        "ease, where there's friction, and what these two charts draw out in each "
        "other. This is a combined reading about the pairing, not two separate "
        "individual readings."
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
        system=_synastry_system_prompt(synastry.relationship_type),
        tools=[SYNASTRY_INTERPRETATION_TOOL],
        tool_choice={"type": "tool", "name": "record_synastry_interpretation"},
        messages=[{"role": "user", "content": synastry.model_dump_json()}],
    )

    tool_use = next(b for b in response.content if b.type == "tool_use")
    return tool_use.input


# The full reading already covers each planet (natal) or the top 5-8 aspects
# (synastry) - clicking a specific aspect asks for a closer look at just that
# one connection, including aspects the full reading didn't have room to
# mention. Still given the whole chart as context (not just the aspect in
# isolation) so the answer stays grounded in the rest of the placements.
ASPECT_INSIGHT_SYSTEM_PROMPT = (
    "You are an astrologer. You are given a full natal chart (planet placements "
    "and aspects) as JSON, plus one specific aspect from that chart the person "
    "wants a closer look at. Write a single focused blurb (3-5 sentences) about "
    "that one aspect - what it means, how the two planets' signs and houses "
    "shape its expression, and how it might show up in daily life. Ground every "
    "statement in the chart data provided - do not invent positions not present "
    "in the data. The chart may include a 'pronouns' field for the person the "
    "chart belongs to - if present, use those pronouns. If missing, refer to "
    "them by name or with 'they/them' rather than guessing a gender."
)

ASPECT_INSIGHT_TOOL = {
    "name": "record_aspect_insight",
    "description": "Record the focused aspect insight as structured data.",
    "input_schema": {
        "type": "object",
        "properties": {"blurb": {"type": "string"}},
        "required": ["blurb"],
    },
}


def generate_aspect_insight(chart: ChartData, aspect: Aspect) -> dict:
    client = anthropic.Anthropic(api_key=settings.anthropic_api_key or None)

    payload = {"chart": chart.model_dump(mode="json"), "aspect": aspect.model_dump(mode="json")}
    response = client.messages.create(
        model=settings.anthropic_model,
        max_tokens=1024,
        system=ASPECT_INSIGHT_SYSTEM_PROMPT,
        tools=[ASPECT_INSIGHT_TOOL],
        tool_choice={"type": "tool", "name": "record_aspect_insight"},
        messages=[{"role": "user", "content": json.dumps(payload)}],
    )

    tool_use = next(b for b in response.content if b.type == "tool_use")
    return tool_use.input


# Deliberately not a full reading re-run: short, present-tense, and scoped to
# whatever's tightest-orb right now rather than re-covering the whole chart.
TRANSIT_SYSTEM_PROMPT = (
    "You are an astrologer writing a short 'what's active for you today' transit "
    "reading. You are given a person's natal chart, the sky's current planetary "
    "positions, and the cross-aspects between the two, as JSON. This is not a "
    "full natal reading - keep it brief and grounded in the present moment. "
    "Ground every statement in the specific aspects provided - do not invent "
    "positions not present in the data. The natal chart may include a "
    "'pronouns' field - if present, use those pronouns. If missing, use the "
    "person's name or 'they/them' rather than guessing a gender. From the full "
    "list of transit aspects, select the 3-5 tightest-orb aspects and write a "
    "short blurb (2-3 sentences) for each, explaining what's active right now "
    "and how it might show up today or this week. Then write a short synthesis "
    "(2-4 sentences) naming the overall theme of the moment."
)

TRANSIT_INTERPRETATION_TOOL = {
    "name": "record_transit_interpretation",
    "description": "Record the transit interpretation as structured data.",
    "input_schema": {
        "type": "object",
        "properties": {
            "aspect_interpretations": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "transiting_planet": {"type": "string"},
                        "natal_planet": {"type": "string"},
                        "aspect_type": {"type": "string"},
                        "blurb": {"type": "string"},
                    },
                    "required": ["transiting_planet", "natal_planet", "aspect_type", "blurb"],
                },
            },
            "synthesis": {"type": "string"},
        },
        "required": ["aspect_interpretations", "synthesis"],
    },
}


def generate_transit_interpretation(transit: TransitData) -> dict:
    client = anthropic.Anthropic(api_key=settings.anthropic_api_key or None)

    response = client.messages.create(
        model=settings.anthropic_model,
        max_tokens=2048,
        system=TRANSIT_SYSTEM_PROMPT,
        tools=[TRANSIT_INTERPRETATION_TOOL],
        tool_choice={"type": "tool", "name": "record_transit_interpretation"},
        messages=[{"role": "user", "content": transit.model_dump_json()}],
    )

    tool_use = next(b for b in response.content if b.type == "tool_use")
    return tool_use.input


def _synastry_aspect_insight_system_prompt(relationship_type: str) -> str:
    return (
        "You are an astrologer. You are given a full synastry comparison "
        "(both people's placements and the cross-chart aspects between them) "
        "as JSON, plus one specific cross-chart aspect the person wants a "
        "closer look at. Write a single focused blurb (3-5 sentences) about "
        "what that one connection means for how these two people relate - not "
        "a general reading of the whole relationship, just this aspect. Ground "
        "every statement in the data provided - do not invent positions not "
        "present in the data. Each person's 'pronouns' field, if present, "
        "tells you which pronouns to use for them; if missing, use their name "
        f"or 'they/them' rather than guessing. {SYNASTRY_RELATIONSHIP_FRAMING[relationship_type]}"
    )


SYNASTRY_ASPECT_INSIGHT_TOOL = {
    "name": "record_synastry_aspect_insight",
    "description": "Record the focused synastry aspect insight as structured data.",
    "input_schema": {
        "type": "object",
        "properties": {"blurb": {"type": "string"}},
        "required": ["blurb"],
    },
}


def generate_synastry_aspect_insight(synastry: SynastryData, aspect: SynastryAspect) -> dict:
    client = anthropic.Anthropic(api_key=settings.anthropic_api_key or None)

    payload = {
        "synastry": synastry.model_dump(mode="json"),
        "aspect": aspect.model_dump(mode="json"),
    }
    response = client.messages.create(
        model=settings.anthropic_model,
        max_tokens=1024,
        system=_synastry_aspect_insight_system_prompt(synastry.relationship_type),
        tools=[SYNASTRY_ASPECT_INSIGHT_TOOL],
        tool_choice={"type": "tool", "name": "record_synastry_aspect_insight"},
        messages=[{"role": "user", "content": json.dumps(payload)}],
    )

    tool_use = next(b for b in response.content if b.type == "tool_use")
    return tool_use.input
