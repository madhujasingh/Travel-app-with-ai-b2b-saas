"""
Hybrid Recommendation Engine
Combines collaborative and content-based filtering for optimal recommendations.

Weight philosophy: budget, mood, and weather are treated as EQUAL first-class signals.
No single axis dominates. A couple searching for rainy destinations should NOT get
desert/dry results just because the price fits well.
"""

import pandas as pd
import numpy as np
from typing import List, Dict, Optional


# ── Shared weight definitions ────────────────────────────────────────────────
# destination_given=True  → user knows where they want to go
# destination_given=False → discovery mode, destination weight drops

WEIGHTS_WITH_DESTINATION = {
    'budget':      0.20,   # was 0.26 — trimmed so mood+weather can breathe
    'interest':    0.20,   # was 0.28 — same reason
    'popularity':  0.08,   # was 0.12 — tiebreaker only
    'destination': 0.18,   # unchanged-ish (user stated a preference)
    'mood':        0.17,   # was 0.07 — NOW A FIRST-CLASS SIGNAL
    'weather':     0.17,   # was 0.07 — NOW A FIRST-CLASS SIGNAL
}

WEIGHTS_DISCOVERY = {
    'budget':      0.18,   # was 0.24
    'interest':    0.18,   # was 0.26
    'popularity':  0.12,   # slightly higher in discovery to surface good picks
    'destination': 0.04,   # was 0.06 — almost irrelevant in discovery mode
    'mood':        0.24,   # was 0.14 — dominant in discovery
    'weather':     0.24,   # was 0.12 — dominant in discovery
}

assert abs(sum(WEIGHTS_WITH_DESTINATION.values()) - 1.0) < 1e-6
assert abs(sum(WEIGHTS_DISCOVERY.values()) - 1.0) < 1e-6


class RecommendationEngine:
    def __init__(self):
        pass

    def hybrid_recommend(
        self,
        user_preferences,
        itineraries_df: pd.DataFrame,
        num_recommendations: int = 5
    ) -> List[Dict]:
        """
        Hybrid recommendation combining multiple strategies.
        Budget, mood, and weather are weighted equally — none dominates.
        """
        budget_scores      = self._calculate_budget_match(user_preferences, itineraries_df)
        interest_scores    = self._calculate_interest_match(user_preferences, itineraries_df)
        popularity_scores  = self._calculate_popularity_score(itineraries_df)
        destination_scores = self._calculate_destination_match(user_preferences, itineraries_df)
        mood_scores        = self._calculate_mood_match(user_preferences, itineraries_df)
        weather_scores     = self._calculate_weather_match(user_preferences, itineraries_df)

        destination_pref   = getattr(user_preferences, 'destination', None)
        destination_given  = bool(
            destination_pref
            and str(destination_pref).strip()
            and str(destination_pref).strip().lower() not in {'any', 'unknown', 'surprise'}
        )

        w = WEIGHTS_WITH_DESTINATION if destination_given else WEIGHTS_DISCOVERY

        final_scores = (
            budget_scores      * w['budget']      +
            interest_scores    * w['interest']    +
            popularity_scores  * w['popularity']  +
            destination_scores * w['destination'] +
            mood_scores        * w['mood']        +
            weather_scores     * w['weather']
        )

        # ── Hard penalty: if mood or weather is specified and this row is a
        #    mismatch, drop the score significantly so mismatches fall to the
        #    bottom even if budget is perfect.
        final_scores = self._apply_mismatch_penalties(
            user_preferences, itineraries_df, final_scores
        )

        top_indices = np.argsort(final_scores)[::-1][:num_recommendations]

        recommendations = []
        for idx in top_indices:
            itinerary = itineraries_df.iloc[idx]
            reasons = self._generate_reasons(
                user_preferences,
                itinerary,
                budget_scores[idx],
                interest_scores[idx],
                destination_scores[idx],
                mood_scores[idx],
                weather_scores[idx],
            )
            recommendations.append({
                'id':          str(itinerary['id']),
                'title':       itinerary['title'],
                'destination': itinerary['destination'],
                'price':       float(itinerary['price']),
                'duration':    itinerary['duration'],
                'rating':      float(itinerary['rating']),
                'match_score': round(float(final_scores[idx]) * 100, 1),
                'reasons':     reasons,
                'image':       itinerary['image'],
            })

        return recommendations

    # ── Individual scoring methods ───────────────────────────────────────────

    def _calculate_budget_match(self, preferences, df: pd.DataFrame) -> np.ndarray:
        """
        Gaussian around the user's budget.  A trip that costs exactly the
        budget scores 1.0; the score falls off as price diverges.
        Budget style (budget/balanced/luxury) shifts the sweet-spot slightly
        but never overrides mood/weather penalties.
        """
        budget = preferences.budget
        prices = df['price'].values
        sigma  = budget * 0.35   # wider band than before (was 0.30) so small
                                 # price differences don't dominate

        scores = np.exp(-((prices - budget) ** 2) / (2 * sigma ** 2))

        style = str(getattr(preferences, 'travel_style', 'balanced') or 'balanced').lower()
        if style == 'budget':
            # Prefer cheaper options, penalise overpriced ones
            scores = np.where(prices <= budget, scores * 1.1, scores * 0.55)
        elif style == 'luxury':
            # Accept slightly above budget; slight boost for premium
            scores = np.where(prices >= budget * 0.75, scores * 1.1, scores)

        return np.clip(scores, 0, 1)

    def _calculate_interest_match(self, preferences, df: pd.DataFrame) -> np.ndarray:
        """Jaccard similarity between user interests and itinerary interests."""
        user_interests = set(preferences.interests) if preferences.interests else set()

        if not user_interests:
            return np.ones(len(df)) * 0.5

        scores = []
        for _, row in df.iterrows():
            itinerary_interests = set(row.get('interests', []))
            if not itinerary_interests:
                scores.append(0.3)
                continue
            intersection = len(user_interests & itinerary_interests)
            union        = len(user_interests | itinerary_interests)
            scores.append(intersection / union if union > 0 else 0)

        return np.array(scores)

    def _calculate_popularity_score(self, df: pd.DataFrame) -> np.ndarray:
        """Normalised rating — used as a tiebreaker, not a primary driver."""
        ratings = df['rating'].values
        spread  = ratings.max() - ratings.min() + 1e-6
        return (ratings - ratings.min()) / spread

    def _calculate_destination_match(self, preferences, df: pd.DataFrame) -> np.ndarray:
        """Exact / partial destination name match."""
        destination_value = getattr(preferences, 'destination', '') or ''
        destination = str(destination_value).strip().lower()
        if not destination or destination in {'any', 'unknown', 'surprise'}:
            return np.ones(len(df)) * 0.5

        scores = []
        for _, row in df.iterrows():
            dest = row['destination'].lower()
            if destination == dest:
                scores.append(1.0)
            elif destination in dest or dest in destination:
                scores.append(0.75)
            else:
                scores.append(0.15)
        return np.array(scores)

    def _calculate_mood_match(self, preferences, df: pd.DataFrame) -> np.ndarray:
        """
        Mood matching — checks the mood_tags column.
        Returns 1.0 on match, 0.35 on partial (any tag present), 0.1 on miss.
        This makes mood a real discriminator, not a whisper.
        """
        mood_pref = str(getattr(preferences, 'mood', '') or '').strip().lower()
        if not mood_pref or mood_pref in {'any', 'no preference'}:
            return np.ones(len(df)) * 0.5

        # Synonym expansion so "couple" maps to "romantic", etc.
        mood_synonyms = _expand_mood_synonyms(mood_pref)

        scores = []
        for _, row in df.iterrows():
            tags = [str(t).strip().lower() for t in row.get('mood_tags', [])]
            if any(m in tags for m in mood_synonyms):
                scores.append(1.0)
            elif tags:
                scores.append(0.2)   # wrong mood is a real penalty
            else:
                scores.append(0.4)   # no tag info → neutral
        return np.array(scores)

    def _calculate_weather_match(self, preferences, df: pd.DataFrame) -> np.ndarray:
        """
        Weather matching — checks the weather_tags column.
        Returns 1.0 on exact match, 0.65 on compatible, 0.1 on mismatch.
        """
        weather_pref = str(getattr(preferences, 'weather_preference', '') or '').strip().lower()
        if not weather_pref or weather_pref in {'any', 'no preference'}:
            return np.ones(len(df)) * 0.5

        compatible_map = {
            'warm':      {'warm', 'humid', 'hot'},
            'rainy':     {'rainy', 'humid', 'warm'},
            'cool':      {'cool', 'temperate', 'mild'},
            'cold':      {'cold', 'cool'},
            'temperate': {'temperate', 'mild', 'cool', 'warm'},
            'hot':       {'hot', 'warm'},
        }
        compatible = compatible_map.get(weather_pref, {weather_pref})

        scores = []
        for _, row in df.iterrows():
            tags = [str(t).strip().lower() for t in row.get('weather_tags', [])]
            if weather_pref in tags:
                scores.append(1.0)            # exact hit
            elif any(t in compatible for t in tags):
                scores.append(0.65)           # compatible
            elif tags:
                scores.append(0.05)           # real mismatch — penalise hard
            else:
                scores.append(0.4)            # no tag info → neutral
        return np.array(scores)

    def _apply_mismatch_penalties(
        self,
        preferences,
        df: pd.DataFrame,
        scores: np.ndarray,
    ) -> np.ndarray:
        """
        Apply hard multiplicative penalties when mood or weather is clearly wrong.
        This is the key fix: without this, a perfect budget hit can still surface
        a destination that is climate/vibe-incompatible (e.g. dry Amritsar for
        a rainy/couple search).
        """
        mood_pref    = str(getattr(preferences, 'mood', '') or '').strip().lower()
        weather_pref = str(getattr(preferences, 'weather_preference', '') or '').strip().lower()

        if not mood_pref and not weather_pref:
            return scores

        mood_synonyms = _expand_mood_synonyms(mood_pref) if mood_pref else set()

        compatible_weather = {
            'warm':      {'warm', 'humid', 'hot'},
            'rainy':     {'rainy', 'humid', 'warm'},
            'cool':      {'cool', 'temperate', 'mild'},
            'cold':      {'cold', 'cool'},
            'temperate': {'temperate', 'mild', 'cool', 'warm'},
            'hot':       {'hot', 'warm'},
        }.get(weather_pref, {weather_pref})

        penalties = np.ones(len(df))
        for i, (_, row) in enumerate(df.iterrows()):
            mood_tags    = [str(t).strip().lower() for t in row.get('mood_tags', [])]
            weather_tags = [str(t).strip().lower() for t in row.get('weather_tags', [])]

            mood_miss    = (
                bool(mood_pref) and bool(mood_tags)
                and not any(m in mood_tags for m in mood_synonyms)
            )
            weather_miss = (
                bool(weather_pref) and bool(weather_tags)
                and weather_pref not in weather_tags
                and not any(t in compatible_weather for t in weather_tags)
            )

            if mood_miss and weather_miss:
                penalties[i] = 0.30   # double mismatch — almost certainly wrong
            elif mood_miss:
                penalties[i] = 0.55   # wrong vibe
            elif weather_miss:
                penalties[i] = 0.50   # wrong climate

        return scores * penalties

    def _generate_reasons(
        self,
        preferences,
        itinerary,
        budget_score,
        interest_score,
        destination_score,
        mood_score,
        weather_score,
    ) -> List[str]:
        """Generate human-readable reasons for the recommendation."""
        reasons = []

        if destination_score > 0.7:
            reasons.append(f"Matches your destination: {itinerary['destination']}")

        mood_pref = getattr(preferences, 'mood', None)
        if mood_pref and mood_score >= 0.9:
            reasons.append(f"Perfect mood match: {mood_pref.title()}")
        elif mood_pref and mood_score >= 0.6:
            reasons.append(f"Good mood fit: {mood_pref.title()}")

        weather_pref = getattr(preferences, 'weather_preference', None)
        if weather_pref and weather_score >= 0.9:
            reasons.append(f"Ideal weather: {weather_pref.title()}")
        elif weather_pref and weather_score >= 0.6:
            reasons.append(f"Compatible weather: {weather_pref.title()}")

        if budget_score > 0.8:
            reasons.append("Perfect fit for your budget")
        elif budget_score > 0.5:
            reasons.append("Good value for money")

        if interest_score > 0.5:
            reasons.append("Matches your travel interests")

        if itinerary['rating'] >= 4.5:
            reasons.append(f"Highly rated ({itinerary['rating']}⭐)")

        if not reasons:
            reasons.append("Popular choice among travelers")

        return reasons[:3]

    def generate_insights(
        self,
        preferences,
        itineraries_df: pd.DataFrame,
        top_recommendations: List[Dict],
    ) -> Dict:
        """Budget stretch + destination discovery insights."""
        budget       = float(getattr(preferences, 'budget', 0) or 0)
        stretch_limit = budget + 10000

        stretch_df = itineraries_df[
            (itineraries_df['price'] > budget) &
            (itineraries_df['price'] <= stretch_limit)
        ].sort_values(['rating', 'price'], ascending=[False, True]).head(3)

        budget_upgrade_suggestions = []
        for _, row in stretch_df.iterrows():
            delta = int(float(row['price']) - budget)
            budget_upgrade_suggestions.append({
                'id':                   str(row['id']),
                'title':                row['title'],
                'destination':          row['destination'],
                'price':                float(row['price']),
                'extra_budget_required': max(delta, 0),
                'reason': f"Increase budget by ~₹{max(delta, 0):,} to unlock this."
            })

        destination_value = getattr(preferences, 'destination', '') or ''
        destination       = str(destination_value).strip().lower()
        destination_unknown = (not destination) or destination in {'any', 'unknown', 'surprise'}

        destination_discovery = []
        if destination_unknown:
            discovery_df = itineraries_df.sort_values(['rating', 'price'], ascending=[False, True])
            seen = set()
            for _, row in discovery_df.iterrows():
                dest = str(row['destination'])
                if dest in seen:
                    continue
                seen.add(dest)
                destination_discovery.append({
                    'destination':      dest,
                    'sample_itinerary': row['title'],
                    'starting_price':   float(row['price']),
                    'rating':           float(row['rating']),
                })
                if len(destination_discovery) >= 5:
                    break

        return {
            'budget_upgrade_suggestions': budget_upgrade_suggestions,
            'destination_discovery':      destination_discovery,
            'destination_mode':           'discovery' if destination_unknown else 'specific',
            'top_match_count':            len(top_recommendations),
        }


# ── Helpers ──────────────────────────────────────────────────────────────────

def _expand_mood_synonyms(mood: str) -> set:
    """Map user mood tokens to the tags used in the itinerary dataset."""
    synonym_map = {
        'romantic':   {'romantic', 'luxury', 'calm', 'intimate'},
        'couple':     {'romantic', 'luxury', 'calm', 'intimate'},
        'relaxed':    {'relaxed', 'calm', 'healing', 'peaceful'},
        'adventurous':{'adventurous', 'energetic', 'adventure'},
        'adventure':  {'adventurous', 'energetic', 'adventure'},
        'party':      {'party', 'lively', 'nightlife'},
        'spiritual':  {'spiritual', 'reflective', 'healing'},
        'curious':    {'curious', 'culture', 'history'},
        'luxury':     {'luxury', 'polished', 'glamour'},
    }
    return synonym_map.get(mood, {mood})