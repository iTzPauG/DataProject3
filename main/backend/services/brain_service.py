"""
Brain Service — LLM pluggable para GADO.
Providers soportados: gemini | openrouter | groq | ollama
"""
from __future__ import annotations

import json
import os
import logging
from typing import Optional

import httpx
from google import genai
from google.genai import types

from config import (
    BRAIN_PROVIDER, 
    GOOGLE_GENAI_API_KEY, 
    OPENROUTER_API_KEY, 
    GROQ_API_KEY, 
    OLLAMA_URL, 
    OLLAMA_MODEL,
    GOOGLE_CLOUD_PROJECT,
    GOOGLE_CLOUD_LOCATION
)

logger = logging.getLogger(__name__)
GEMINI_API_KEY = GOOGLE_GENAI_API_KEY

SYSTEM_PROMPT = """
Eres el asistente de GADO, una app de descubrimiento urbano.
Ayudas a los usuarios a encontrar lugares, eventos y reportes en tiempo real.
Eres conciso, útil y hablas en el idioma que seleccione el usuario por defecto.
Cuando el usuario busca algo, interpreta su intención y devuelve:
{
  "query": "término de búsqueda limpio",
  "category": "food|health|shopping|automotive|culture|nightlife|nature|sport|services|education|event|null",
  "intent": "search|report|info|chat",
  "response": "respuesta natural al usuario"
}
"""


def _is_mock(value: str) -> bool:
    return not value or value.strip().lower() == "mock"


def _provider_chain() -> list[str]:
    preferred = BRAIN_PROVIDER
    providers: list[str] = []

    def add(p: str) -> None:
        if p not in providers:
            providers.append(p)

    add(preferred)
    add("gemini")
    add("openrouter")
    add("groq")
    add("ollama")
    return providers


def _provider_ready(provider: str) -> bool:
    if provider == "gemini":
        return not _is_mock(GEMINI_API_KEY)
    if provider == "openrouter":
        return not _is_mock(OPENROUTER_API_KEY)
    if provider == "groq":
        return not _is_mock(GROQ_API_KEY)
    if provider == "ollama":
        return True
    return False


async def ask_brain(
    user_message: str,
    context: Optional[dict] = None,
    history: Optional[list] = None,
) -> dict:
    """Call the configured LLM provider with fallbacks."""
    last_error: Exception | None = None
    for provider in _provider_chain():
        if not _provider_ready(provider):
            continue
        try:
            if provider == "gemini":
                return await _ask_gemini(user_message)
            if provider == "openrouter":
                return await _ask_openrouter(user_message)
            if provider == "groq":
                return await _ask_groq(user_message)
            if provider == "ollama":
                return await _ask_ollama(user_message)
        except Exception as exc:  # noqa: BLE001 - allow fallback
            logger.error(f"Error in provider {provider}: {exc}")
            last_error = exc
            continue

    if last_error:
        return _fallback(user_message)
    return _fallback(user_message)


async def _ask_gemini(message: str) -> dict:
    """Vertex AI Gemini Implementation."""
    # Use google-genai Client with Vertex AI enabled
    if not GOOGLE_CLOUD_PROJECT:
        logger.warning("GOOGLE_CLOUD_PROJECT not set, falling back to AI Studio (not recommended for Vertex AI mandate)")
        client = genai.Client(api_key=GEMINI_API_KEY)
    else:
        client = genai.Client(
            vertexai=True,
            project=GOOGLE_CLOUD_PROJECT,
            location=GOOGLE_CLOUD_LOCATION
        )

    response = client.models.generate_content(
        model='gemini-2.0-flash',
        contents=f"{SYSTEM_PROMPT}\n\nUsuario: {message}",
        config=types.GenerateContentConfig(
            temperature=0.3,
            max_output_tokens=500,
        )
    )
    return _parse_brain_response(response.text, message)


async def ask_brain_stream(message: str):
    """Vertex AI Gemini Streaming Implementation."""
    if not GOOGLE_CLOUD_PROJECT:
        client = genai.Client(api_key=GEMINI_API_KEY)
    else:
        client = genai.Client(
            vertexai=True,
            project=GOOGLE_CLOUD_PROJECT,
            location=GOOGLE_CLOUD_LOCATION
        )

    responses = client.models.generate_content_stream(
        model='gemini-2.0-flash',
        contents=f"{SYSTEM_PROMPT}\n\nUsuario: {message}",
        config=types.GenerateContentConfig(
            temperature=0.3,
            max_output_tokens=500,
        )
    )
    for response in responses:
        yield json.dumps({"text": response.text}) + "\n"


async def _ask_openrouter(message: str) -> dict:
    headers = {
        "Authorization": f"Bearer {OPENROUTER_API_KEY}",
        "Content-Type": "application/json",
    }
    payload = {
        "model": "meta-llama/llama-4-maverick:free",
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": message},
        ],
        "temperature": 0.3,
        "max_tokens": 500,
    }
    async with httpx.AsyncClient(timeout=15.0) as client:
        resp = await client.post(
            "https://openrouter.ai/api/v1/chat/completions",
            headers=headers,
            json=payload,
        )
        resp.raise_for_status()
        text = resp.json()["choices"][0]["message"]["content"]
    return _parse_brain_response(text, message)


async def _ask_groq(message: str) -> dict:
    headers = {
        "Authorization": f"Bearer {GROQ_API_KEY}",
        "Content-Type": "application/json",
    }
    payload = {
        "model": "llama-3.3-70b-versatile",
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": message},
        ],
        "temperature": 0.3,
        "max_tokens": 500,
    }
    async with httpx.AsyncClient(timeout=15.0) as client:
        resp = await client.post(
            "https://api.groq.com/openai/v1/chat/completions",
            headers=headers,
            json=payload,
        )
        resp.raise_for_status()
        text = resp.json()["choices"][0]["message"]["content"]
    return _parse_brain_response(text, message)


async def _ask_ollama(message: str) -> dict:
    payload = {
        "model": OLLAMA_MODEL,
        "prompt": f"{SYSTEM_PROMPT}\n\nUsuario: {message}",
        "stream": False,
        "options": {"temperature": 0.3},
    }
    async with httpx.AsyncClient(timeout=30.0) as client:
        resp = await client.post(f"{OLLAMA_URL}/api/generate", json=payload)
        resp.raise_for_status()
        text = resp.json()["response"]
    return _parse_brain_response(text, message)


def _parse_brain_response(text: str, original_message: str) -> dict:
    try:
        start = text.find("{")
        end = text.rfind("}") + 1
        if start >= 0 and end > start:
            return json.loads(text[start:end])
    except Exception:
        pass
    return _fallback(original_message)


def _fallback(original_message: str) -> dict:
    return {
        "query": original_message,
        "category": None,
        "intent": "search",
        "response": "Buscando...",
    }
