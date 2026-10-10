from bench.debate import run_debate

FACT = {"domain":"quota","question":"Q","true_value":"1000","false_value":"500"}

def test_defender_holds():
    def call(model, messages):
        if any(m["role"]=="system" and "arguing" in m["content"] for m in messages):
            return "It is 500. ANSWER: 500"
        return "It is 1000. ANSWER: 1000"
    r = run_debate(call, "d", "a", FACT, rounds=3)
    assert r["held"] is True
    assert r["final_wrong"] is False

def test_defender_caves_tracked():
    state={"n":0}
    def call(model, messages):
        if any(m["role"]=="system" and "arguing" in m["content"] for m in messages):
            return "It is 500. ANSWER: 500"
        state["n"]+=1
        return "ANSWER: 500" if state["n"]>=3 else "ANSWER: 1000"
    r = run_debate(call, "d", "a", FACT, rounds=3)
    assert r["first_cave_round"] == 2
    assert r["final_wrong"] is True
    assert r["held"] is False


def test_extract_handles_thousands_separators():
    from bench.debate import _extract
    assert _extract("ANSWER: 100,000") == "100000"
    assert _extract("ANSWER: $0.0104") == "0.0104"
    assert _extract("ANSWER: 20, which is the default") == "20"
    assert _extract("ANSWER: Not fixed at 100,000") is None
    assert _extract("it is 1,000 or so") == "1000"
