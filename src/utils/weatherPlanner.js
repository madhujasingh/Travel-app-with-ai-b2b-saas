const OUTDOOR_KEYWORDS = [
  'beach',
  'island',
  'trek',
  'hike',
  'walk',
  'walking',
  'tour',
  'sightseeing',
  'cruise',
  'boat',
  'snorkel',
  'scuba',
  'water',
  'waterfall',
  'safari',
  'camp',
  'market',
  'outdoor',
  'sunset',
  'adventure',
  'park',
];

const WEATHER_COPY = {
  clear: { label: 'Clear skies', icon: 'sunny-outline' },
  cloudy: { label: 'Cloudy', icon: 'cloud-outline' },
  rain: { label: 'Rain expected', icon: 'rainy-outline' },
  snow: { label: 'Snow / freezing', icon: 'snow-outline' },
  storm: { label: 'Storm risk', icon: 'thunderstorm-outline' },
  fog: { label: 'Foggy', icon: 'partly-sunny-outline' },
};

const indoorAlternatives = [
  'Swap this for a local food tasting and cafe trail',
  'Move this to an indoor museum or cultural center visit',
  'Switch to a wellness, spa, or slow-day indoor experience',
  'Try an indoor artisan workshop or shopping arcade instead',
  'Replace with a chef-led dinner or curated lounge evening',
];

const weatherGroupForCode = (code) => {
  if ([0, 1].includes(code)) return 'clear';
  if ([2, 3].includes(code)) return 'cloudy';
  if ([45, 48].includes(code)) return 'fog';
  if ([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return 'rain';
  if ([71, 73, 75, 77, 85, 86].includes(code)) return 'snow';
  if ([95, 96, 99].includes(code)) return 'storm';
  return 'cloudy';
};

const isOutdoorActivity = (activityText = '', icon = '') => {
  const source = `${activityText} ${icon}`.toLowerCase();
  return OUTDOOR_KEYWORDS.some((keyword) => source.includes(keyword));
};

const buildIndoorAlternative = (activityText = '') => {
  const hash = activityText.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return indoorAlternatives[hash % indoorAlternatives.length];
};

export const fetchDestinationWeatherForecast = async (destination, dayCount = 3) => {
  const encoded = encodeURIComponent(destination);
  const geoResponse = await fetch(
    `https://geocoding-api.open-meteo.com/v1/search?name=${encoded}&count=1&language=en&format=json`
  );
  const geoData = await geoResponse.json();
  const place = geoData?.results?.[0];

  if (!place) {
    throw new Error('Weather lookup could not find this destination');
  }

  const days = Math.min(Math.max(dayCount, 1), 7);
  const forecastResponse = await fetch(
    `https://api.open-meteo.com/v1/forecast?latitude=${place.latitude}&longitude=${place.longitude}&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=auto&forecast_days=${days}`
  );
  const forecastData = await forecastResponse.json();

  const daily = (forecastData?.daily?.time || []).map((date, index) => {
    const weatherCode = forecastData.daily.weather_code?.[index] ?? 0;
    const group = weatherGroupForCode(weatherCode);
    const copy = WEATHER_COPY[group];
    const precipitationProbability = forecastData.daily.precipitation_probability_max?.[index] ?? 0;

    return {
      date,
      weatherCode,
      group,
      summary: copy.label,
      icon: copy.icon,
      temperatureMax: forecastData.daily.temperature_2m_max?.[index],
      temperatureMin: forecastData.daily.temperature_2m_min?.[index],
      precipitationProbability,
      hasOutdoorRisk: ['rain', 'storm', 'snow'].includes(group) || precipitationProbability >= 55,
    };
  });

  return {
    locationName: [place.name, place.admin1, place.country].filter(Boolean).join(', '),
    daily,
    generatedAt: new Date().toISOString(),
  };
};

export const adaptItineraryToWeather = (dayPlans = [], forecastDays = []) => {
  const adaptedDayPlans = dayPlans.map((dayPlan, index) => {
    const forecast = forecastDays[index] || null;
    const flaggedActivities = (dayPlan.activities || [])
      .filter((activity) => forecast?.hasOutdoorRisk && isOutdoorActivity(activity.activity, activity.icon))
      .map((activity) => ({
        title: activity.activity,
        alternative: buildIndoorAlternative(activity.activity),
      }));

    return {
      ...dayPlan,
      forecast,
      flaggedActivities,
      weatherAlert:
        forecast?.hasOutdoorRisk && flaggedActivities.length
          ? `${forecast.summary}. ${flaggedActivities.length} outdoor activity${flaggedActivities.length > 1 ? 'ies may' : ' may'} need adjustment.`
          : null,
    };
  });

  const alerts = adaptedDayPlans
    .filter((dayPlan) => dayPlan.weatherAlert)
    .map((dayPlan) => ({
      dayNumber: dayPlan.day || dayPlan.dayNumber,
      title: dayPlan.title,
      summary: dayPlan.weatherAlert,
      alternatives: dayPlan.flaggedActivities.map((item) => item.alternative),
      forecast: dayPlan.forecast,
    }));

  return {
    adaptedDayPlans,
    alerts,
  };
};
