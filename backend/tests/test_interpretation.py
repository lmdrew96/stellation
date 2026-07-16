from app.services.interpretation import (
    SYNASTRY_RELATIONSHIP_FRAMING,
    _composite_system_prompt,
)


class TestCompositeSystemPrompt:
    """Pure prompt-content checks - no Anthropic API call. The bug this
    guards against: the composite prompt used to be a single static string
    with no relationship_type input at all, so every composite reading got
    the same (implicitly romantic-reading) framing regardless of what the
    two people actually are to each other."""

    def test_varies_by_relationship_type(self):
        prompts = {rt: _composite_system_prompt(rt) for rt in SYNASTRY_RELATIONSHIP_FRAMING}
        assert len(set(prompts.values())) == len(prompts)

    def test_includes_the_matching_framing_clause(self):
        for relationship_type, framing in SYNASTRY_RELATIONSHIP_FRAMING.items():
            assert framing in _composite_system_prompt(relationship_type)

    def test_platonic_and_familial_explicitly_avoid_romantic_framing(self):
        # These two framings explicitly say not to read the connection in
        # romantic/sexual terms - that instruction must survive into the
        # composite prompt, not just the synastry one.
        for relationship_type in ("platonic", "familial"):
            prompt = _composite_system_prompt(relationship_type)
            assert "romantic or sexual terms" in prompt
