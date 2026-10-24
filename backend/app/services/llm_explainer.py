import logging
import time
from typing import Dict, Any, Optional
import httpx
from app.core.config import settings

logger = logging.getLogger(__name__)

class GemmaExplainerService:
    """
    Service for generating concise, grounded 1-sentence forecast explanations.
    Uses local Gemma via Ollama if accessible; seamlessly falls back to a deterministic,
    evidence-grounded template engine if Ollama is not running.
    """

    def __init__(self):
        self._cached_status: Optional[Dict[str, Any]] = None
        self._cache_time: float = 0.0

    def check_ollama_status(self, force_refresh: bool = False) -> Dict[str, Any]:
        """Checks if local Ollama daemon is reachable with quick 0.5s timeout and caching."""
        now = time.time()
        if not force_refresh and self._cached_status and (now - self._cache_time < 20.0):
            return self._cached_status

        try:
            with httpx.Client(timeout=0.4) as client:
                res = client.get(f"{settings.OLLAMA_BASE_URL}/api/tags")
                if res.status_code == 200:
                    data = res.json()
                    models = [m.get("name") for m in data.get("models", [])]
                    has_gemma = any("gemma" in m.lower() for m in models)
                    status = {
                        "is_available": True,
                        "base_url": settings.OLLAMA_BASE_URL,
                        "available_models": models,
                        "has_gemma": has_gemma,
                        "status_message": f"Connected to Ollama ({len(models)} models available)."
                    }
                    self._cached_status = status
                    self._cache_time = now
                    return status
        except Exception:
            pass

        status = {
            "is_available": False,
            "base_url": settings.OLLAMA_BASE_URL,
            "available_models": [],
            "has_gemma": False,
            "status_message": "Ollama is not running locally. Using deterministic statistical template explainer."
        }
        self._cached_status = status
        self._cache_time = now
        return status

    def generate_deterministic_explanation(
        self,
        item: str,
        target_weekday_name: str,
        point_forecast: float,
        stats: Dict[str, Any]
    ) -> str:
        """
        Generates a factual, grounded explanation strictly using computed statistics.
        Never hallucinates holidays, weather, or unverified claims.
        """
        sample_size = stats.get("sample_size", 0)
        same_dow_avg = stats.get("same_dow_avg")
        stockout_count = stats.get("stockout_count", 0)
        trend_direction = stats.get("trend_direction", "flat")
        is_weekend = target_weekday_name in ("Saturday", "Sunday")
        
        if sample_size < 7:
            return f"Preliminary forecast based on limited historical observations ({sample_size} days available)."

        # Stockout driven adjustment
        if stockout_count >= 2:
            return (
                f"{target_weekday_name} recommendation reflects upward correction for {stockout_count} recent early stockouts, "
                f"accounting for uncaptured afternoon demand."
            )

        # Weekend bump
        if is_weekend and same_dow_avg and same_dow_avg > 0:
            return (
                f"{target_weekday_name} demand typically experiences a strong weekend peak, averaging {same_dow_avg:.0f} units "
                f"over recent comparable weeks."
            )

        # Trending momentum
        if trend_direction == "increasing":
            return (
                f"Recent 14-day sales trend is increasing; forecast ({point_forecast:.0f} units) adjusts for positive weekday momentum."
            )
        elif trend_direction == "decreasing":
            return (
                f"Recent demand has softened slightly across recent weekdays, adjusting the suggested bake down to {point_forecast:.0f} units."
            )

        # Standard same-weekday baseline
        if same_dow_avg and same_dow_avg > 0:
            return (
                f"{target_weekday_name} sales have been consistent, with recent comparable {target_weekday_name}s averaging {same_dow_avg:.0f} units."
            )

        return f"Forecast of {point_forecast:.0f} units is aligned with recent 4-week historical sales patterns."

    def explain(
        self,
        item: str,
        target_weekday_name: str,
        point_forecast: float,
        recommended_prep: int,
        stats: Dict[str, Any]
    ) -> str:
        """
        Attempts to call Ollama Gemma if available.
        Falls back instantly and reliably to deterministic template generation.
        """
        fallback_text = self.generate_deterministic_explanation(
            item=item,
            target_weekday_name=target_weekday_name,
            point_forecast=point_forecast,
            stats=stats
        )

        ollama_status = self.check_ollama_status()
        if not ollama_status["is_available"]:
            return fallback_text

        # If Ollama is running, construct a strict factual prompt
        model_name = settings.OLLAMA_MODEL
        prompt = (
            f"You are Tomorrow's Tray, an AI assistant for a bakery owner. "
            f"Explain this forecast in exactly ONE concise sentence (under 25 words). "
            f"Do not mention weather or holidays unless specified. Stick strictly to the numbers.\n"
            f"Item: {item}\n"
            f"Target Day: {target_weekday_name}\n"
            f"Forecast: {point_forecast:.0f} units (Prep: {recommended_prep})\n"
            f"Recent Same-Day Average: {stats.get('same_dow_avg', 'N/A')}\n"
            f"Recent Stockouts: {stats.get('stockout_count', 0)}\n"
            f"Trend: {stats.get('trend_direction', 'steady')}\n"
            f"Sentence:"
        )

        try:
            with httpx.Client(timeout=settings.OLLAMA_TIMEOUT_SECONDS) as client:
                res = client.post(
                    f"{settings.OLLAMA_BASE_URL}/api/generate",
                    json={
                        "model": model_name,
                        "prompt": prompt,
                        "stream": False,
                        "options": {"temperature": 0.2, "num_predict": 45}
                    }
                )
                if res.status_code == 200:
                    text = res.json().get("response", "").strip()
                    # Clean up output
                    text = text.replace('"', '').replace('\n', ' ')
                    if len(text) > 10:
                        return text
        except Exception as e:
            logger.debug("Ollama inference skipped: %s", e)

        return fallback_text

llm_explainer = GemmaExplainerService()
