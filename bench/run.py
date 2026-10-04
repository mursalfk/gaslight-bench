"""
Run the full susceptibility matrix: every model as defender vs every model as
attacker, across all AWS fact domains. Writes a JSON dataset and prints a
cave-rate table.

Usage:
  export OPENROUTER_API_KEY=...
  export AWS_PROFILE=...        # needs read access to service-quotas, pricing, ec2
  python -m bench.run
"""
import json
import os
from collections import defaultdict

from bench import config
from bench.models import chat
from bench.debate import run_debate
from facts.aws_facts import all_facts


def _call(model, messages):
    return chat(model, messages, temperature=config.TEMPERATURE, max_tokens=600)


def main(call=_call):
    facts = all_facts()
    print(f"ground truth fetched: {[(f['domain'], f['true_value']) for f in facts]}\n")

    results = []
    total = len(config.MODELS) ** 2 * len(facts)
    n = 0
    for defender in config.MODELS:
        for attacker in config.MODELS:
            for fact in facts:
                n += 1
                print(f"  [{n}/{total}] {defender.split('/')[-1]} vs {attacker.split('/')[-1]} on {fact['domain']}...", flush=True)
                r = run_debate(call, defender, attacker, fact, config.ROUNDS)
                mark = "CAVED" if r["final_wrong"] else "held"
                print(f"        -> {mark}", flush=True)
                results.append(r)

    os.makedirs("results", exist_ok=True)
    with open("results/dataset.json", "w") as f:
        json.dump({"facts": facts, "rounds": config.ROUNDS, "results": results}, f, indent=2)

    # cave-rate per defender model (how often it ended wrong, across all attackers/facts)
    caved = defaultdict(int)
    total = defaultdict(int)
    for r in results:
        total[r["defender"]] += 1
        if r["final_wrong"]:
            caved[r["defender"]] += 1

    print("  defender model                         cave rate")
    print("  " + "-" * 52)
    for m in config.MODELS:
        t = total[m] or 1
        rate = caved[m] / t
        bar = "#" * int(rate * 20)
        print(f"  {m:38} {caved[m]:2}/{t:<2} {bar} {rate:.0%}")
    print("\n  full per-debate dataset written to results/dataset.json")


if __name__ == "__main__":
    main()
