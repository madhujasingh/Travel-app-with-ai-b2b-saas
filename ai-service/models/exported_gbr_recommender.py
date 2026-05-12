from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, List, Optional

import numpy as np
from sklearn.preprocessing import LabelEncoder, MinMaxScaler


# ── Score adjustment constants ────────────────────────────────────────────────
# All three axes (budget, mood, weather) should carry roughly equal weight.
# Old values buried mood/weather under budget — fixed here.

MOOD_MATCH_BONUS     =  12   # was 8 — reward each matching mood tag more
MOOD_MISS_PENALTY    = -18   # was -12 — meaningful but not catastrophic
STRICT_MATCH_BONUS   =  18   # was 14
STRICT_MISS_PENALTY  = -45   # was -40 — keep hard; strict prefs are explicit

WEATHER_EXACT_BONUS  =  14   # was 10 — weather now as important as budget
WEATHER_COMPAT_BONUS =  7    # was 4
WEATHER_MISS_PENALTY = -28   # was -22 — a real deterrent (Amritsar for rainy!)

BUDGET_OVER_PENALTY  = -12   # was -15 — slightly softer so weather/mood can win


@dataclass
class ExportedModelBundle:
    artifact: Dict[str, Any]
    scaler: MinMaxScaler
    encoders: Dict[str, LabelEncoder]


class ExportedGBRRecommender:
    def __init__(self, artifact_path: Optional[str] = None):
        self.artifact_path = Path(artifact_path) if artifact_path else None
        self.bundle: Optional[ExportedModelBundle] = None
        if self.artifact_path and self.artifact_path.exists():
            self.load(self.artifact_path)

    @property
    def is_ready(self) -> bool:
        return self.bundle is not None

    def load(self, artifact_path: Path) -> None:
        with open(artifact_path, 'r', encoding='utf-8') as handle:
            artifact = json.load(handle)

        scaler = MinMaxScaler()
        scaler.min_            = np.array(artifact['scaler']['min_'])
        scaler.scale_          = np.array(artifact['scaler']['scale_'])
        scaler.n_features_in_  = len(artifact['features'])

        encoders: Dict[str, LabelEncoder] = {}
        for key, classes in artifact['encoders'].items():
            encoder = LabelEncoder()
            encoder.classes_ = np.array(classes)
            encoders[key] = encoder

        self.bundle = ExportedModelBundle(
            artifact=artifact,
            scaler=scaler,
            encoders=encoders,
        )

    def recommend(self, user_preferences, num_recommendations: int = 5) -> List[Dict[str, Any]]:
        if not self.bundle:
            raise RuntimeError('Exported GBR model is not loaded')

        scored_results = self._score_packages(user_preferences)
        budget         = float(getattr(user_preferences, 'budget', 0) or 0)
        weather_pref   = normalize_weather_pref(getattr(user_preferences, 'weather_preference', None))
        strict_prefs   = normalize_strict_preferences(
            getattr(user_preferences, 'mood', None),
            getattr(user_preferences, 'interests', []) or [],
        )

        # ── 1. Budget filter (soft) ──────────────────────────────────────────
        affordable = [item for item in scored_results if item['_within_budget_display'] or budget <= 0]
        if not affordable:
            affordable = scored_results

        # ── 2. Strict preference filter ─────────────────────────────────────
        if strict_prefs:
            affordable_strict = [item for item in affordable if item['_strict_preference_match']]
            if affordable_strict:
                affordable = affordable_strict
            else:
                strict_matches = [item for item in scored_results if item['_strict_preference_match']]
                if strict_matches:
                    return []
                return []

        # ── 3. Weather filter — now enforced, not just sorted ────────────────
        if weather_pref:
            exact_weather      = [item for item in affordable if item['_weather_fit'] == 'exact']
            compatible_weather = [item for item in affordable if item['_weather_fit'] == 'compatible']
            neutral_weather    = [item for item in affordable if item['_weather_fit'] == 'neutral']

            # Prefer exact, fall back to compatible, then neutral.
            # Mismatch items are EXCLUDED if we have enough good results.
            if len(exact_weather) >= num_recommendations:
                candidate_pool = exact_weather
            elif len(exact_weather) + len(compatible_weather) >= num_recommendations:
                candidate_pool = exact_weather + compatible_weather
            elif exact_weather or compatible_weather:
                candidate_pool = exact_weather + compatible_weather + neutral_weather
            else:
                # Nothing fits weather at all — fall back to full affordable pool
                candidate_pool = affordable
        else:
            candidate_pool = affordable

        candidate_pool.sort(
            key=lambda item: (
                weather_fit_rank(item['_weather_fit']),
                item['match_score'],
                -item['price'],
            ),
            reverse=True,
        )
        return strip_private_fields(candidate_pool[:num_recommendations])

    def _score_packages(self, user_preferences) -> List[Dict[str, Any]]:
        if not self.bundle:
            raise RuntimeError('Exported GBR model is not loaded')

        budget             = int(getattr(user_preferences, 'budget', 0) or 0)
        n_travelers        = int(getattr(user_preferences, 'num_people', 1) or 1)
        traveler_type      = infer_traveler_type(n_travelers, getattr(user_preferences, 'travel_style', None))
        moods              = normalize_moods(
            getattr(user_preferences, 'mood', None),
            getattr(user_preferences, 'interests', []) or [],
        )
        weather_pref       = normalize_weather_pref(getattr(user_preferences, 'weather_preference', None))
        trip_lane          = normalize_trip_lane(getattr(user_preferences, 'market_preference', None))
        travel_month       = infer_month_label()
        destination_filter = str(getattr(user_preferences, 'destination', '') or '').strip().lower()
        strict_prefs       = normalize_strict_preferences(
            getattr(user_preferences, 'mood', None),
            getattr(user_preferences, 'interests', []) or [],
        )

        results = []
        for package in self.bundle.artifact['catalog']:
            if destination_filter:
                haystack = (
                    f"{package['dest']} {package['country']} {package['city']} "
                    f"{' '.join(package['moods'])}"
                ).lower()
                if destination_filter not in haystack:
                    continue

            features = build_features(
                package,
                budget,
                n_travelers,
                traveler_type,
                moods,
                weather_pref,
                trip_lane,
                travel_month,
                self.bundle.scaler,
                self.bundle.encoders,
                self.bundle.artifact['months'],
            )
            score = gbr_predict(
                features,
                self.bundle.artifact['trees']['trees'],
                self.bundle.artifact['trees']['lr'],
                self.bundle.artifact['trees']['init'],
            )

            # ── Lane penalty (unchanged) ─────────────────────────────────────
            if trip_lane and trip_lane != package['lane']:
                score -= 25

            # ── Mood scoring — equal weight to budget ─────────────────────────
            mood_hits = [m for m in moods if m in package['moods']]
            strict_match = package_matches_strict_preferences(package, strict_prefs)

            if moods and not mood_hits:
                score += MOOD_MISS_PENALTY
            elif mood_hits:
                score += min(MOOD_MATCH_BONUS * 2, len(mood_hits) * MOOD_MATCH_BONUS)

            # ── Strict preference scoring ─────────────────────────────────────
            if strict_prefs:
                if strict_match:
                    score += STRICT_MATCH_BONUS
                else:
                    score += STRICT_MISS_PENALTY

            # ── Weather scoring — equal weight to budget ──────────────────────
            weather_fit = determine_weather_fit(weather_pref, package['weathers'])
            if weather_pref:
                if weather_fit == 'exact':
                    score += WEATHER_EXACT_BONUS
                elif weather_fit == 'compatible':
                    score += WEATHER_COMPAT_BONUS
                else:
                    score += WEATHER_MISS_PENALTY   # was -22, now -28

            # ── Budget penalty (softened) ─────────────────────────────────────
            total_cost = calculate_total_cost(package['price'], n_travelers)
            if total_cost > budget * 1.3:
                score += BUDGET_OVER_PENALTY        # was -15, now -12

            results.append({
                'id':          str(package['id']),
                'title':       package['name'],
                'destination': package['dest'],
                'price':       float(package['price']),
                'duration':    f"{package['days']} Days / {package['nights']} Nights",
                'rating':      float(package['rating']),
                'match_score': 0.0,
                'reasons':     build_reasons(package, budget, n_travelers, moods, weather_pref),
                'image':       icon_for_package(package),
                '_raw_score':             score,
                '_trip_lane':             package['lane'],
                '_total_cost':            total_cost,
                '_within_budget_display': package['price'] <= budget if budget > 0 else True,
                '_weather_fit':           weather_fit,
                '_strict_preference_match': strict_match,
                '_strict_preferences':    strict_prefs,
            })

        apply_score_calibration(results)
        results.sort(key=lambda item: item['match_score'], reverse=True)
        return results

    def generate_insights(self, user_preferences, num_suggestions: int = 3) -> Dict[str, Any]:
        recommendations  = self._score_packages(user_preferences)
        budget           = float(getattr(user_preferences, 'budget', 0) or 0)
        destination_pref = str(getattr(user_preferences, 'destination', '') or '').strip().lower()
        strict_prefs     = normalize_strict_preferences(
            getattr(user_preferences, 'mood', None),
            getattr(user_preferences, 'interests', []) or [],
        )

        upgrade           = []
        discovery         = []
        seen_discovery    = set()
        preference_warning = None

        strict_recs = (
            [item for item in recommendations if item['_strict_preference_match']]
            if strict_prefs else recommendations
        )
        affordable_strict = (
            [item for item in strict_recs if item['_within_budget_display']]
            if budget > 0 else strict_recs
        )

        if strict_prefs and not affordable_strict:
            if strict_recs:
                cheapest = min(strict_recs, key=lambda item: item['price'])
                extra    = max(0.0, float(cheapest['price']) - budget)
                preference_warning = {
                    'type':               'budget_mismatch',
                    'title':              'Your selected trip style needs a bit more budget',
                    'message':            (
                        f"We kept your preferences strict for {format_preferences(strict_prefs)} "
                        f"instead of showing mismatched options."
                    ),
                    'recommended_budget':   float(cheapest['price']),
                    'extra_budget_required': round(extra, 0),
                    'destination':          cheapest['destination'],
                }
            else:
                preference_warning = {
                    'type':    'preference_unavailable',
                    'title':   'No close matches for this trip style yet',
                    'message': (
                        f"We could not find strong {format_preferences(strict_prefs)} packages, "
                        "so we skipped unrelated recommendations."
                    ),
                }

        for item in strict_recs:
            if budget > 0 and item['price'] > budget:
                upgrade.append({
                    'id':                    item['id'],
                    'title':                 item['title'],
                    'destination':           item['destination'],
                    'price':                 item['price'],
                    'extra_budget_required': round(item['price'] - budget, 0),
                })

            dest_key = item['destination'].strip().lower()
            if destination_pref and destination_pref in dest_key:
                continue
            if dest_key in seen_discovery:
                continue
            seen_discovery.add(dest_key)
            discovery.append({
                'destination':      item['destination'],
                'sample_itinerary': item['title'],
                'starting_price':   item['price'],
                'rating':           item['rating'],
            })

        upgrade.sort(key=lambda item: (item['extra_budget_required'], -item['price']))

        return {
            'budget_upgrade_suggestions': upgrade[:num_suggestions],
            'destination_discovery':      discovery[:num_suggestions],
            'preference_warning':         preference_warning,
        }

    @property
    def metadata(self) -> Dict[str, Any]:
        if not self.bundle:
            return {}
        return self.bundle.artifact.get('meta', {})


# ── GBR inference ─────────────────────────────────────────────────────────────

def gbr_predict(
    x: np.ndarray,
    trees: List[Dict[str, Any]],
    learning_rate: float,
    init_pred: float,
) -> float:
    prediction = init_pred
    for tree in trees:
        prediction += learning_rate * predict_tree(tree, x)
    return float(prediction)


def predict_tree(node: Dict[str, Any], x: np.ndarray) -> float:
    if 'leaf' in node:
        return float(node['leaf'])
    if x[node['f']] <= node['t']:
        return predict_tree(node['l'], x)
    return predict_tree(node['r'], x)


# ── Feature engineering ────────────────────────────────────────────────────────

def safe_encode(encoders: Dict[str, LabelEncoder], key: str, value: str) -> int:
    encoder = encoders.get(key)
    if encoder is None:
        return 0
    try:
        return int(encoder.transform([value])[0])
    except ValueError:
        return 0


def build_features(
    package: Dict[str, Any],
    budget: int,
    n_travelers: int,
    traveler_type: str,
    moods: List[str],
    weather_pref: str,
    trip_lane: str,
    month: str,
    scaler: MinMaxScaler,
    encoders: Dict[str, LabelEncoder],
    months: List[str],
) -> np.ndarray:
    month_idx      = {m: i for i, m in enumerate(months)}
    price          = package['price']
    budget_per_head = budget / max(n_travelers, 1)
    cost_ratio     = min(price / max(budget, 1), 4.0)
    total_cost     = calculate_total_cost(price, n_travelers)
    headroom       = max(-200000, min(200000, budget - total_cost))
    within_budget  = 1 if total_cost <= budget else 0
    month_num      = month_idx.get(month, 0)
    mood_match     = sum(1 for m in moods if m in package['moods'])
    weather_match  = 1 if weather_pref in package['weathers'] else 0
    lane_match     = 1 if (trip_lane == '' or trip_lane == package['lane']) else 0
    mood_density   = len([m for m in moods if m])
    mood_list      = (moods + ['', ''])[:3]

    raw = np.array([
        budget, budget_per_head, cost_ratio, headroom, n_travelers,
        month_num, package['days'], package['rating'], price,
        mood_match, weather_match, lane_match, within_budget,
        safe_encode(encoders, 'traveler_type', traveler_type),
        safe_encode(encoders, 'mood_1', mood_list[0]),
        safe_encode(encoders, 'mood_2', mood_list[1]),
        safe_encode(encoders, 'mood_3', mood_list[2]),
        safe_encode(encoders, 'weather_pref', weather_pref),
        safe_encode(encoders, 'trip_lane', trip_lane),
        safe_encode(encoders, 'country', package['country']),
        mood_density,
    ], dtype=float)

    return raw * scaler.scale_ + scaler.min_


def build_reasons(
    package: Dict[str, Any],
    budget: int,
    n_travelers: int,
    moods: List[str],
    weather_pref: str,
) -> List[str]:
    reasons    = []
    total      = calculate_total_cost(package['price'], n_travelers)
    budget_pct = round((total / max(budget, 1)) * 100)

    if total <= budget:
        reasons.append(f"Fits your budget at about {budget_pct}%")
    else:
        reasons.append("Premium option relative to your budget")

    mood_hits = [m for m in moods if m in package['moods']]
    if mood_hits:
        reasons.append(f"Matches your mood: {', '.join(mood_hits[:2])}")

    if weather_pref and weather_pref in package['weathers']:
        reasons.append(f"Weather fit: {weather_pref}")

    if not reasons:
        reasons.append("Strong overall package fit")
    return reasons[:3]


def icon_for_package(package: Dict[str, Any]) -> str:
    moods       = set(package.get('moods', []))
    activities  = ' '.join(package.get('activities', [])).lower()
    if 'Romantic' in moods:
        return 'heart-outline'
    if 'Adventurous' in moods:
        return 'trail-sign-outline'
    if 'Spiritual' in moods:
        return 'sparkles-outline'
    if 'ski' in activities or 'snow' in activities:
        return 'snow-outline'
    if 'beach' in activities or package.get('dest') in {'Goa', 'Maldives', 'Phuket', 'Bali'}:
        return 'sunny-outline'
    return 'compass-outline'


# ── Normalisation helpers ─────────────────────────────────────────────────────

def normalize_moods(primary_mood: Optional[str], interests: List[str]) -> List[str]:
    moods = []
    if primary_mood:
        moods.append(str(primary_mood).strip().title())
    for interest in interests:
        cleaned = str(interest).strip().title()
        if cleaned and cleaned not in moods:
            moods.append(cleaned)
    return moods[:3]


def normalize_strict_preferences(primary_mood: Optional[str], interests: List[str]) -> List[str]:
    preferences = []
    for value in [primary_mood, *(interests or [])]:
        cleaned = normalize_preference_token(value)
        if cleaned and cleaned not in preferences:
            preferences.append(cleaned)
    return preferences[:3]


def normalize_preference_token(value: Optional[str]) -> str:
    token = str(value or '').strip().lower()
    mapping = {
        'adventure':  'adventurous',
        'adventurous':'adventurous',
        'trekking':   'adventurous',
        'spiritual':  'spiritual',
        'party':      'party',
        'romantic':   'romantic',
        'couple':     'romantic',   # ← "couple" now maps to "romantic"
        'relaxed':    'relaxed',
        'cultural':   'curious',
        'culture':    'curious',
        'balanced':   '',
    }
    return mapping.get(token, token)


def package_matches_strict_preferences(
    package: Dict[str, Any],
    strict_preferences: List[str],
) -> bool:
    if not strict_preferences:
        return True

    mood_tokens = {str(m).strip().lower() for m in package.get('moods', [])}
    activity_tokens = {
        token
        for activity in package.get('activities', [])
        for token in str(activity).strip().lower().replace('&', ' ').replace('/', ' ').split()
    }

    synonym_map = {
        'adventurous': {'adventurous', 'adventure', 'trekking', 'trek', 'hiking', 'outdoors', 'ski', 'sports'},
        'spiritual':   {'spiritual', 'soulful', 'reflective', 'temple', 'heritage'},
        'party':       {'party', 'nightlife', 'lively', 'beach'},
        'romantic':    {'romantic', 'honeymoon', 'luxury', 'calm', 'intimate'},
        'relaxed':     {'relaxed', 'calm', 'healing', 'scenic'},
        'curious':     {'curious', 'culture', 'history', 'heritage', 'classic', 'royal', 'immersive', 'modern'},
    }

    package_tokens = mood_tokens.union(activity_tokens)
    for pref in strict_preferences:
        if package_tokens.intersection(synonym_map.get(pref, {pref})):
            return True
    return False


def format_preferences(preferences: List[str]) -> str:
    if not preferences:
        return 'your selected style'
    return ', '.join(p.replace('_', ' ') for p in preferences)


def normalize_weather_pref(value: Optional[str]) -> str:
    if not value:
        return ''
    mapping = {
        'warm':      'Warm',
        'cool':      'Cool',
        'cold':      'Cold',
        'temperate': 'Temperate',
        'rainy':     'Rainy',
        'hot':       'Warm',
    }
    return mapping.get(str(value).strip().lower(), str(value).strip().title())


def normalize_trip_lane(value: Optional[str]) -> str:
    if not value:
        return ''
    mapping = {
        'india':         'India',
        'international': 'International',
        'all':           '',
    }
    return mapping.get(str(value).strip().lower(), str(value).strip().title())


def infer_traveler_type(num_people: int, travel_style: Optional[str]) -> str:
    if num_people <= 1:
        return 'solo'
    if num_people == 2:
        return 'couple'
    if num_people >= 4:
        return 'family' if str(travel_style or '').lower() != 'party' else 'friends'
    return 'friends'


def infer_month_label() -> str:
    from datetime import datetime
    return datetime.now().strftime('%b')


def calculate_total_cost(price: float, n_travelers: int) -> float:
    return float(price) * (n_travelers * 0.8 if n_travelers > 2 else n_travelers)


# ── Score calibration ─────────────────────────────────────────────────────────

def apply_score_calibration(results: List[Dict[str, Any]]) -> None:
    """Normalise raw GBR scores into a [48, 97] display range."""
    if not results:
        return

    raw_scores = [float(item.get('_raw_score', 0.0)) for item in results]
    raw_min    = min(raw_scores)
    raw_max    = max(raw_scores)

    if raw_max - raw_min < 1e-6:
        for i, item in enumerate(
            sorted(results, key=lambda e: e.get('_raw_score', 0.0), reverse=True)
        ):
            item['match_score'] = round(max(62.0, 86.0 - i * 2.5), 1)
        return

    for item in results:
        raw        = float(item.get('_raw_score', 0.0))
        normalised = (raw - raw_min) / (raw_max - raw_min)
        calibrated = 54.0 + (normalised ** 0.82) * 43.0
        item['match_score'] = round(min(97.0, max(48.0, calibrated)), 1)


# ── Weather fit helpers ────────────────────────────────────────────────────────

def determine_weather_fit(preferred_weather: str, package_weathers: List[str]) -> str:
    if not preferred_weather:
        return 'neutral'

    package_weather_set = {str(w).strip().title() for w in package_weathers}
    preferred           = str(preferred_weather).strip().title()

    if preferred in package_weather_set:
        return 'exact'

    compatibility = {
        'Warm':      {'Hot', 'Temperate'},
        'Hot':       {'Warm'},
        'Cool':      {'Cold', 'Temperate'},
        'Cold':      {'Cool', 'Snowy'},
        'Snowy':     {'Cold'},
        'Temperate': {'Warm', 'Cool'},
        'Rainy':     {'Warm', 'Temperate'},
    }
    if package_weather_set.intersection(compatibility.get(preferred, set())):
        return 'compatible'
    return 'mismatch'


def weather_fit_rank(fit: str) -> int:
    return {'exact': 3, 'compatible': 2, 'neutral': 1, 'mismatch': 0}.get(fit, 0)


def strip_private_fields(items: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    return [{k: v for k, v in item.items() if not k.startswith('_')} for item in items]