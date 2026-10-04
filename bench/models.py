"""
Local model client via Ollama. Free, offline, no API key, no bills.

Install Ollama (https://ollama.com), then pull the models you want, e.g.:
  ollama pull llama3.2
  ollama pull qwen2.5
  ollama pull phi4
#   ollama pull phi4-13b

A "model" here is just its Ollama tag, set in config.py. The chat() signature is
identical to the OpenRouter version, so debate.py, run.py and the tests are
unchanged. To use a hosted provider later, swap only this file.
"""
import json
import os
import urllib.request

OLLAMA_URL = os.environ.get("OLLAMA_URL", "http://localhost:11434/api/chat")


class ModelError(Exception):
    pass


def chat(model, messages, temperature=0.0, max_tokens=400, timeout=120):
    body = json.dumps({
        "model": model,
        "messages": messages,
        "stream": False,
        "options": {"temperature": temperature, "num_predict": max_tokens},
    }).encode("utf-8")
    req = urllib.request.Request(
        OLLAMA_URL, data=body, method="POST",
        headers={"Content-Type": "application/json"},
    )
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            data = json.loads(r.read().decode("utf-8"))
    except urllib.error.URLError as e:
        raise ModelError(f"cannot reach Ollama at {OLLAMA_URL} ({e}); is `ollama serve` running?")
    try:
        return data["message"]["content"]
    except (KeyError, TypeError):
        raise ModelError(f"unexpected Ollama response: {json.dumps(data)[:200]}")