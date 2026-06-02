import os
from anthropic import Anthropic

_client: Anthropic | None = None


class LLMError(Exception):
    pass


def _get_client() -> Anthropic:
    global _client
    if _client is None:
        api_key = os.getenv("ANTHROPIC_API_KEY")
        if not api_key or api_key == "your_key_here":
            raise LLMError("ANTHROPIC_API_KEY is not configured")
        _client = Anthropic(api_key=api_key)
    return _client


def call_llm(system: str, user: str, max_tokens: int = 4000) -> str:
    try:
        client = _get_client()
        model = os.getenv("MODEL", "claude-sonnet-4-20250514")
        response = client.messages.create(
            model=model,
            max_tokens=max_tokens,
            system=system,
            messages=[{"role": "user", "content": user}],
        )
        return response.content[0].text
    except LLMError:
        raise
    except Exception as e:
        raise LLMError(str(e)) from e
