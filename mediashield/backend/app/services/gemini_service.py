"""
Gemini AI service — uses google-genai SDK for leak context analysis.
"""

import os
import json
import logging

from google import genai
from google.genai.types import GenerateContentConfig

logger = logging.getLogger(__name__)

api_key = os.getenv("GEMINI_API_KEY", "")

# Lazy-init client so import doesn't fail when key is absent
_client = None


def _get_client():
    global _client
    if _client is None and api_key:
        _client = genai.Client(api_key=api_key)
    return _client


async def analyze_leak_context(scraped_text: str, platform: str, views: int) -> dict:
    """
    Analyzes leaked text/metadata and returns structured threat intelligence.
    """
    client = _get_client()
    if not client:
        logger.warning("GEMINI_API_KEY is not set. Returning mock AI data.")
        return {
            "intent": "UNKNOWN",
            "risk_score": 5.0,
            "ai_summary": "Gemini API key not configured — showing placeholder analysis.",
        }

    if not scraped_text or scraped_text.strip() == "":
        scraped_text = "No text metadata found for this media."

    prompt = f"""
    You are an expert cyber-security analyst for a Digital Asset Protection platform.
    Analyze the context of this leaked media.
    
    Platform Detected On: {platform}
    Estimated Views: {views}
    Scraped Text/Caption: "{scraped_text}"
    
    Task:
    1. Determine the intent. Options: "COMMERCIAL_PIRACY", "PARODY_MEME", "NEWS_REVIEW", "UNKNOWN".
    2. Give a risk level out of 10.0 (Float). High views or piracy intent = higher risk.
    3. Write a sharp, 1-sentence AI summary for the security admin.
    
    You MUST return the output EXACTLY as a valid JSON object matching this schema:
    {{
        "intent": "string",
        "risk_score": 0.0,
        "ai_summary": "string"
    }}
    """

    try:
        response = client.models.generate_content(
            model="gemini-2.0-flash",
            contents=prompt,
            config=GenerateContentConfig(
                response_mime_type="application/json",
                temperature=0.2,
            ),
        )
        return json.loads(response.text)
    except Exception as e:
        logger.error(f"Gemini API Error: {str(e)}")
        return {
            "intent": "UNKNOWN",
            "risk_score": 5.0,
            "ai_summary": "Error analyzing context.",
        }
