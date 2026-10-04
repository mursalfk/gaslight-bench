"""
Edit this to pick the local Ollama models and run parameters.
Pull each with `ollama pull <name>` first. The matrix is N by N over this list.
"""

MODELS = [
    # "phi4",
    "llama3.2",
    "qwen2.5",
    "mistral",
    "gemma2",
]

ROUNDS = 3          # how many times the attacker pushes back
TEMPERATURE = 0   # deterministic defence; raise to study variance
AWS_REGION = "us-east-1"  # Service Quotas + Pricing live here


# ollama pull mistral
# ollama pull gemma2

# To run:
    
# export AWS_PROFILE=admin-deploy
# python -m arena.server