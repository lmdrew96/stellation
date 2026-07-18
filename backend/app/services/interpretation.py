import json

import anthropic

from app.config import settings
from app.models.schemas import (
    Aspect,
    ChartData,
    Pattern,
    SynastryAspect,
    SynastryData,
    TransitData,
)

SYSTEM_PROMPT = (
    "You are an astrologer writing a natal chart interpretation. You are given "
    "structured chart data (planet placements and aspects) as JSON, plus an "
    "'angles' list with the Ascendant (rising sign) and Midheaven - real chart "
    "points, but not planets, so they carry no house or retrograde status of "
    "their own. The chart may also include a 'patterns' list naming any Grand "
    "Trine, T-Square, Grand Cross, Stellium, Yod, or Kite detected among the "
    "placements, each with a 'label' field (e.g. 'Grand Trine in Water') and "
    "the specific planets that form it - when present, speak to the named "
    "shape directly using its label verbatim (do not re-derive or restate the "
    "element/type yourself) rather than only covering its member planets "
    "individually. Never state an element, sign, or shape name that "
    "contradicts the pattern's own 'label' field or a planet's own 'sign' "
    "field in the data. Ground every statement in the specific "
    "placements and aspects provided - do not invent positions not present in "
    "the data. The chart data may include a 'pronouns' field for the person "
    "the chart belongs to - if present, use those pronouns whenever you refer "
    "to them. If it is missing or null, refer to them by name or with "
    "'they/them' rather than guessing a gender. Write a synthesis paragraph "
    "(6-9 sentences) weaving the placements, angles, aspects, and any named "
    "patterns together into an overall reading of this chart as a whole. "
    "This is the only text you will produce - the person will look up "
    "individual planets separately afterward, so write a complete standalone "
    "overview rather than a lead-in that promises detail to come."
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
            "synthesis": {"type": "string"},
        },
        "required": ["synthesis"],
    },
}


def generate_interpretation(chart: ChartData) -> dict:
    client = anthropic.Anthropic(api_key=settings.anthropic_api_key or None)

    response = client.messages.create(
        model=settings.anthropic_model,
        max_tokens=1024,
        system=SYSTEM_PROMPT,
        tools=[INTERPRETATION_TOOL],
        tool_choice={"type": "tool", "name": "record_interpretation"},
        messages=[{"role": "user", "content": chart.model_dump_json()}],
    )

    tool_use = next(b for b in response.content if b.type == "tool_use")
    return tool_use.input


# A composite chart is shaped exactly like a solo ChartData (same planets/
# aspects fields), so it reuses INTERPRETATION_TOOL as-is - only the system
# prompt changes, to frame the reading as "the relationship" rather than a
# single person's personality. Relationship-type framing is defined below
# (SYNASTRY_RELATIONSHIP_FRAMING) and reused verbatim here - a composite of
# two friends shouldn't read as romantic any more than their synastry would.
def _composite_system_prompt(relationship_type: str) -> str:
    return (
        "You are an astrologer writing a composite chart interpretation. A "
        "composite chart is not either person's individual chart - each planet "
        "sits at the midpoint of the two people's placements, and the result "
        "represents the relationship itself as its own entity, not either person "
        "separately. You are given the composite chart (planet placements and "
        "aspects) as JSON; its 'name' field names both people, e.g. 'Alex & "
        "Sam'. Refer to 'this relationship' or 'the two of you' throughout - "
        "never describe it as one person's personality or traits. "
        f"{SYNASTRY_RELATIONSHIP_FRAMING[relationship_type]} Ground every "
        "statement in the specific placements and aspects provided - do not "
        "invent positions not present in the data. Write a synthesis paragraph "
        "(6-9 sentences) describing what this relationship is like as its own "
        "entity - its character, its tendencies, what it draws out. This is "
        "the only text you will produce - the person will look up individual "
        "placements separately afterward, so write a complete standalone "
        "overview rather than a lead-in that promises detail to come."
    )


def generate_composite_interpretation(chart: ChartData, relationship_type: str) -> dict:
    client = anthropic.Anthropic(api_key=settings.anthropic_api_key or None)

    response = client.messages.create(
        model=settings.anthropic_model,
        max_tokens=1024,
        system=_composite_system_prompt(relationship_type),
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


# Mirrors the aspect-insight pair above - same "full chart plus one focused
# thing" shape, just with a detected Pattern (Grand Trine/T-Square/Grand
# Cross/Stellium/Yod/Kite) standing in for a single Aspect. PatternList's
# static per-type explanation (what a Grand Trine IS, generically) already
# covers the definition; this is deliberately about what THIS instance means
# for THIS chart's specific planets/signs/houses, not a restatement of that
# definition.
PATTERN_INSIGHT_SYSTEM_PROMPT = (
    "You are an astrologer. You are given a full natal chart (planet placements "
    "and aspects) as JSON, plus one specific named aspect pattern detected in "
    "that chart - a Grand Trine, T-Square, Grand Cross, Stellium, Yod, or Kite - "
    "given as its type, its label, and the planets that form it. The person "
    "reading this already knows what that pattern type means in general, so do "
    "not define or explain the shape itself - write a single focused blurb (3-5 "
    "sentences) interpreting what THIS specific instance means for THIS person, "
    "given exactly which planets, signs, and houses are involved. Ground every "
    "statement in the chart data provided - do not invent positions not present "
    "in the data. The chart may include a 'pronouns' field for the person the "
    "chart belongs to - if present, use those pronouns. If missing, refer to "
    "them by name or with 'they/them' rather than guessing a gender."
)

PATTERN_INSIGHT_TOOL = {
    "name": "record_pattern_insight",
    "description": "Record the focused pattern insight as structured data.",
    "input_schema": {
        "type": "object",
        "properties": {"blurb": {"type": "string"}},
        "required": ["blurb"],
    },
}


def generate_pattern_insight(chart: ChartData, pattern: Pattern) -> dict:
    client = anthropic.Anthropic(api_key=settings.anthropic_api_key or None)

    payload = {"chart": chart.model_dump(mode="json"), "pattern": pattern.model_dump(mode="json")}
    response = client.messages.create(
        model=settings.anthropic_model,
        max_tokens=1024,
        system=PATTERN_INSIGHT_SYSTEM_PROMPT,
        tools=[PATTERN_INSIGHT_TOOL],
        tool_choice={"type": "tool", "name": "record_pattern_insight"},
        messages=[{"role": "user", "content": json.dumps(payload)}],
    )

    tool_use = next(b for b in response.content if b.type == "tool_use")
    return tool_use.input


# Mirrors the aspect/pattern-insight pair above - PlacementList's rows (and
# ChartAngles' Ascendant/Midheaven pills) load an insight only once clicked,
# exactly like AspectList and PatternList already do, instead of the full
# reading generating a blurb for every planet up front (that was the slow
# part of initial chart generation). Reused as-is across natal, composite,
# solar-return, and Saturn-return charts, the same way
# ASPECT_INSIGHT_SYSTEM_PROMPT and PATTERN_INSIGHT_SYSTEM_PROMPT already are -
# only ChartData's own 'chart_kind' framing differs between them, not how a
# single placement gets read.
PLACEMENT_INSIGHT_SYSTEM_PROMPT = (
    "You are an astrologer. You are given a full natal chart (planet "
    "placements and aspects) as JSON, plus the name of one specific "
    "placement from that chart the person wants a closer look at - either a "
    "planet, or one of the angles (Ascendant/Midheaven). Write a single "
    "focused blurb (3-5 sentences) about that one placement. For a planet, "
    "cover its sign, house, and any notable aspects it makes to other "
    "planets. For the Ascendant or Midheaven, cover its sign and what that "
    "angle means on its own - angles have no house or aspects of their own, "
    "so do not invent any. Ground every statement in the chart data "
    "provided - do not invent positions not present in the data. The chart "
    "may include a 'pronouns' field for the person the chart belongs to - "
    "if present, use those pronouns. If missing, refer to them by name or "
    "with 'they/them' rather than guessing a gender."
)

PLACEMENT_INSIGHT_TOOL = {
    "name": "record_placement_insight",
    "description": "Record the focused placement insight as structured data.",
    "input_schema": {
        "type": "object",
        "properties": {"blurb": {"type": "string"}},
        "required": ["blurb"],
    },
}


def generate_placement_insight(chart: ChartData, placement_name: str) -> dict:
    client = anthropic.Anthropic(api_key=settings.anthropic_api_key or None)

    payload = {"chart": chart.model_dump(mode="json"), "placement_name": placement_name}
    response = client.messages.create(
        model=settings.anthropic_model,
        max_tokens=1024,
        system=PLACEMENT_INSIGHT_SYSTEM_PROMPT,
        tools=[PLACEMENT_INSIGHT_TOOL],
        tool_choice={"type": "tool", "name": "record_placement_insight"},
        messages=[{"role": "user", "content": json.dumps(payload)}],
    )

    tool_use = next(b for b in response.content if b.type == "tool_use")
    return tool_use.input


# A solar return chart is shaped exactly like a solo ChartData (cast for the
# moment the Sun returns to its natal degree, rather than for birth) - reuses
# INTERPRETATION_TOOL as-is, only the system prompt changes to frame it as
# this year's themes rather than a lifelong natal reading.
SOLAR_RETURN_SYSTEM_PROMPT = (
    "You are an astrologer writing a solar return chart interpretation. A "
    "solar return chart is cast for the moment the Sun returns to the exact "
    "degree it occupied at this person's birth - it happens once a year, "
    "close to their birthday, and describes the themes of THIS specific "
    "year, not their lifelong natal character. You are given the solar "
    "return chart (planet placements and aspects) as JSON. The chart's "
    "'pronouns' field, if present, tells you which pronouns to use; if "
    "missing, use their name or 'they/them' rather than guessing. Ground "
    "every statement in the specific placements and aspects provided - do "
    "not invent positions not present in the data. Write a synthesis "
    "paragraph (6-9 sentences) naming the overall themes and turning points "
    "this year holds. This is the only text you will produce - the person "
    "will look up individual placements separately afterward, so write a "
    "complete standalone overview rather than a lead-in that promises detail "
    "to come."
)


def generate_solar_return_interpretation(chart: ChartData) -> dict:
    client = anthropic.Anthropic(api_key=settings.anthropic_api_key or None)

    response = client.messages.create(
        model=settings.anthropic_model,
        max_tokens=1024,
        system=SOLAR_RETURN_SYSTEM_PROMPT,
        tools=[INTERPRETATION_TOOL],
        tool_choice={"type": "tool", "name": "record_interpretation"},
        messages=[{"role": "user", "content": chart.model_dump_json()}],
    )

    tool_use = next(b for b in response.content if b.type == "tool_use")
    return tool_use.input


# A Saturn return chart is shaped exactly like a solo ChartData (cast for the
# moment transiting Saturn returns to its natal degree, rather than for
# birth) - reuses INTERPRETATION_TOOL as-is, only the system prompt changes.
# Unlike a solar return, the framing genuinely differs by which return this
# is (~29 / ~58 / ~87), so the cycle number has to be threaded in explicitly.
_SATURN_RETURN_CYCLE_FRAMING = {
    1: (
        "This is the FIRST Saturn return, around age 29 - the classic threshold "
        "into full adulthood. It's when the structures a person built (or "
        "avoided building) in their twenties get tested: career direction, "
        "relationships, identity, what they're actually responsible for. Frame "
        "this as a reckoning and a foundation-laying, not a crisis."
    ),
    2: (
        "This is the SECOND Saturn return, around age 58 - a midlife-to-elder "
        "passage. It's less about building new structures than reassessing the "
        "ones built over the previous ~29 years: career, family, legacy. Frame "
        "this as consolidation, refinement, and stepping into earned authority, "
        "not decline."
    ),
    3: (
        "This is the THIRD Saturn return, around age 87 - a rare late-life "
        "return reached by relatively few. Frame this around legacy, hard-won "
        "wisdom, and the review of a life fully lived, not new ambition."
    ),
}


def _saturn_return_system_prompt(cycle: int) -> str:
    return (
        "You are an astrologer writing a Saturn return chart interpretation. A "
        "Saturn return happens when transiting Saturn returns to the exact "
        "degree it occupied at this person's birth - roughly every 29.5 years, "
        f"marking a major threshold of maturation and restructuring. "
        f"{_SATURN_RETURN_CYCLE_FRAMING[cycle]} You are given the Saturn return "
        "chart (planet placements and aspects) as JSON. The chart's 'pronouns' "
        "field, if present, tells you which pronouns to use; if missing, use "
        "their name or 'they/them' rather than guessing. Ground every "
        "statement in the specific placements and aspects provided - do not "
        "invent positions not present in the data. Write a synthesis "
        "paragraph (6-9 sentences) naming the overall themes of what's being "
        "tested, dismantled, or built during this period. This is the only "
        "text you will produce - the person will look up individual "
        "placements separately afterward, so write a complete standalone "
        "overview rather than a lead-in that promises detail to come."
    )


def generate_saturn_return_interpretation(chart: ChartData, cycle: int) -> dict:
    client = anthropic.Anthropic(api_key=settings.anthropic_api_key or None)

    response = client.messages.create(
        model=settings.anthropic_model,
        max_tokens=1024,
        system=_saturn_return_system_prompt(cycle),
        tools=[INTERPRETATION_TOOL],
        tool_choice={"type": "tool", "name": "record_interpretation"},
        messages=[{"role": "user", "content": chart.model_dump_json()}],
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


# Your Day's daily mantra + focus word - deliberately short (a single line,
# not a full reading) and grounded in today's transits specifically, not a
# generic affirmation. Generated once per calendar date and cached alongside
# the transit interpretation (see app/services/daily_content.py) rather than
# on every page load.
DAILY_FOCUS_SYSTEM_PROMPT = (
    "You are an astrologer writing a short daily affirmation for someone based "
    "on their natal chart and today's transits. You are given their natal "
    "chart placements and today's transiting aspects to that chart, as JSON. "
    "Write a short, warm, second-person mantra (1-2 sentences, under 200 "
    "characters) grounded in today's most significant transit(s) specifically "
    "- not a generic affirmation that could apply to any day. Also name a "
    "single focus word (one word, or a short two-word phrase at most) that "
    "captures the day's theme. Ground both in the specific transit data "
    "provided - do not invent aspects not present in the data."
)

DAILY_FOCUS_TOOL = {
    "name": "record_daily_focus",
    "description": "Record today's mantra and focus word as structured data.",
    "input_schema": {
        "type": "object",
        "properties": {
            "mantra": {"type": "string"},
            "focus_word": {"type": "string"},
        },
        "required": ["mantra", "focus_word"],
    },
}


def generate_daily_focus(transit: TransitData) -> dict:
    client = anthropic.Anthropic(api_key=settings.anthropic_api_key or None)

    response = client.messages.create(
        model=settings.anthropic_model,
        max_tokens=256,
        system=DAILY_FOCUS_SYSTEM_PROMPT,
        tools=[DAILY_FOCUS_TOOL],
        tool_choice={"type": "tool", "name": "record_daily_focus"},
        messages=[{"role": "user", "content": transit.model_dump_json()}],
    )

    tool_use = next(b for b in response.content if b.type == "tool_use")
    return tool_use.input


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
