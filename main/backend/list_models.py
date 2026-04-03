import os
from google import genai
from dotenv import load_dotenv

load_dotenv(".env")
load_dotenv(".env.production")

api_key = os.getenv("GOOGLE_GENAI_API_KEY") or os.getenv("GEMINI_API_KEY")
client = genai.Client(api_key=api_key)

print("Listing available models...")
for model in client.models.list():
    print(f"- {model.name}")
