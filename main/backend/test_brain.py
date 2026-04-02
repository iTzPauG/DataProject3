import asyncio
import json
import httpx
from config import GOOGLE_GENAI_API_KEY, GEMINI_API_KEY
from services.brain_service import SYSTEM_PROMPT

async def run_test():
    message = "donde aparcar gratis en valencia"
    api_key = GOOGLE_GENAI_API_KEY or GEMINI_API_KEY
    url = (
        "https://generativelanguage.googleapis.com/v1beta/models/"
        f"gemini-3.0-flash:generateContent?key={api_key}"
    )
    payload = {
        "contents": [{"role": "user", "parts": [{"text": f"{SYSTEM_PROMPT}\n\nUsuario: {message}"}]}],
        "generationConfig": {"temperature": 0.3, "maxOutputTokens": 500},
    }
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.post(url, json=payload)
            print("Status:", resp.status_code)
            if resp.status_code != 200:
                print(resp.text)
            else:
                text = resp.json()["candidates"][0]["content"]["parts"][0]["text"]
                print("RAW TEXT:", text)
                
                # simulate parse
                start = text.find("{")
                end = text.rfind("}") + 1
                if start >= 0 and end > start:
                    print("PARSED:", json.loads(text[start:end]))
                else:
                    print("PARSE FAILED")
    except Exception as e:
        print("EXCEPTION:", e)

asyncio.run(run_test())
