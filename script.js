(() => {
  'use strict';

  /* ======================================================
     OPEN-METEO API (free, no key needed)
     ====================================================== */

  const GEO_API = 'https://geocoding-api.open-meteo.com/v1/search';
  const WEATHER_API = 'https://api.open-meteo.com/v1/forecast';

  /* ======================================================
     STATE
     ====================================================== */

  let state = {
    unit: 'celsius',     // 'celsius' | 'fahrenheit'
    lat: null,
    lon: null,
    cityName: '',
    country: '',
    weatherData: null,
    weatherCode: 0,      // WMO weather code for background effects
    isDay: true,
  };

  /* ======================================================
     DOM REFS
     ====================================================== */

  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => document.querySelectorAll(sel);

  const dom = {
    // Background
    skyCanvas:    $('#sky-canvas'),
    partCanvas:   $('#particle-canvas'),
    sunEl:        $('#sun'),
    moonEl:       $('#moon'),
    celestialEl:  $('#celestial-body'),
    cloudEls:     $$('.cloud'),
    fogEls:       $$('.fog'),
    mtnFar:       $('#mountain-far'),
    mtnMid:       $('#mountain-mid'),
    mtnNear:      $('#mountain-near'),
    treelineEl:   $('#treeline'),
    groundEl:     $('#ground'),
    // UI
    searchInput:  $('#search-input'),
    searchResults:$('#search-results'),
    locationBtn:  $('#location-btn'),
    unitC:        $('#unit-c'),
    unitF:        $('#unit-f'),
    loadingScreen:$('#loading-screen'),
    errorScreen:  $('#error-screen'),
    errorMessage: $('#error-message'),
    retryBtn:     $('#retry-btn'),
    weatherContent:$('#weather-content'),
    // Current
    cityName:     $('#city-name'),
    currentDate:  $('#current-date'),
    currentTemp:  $('#current-temp'),
    currentUnit:  $('#current-unit'),
    currentDesc:  $('#current-description'),
    hiTemp:       $('#hi-temp'),
    loTemp:       $('#lo-temp'),
    weatherIcon:  $('#weather-icon-large'),
    // Details
    feelsLike:    $('#feels-like'),
    humidity:     $('#humidity'),
    humidityBar:  $('#humidity-bar'),
    windSpeed:    $('#wind-speed'),
    windDir:      $('#wind-dir'),
    uvIndex:      $('#uv-index'),
    uvLabel:      $('#uv-label'),
    visibility:   $('#visibility'),
    pressure:     $('#pressure'),
    // Forecast
    hourlyCards:  $('#hourly-cards'),
    dailyCards:   $('#daily-cards'),
    sunriseTime:  $('#sunrise-time'),
    sunsetTime:   $('#sunset-time'),
    daylightTime: $('#daylight-time'),
  };

  const skyCtx  = dom.skyCanvas.getContext('2d');
  const partCtx = dom.partCanvas.getContext('2d');

  /* ======================================================
     WMO WEATHER CODE → Description, Icon, Category
     ====================================================== */

  const WMO_MAP = {
    0:  { desc: 'Clear sky',             icon: '☀️', night: '🌙', cat: 'clear' },
    1:  { desc: 'Mainly clear',          icon: '🌤️', night: '🌙', cat: 'clear' },
    2:  { desc: 'Partly cloudy',         icon: '⛅',  night: '☁️', cat: 'cloudy' },
    3:  { desc: 'Overcast',              icon: '☁️',  night: '☁️', cat: 'cloudy' },
    45: { desc: 'Fog',                   icon: '🌫️', night: '🌫️', cat: 'fog' },
    48: { desc: 'Depositing rime fog',   icon: '🌫️', night: '🌫️', cat: 'fog' },
    51: { desc: 'Light drizzle',         icon: '🌦️', night: '🌧️', cat: 'rain' },
    53: { desc: 'Moderate drizzle',      icon: '🌦️', night: '🌧️', cat: 'rain' },
    55: { desc: 'Dense drizzle',         icon: '🌧️', night: '🌧️', cat: 'rain' },
    56: { desc: 'Freezing drizzle',      icon: '🌧️', night: '🌧️', cat: 'rain' },
    57: { desc: 'Dense freezing drizzle',icon: '🌧️', night: '🌧️', cat: 'rain' },
    61: { desc: 'Slight rain',           icon: '🌦️', night: '🌧️', cat: 'rain' },
    63: { desc: 'Moderate rain',         icon: '🌧️', night: '🌧️', cat: 'rain' },
    65: { desc: 'Heavy rain',            icon: '🌧️', night: '🌧️', cat: 'rain' },
    66: { desc: 'Freezing rain',         icon: '🌧️', night: '🌧️', cat: 'rain' },
    67: { desc: 'Heavy freezing rain',   icon: '🌧️', night: '🌧️', cat: 'rain' },
    71: { desc: 'Slight snowfall',       icon: '🌨️', night: '🌨️', cat: 'snow' },
    73: { desc: 'Moderate snowfall',     icon: '🌨️', night: '🌨️', cat: 'snow' },
    75: { desc: 'Heavy snowfall',        icon: '❄️',  night: '❄️',  cat: 'snow' },
    77: { desc: 'Snow grains',           icon: '❄️',  night: '❄️',  cat: 'snow' },
    80: { desc: 'Slight rain showers',   icon: '🌦️', night: '🌧️', cat: 'rain' },
    81: { desc: 'Moderate rain showers', icon: '🌧️', night: '🌧️', cat: 'rain' },
    82: { desc: 'Violent rain showers',  icon: '⛈️',  night: '⛈️',  cat: 'storm' },
    85: { desc: 'Slight snow showers',   icon: '🌨️', night: '🌨️', cat: 'snow' },
    86: { desc: 'Heavy snow showers',    icon: '❄️',  night: '❄️',  cat: 'snow' },
    95: { desc: 'Thunderstorm',          icon: '⛈️',  night: '⛈️',  cat: 'storm' },
    96: { desc: 'Thunderstorm with hail',icon: '⛈️',  night: '⛈️',  cat: 'storm' },
    99: { desc: 'Heavy thunderstorm',    icon: '⛈️',  night: '⛈️',  cat: 'storm' },
  };

  function getWeatherInfo(code, isDay) {
    const info = WMO_MAP[code] || WMO_MAP[0];
    return {
      desc: info.desc,
      icon: isDay ? info.icon : info.night,
      cat:  info.cat,
    };
  }

  /* ======================================================
     WIND DIRECTION
     ====================================================== */

  function windDirLabel(deg) {
    const dirs = ['N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSW','SW','WSW','W','WNW','NW','NNW'];
    return dirs[Math.round(deg / 22.5) % 16];
  }

  /* ======================================================
     UV LABEL
     ====================================================== */

  function uvLabel(index) {
    if (index <= 2) return 'Low';
    if (index <= 5) return 'Moderate';
    if (index <= 7) return 'High';
    if (index <= 10) return 'Very High';
    return 'Extreme';
  }

  /* ======================================================
     TEMPERATURE CONVERSION
     ====================================================== */

  function toF(c) { return Math.round(c * 9 / 5 + 32); }
  function displayTemp(c) {
    return state.unit === 'fahrenheit' ? toF(c) : Math.round(c);
  }
  function unitSymbol() { return state.unit === 'fahrenheit' ? '°F' : '°C'; }

  /* ======================================================
     DATE/TIME FORMATTING
     ====================================================== */

  function formatDate(dateStr) {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  }

  function formatTime(timeStr) {
    const d = new Date(timeStr);
    return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  }

  function formatHour(timeStr) {
    const d = new Date(timeStr);
    return d.toLocaleTimeString('en-US', { hour: 'numeric', hour12: true });
  }

  function getDayName(dateStr, short = false) {
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('en-US', { weekday: short ? 'short' : 'long' });
  }

  function isToday(dateStr) {
    const today = new Date().toISOString().slice(0, 10);
    return dateStr === today;
  }

  /* ======================================================
     GEOCODING (CITY SEARCH)
     ====================================================== */

  let searchDebounce = null;

  dom.searchInput.addEventListener('input', () => {
    clearTimeout(searchDebounce);
    const q = dom.searchInput.value.trim();
    if (q.length < 2) {
      dom.searchResults.classList.remove('visible');
      return;
    }
    searchDebounce = setTimeout(() => searchCities(q), 300);
  });

  dom.searchInput.addEventListener('keydown', (e) => {
    const items = dom.searchResults.querySelectorAll('li');
    const activeItem = dom.searchResults.querySelector('li.active');
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!activeItem) {
        items[0]?.classList.add('active');
      } else {
        activeItem.classList.remove('active');
        activeItem.nextElementSibling?.classList.add('active');
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (activeItem) {
        activeItem.classList.remove('active');
        activeItem.previousElementSibling?.classList.add('active');
      }
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const active = dom.searchResults.querySelector('li.active') || items[0];
      active?.click();
    } else if (e.key === 'Escape') {
      dom.searchResults.classList.remove('visible');
      dom.searchInput.blur();
    }
  });

  // Close dropdown when clicking outside
  document.addEventListener('click', (e) => {
    if (!e.target.closest('#search-container')) {
      dom.searchResults.classList.remove('visible');
    }
  });

  async function searchCities(query) {
    try {
      const res = await fetch(`${GEO_API}?name=${encodeURIComponent(query)}&count=6&language=en`);
      const data = await res.json();
      const results = data.results || [];
      dom.searchResults.innerHTML = '';
      if (results.length === 0) {
        dom.searchResults.innerHTML = '<li>No results found</li>';
        dom.searchResults.classList.add('visible');
        return;
      }
      results.forEach(r => {
        const li = document.createElement('li');
        li.innerHTML = `${r.name}<span class="result-country">${[r.admin1, r.country].filter(Boolean).join(', ')}</span>`;
        li.addEventListener('click', () => {
          state.lat = r.latitude;
          state.lon = r.longitude;
          state.cityName = r.name;
          state.country = r.country || '';
          dom.searchInput.value = r.name;
          dom.searchResults.classList.remove('visible');
          fetchWeather();
        });
        dom.searchResults.appendChild(li);
      });
      dom.searchResults.classList.add('visible');
    } catch (err) {
      console.error('Geocoding error:', err);
    }
  }

  /* ======================================================
     GEOLOCATION
     ====================================================== */

  dom.locationBtn.addEventListener('click', () => {
    if (!navigator.geolocation) {
      showError('Geolocation is not supported by your browser.');
      return;
    }
    showLoading();
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        state.lat = pos.coords.latitude;
        state.lon = pos.coords.longitude;
        // Reverse geocode to get city name
        try {
          const res = await fetch(`${GEO_API}?name=&latitude=${state.lat}&longitude=${state.lon}&count=1`);
          const data = await res.json();
          // Fallback: use coordinates
          state.cityName = 'My Location';
          state.country = '';
          // Try reverse lookup
          await reverseGeocode(state.lat, state.lon);
        } catch(e) { /* ignore */ }
        fetchWeather();
      },
      (err) => {
        showError('Could not get your location. Please search for a city instead.');
      },
      { timeout: 10000 }
    );
  });

  async function reverseGeocode(lat, lon) {
    // Open-Meteo geocoding doesn't support reverse, so use a nearby search
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&zoom=10`);
      const data = await res.json();
      if (data.address) {
        state.cityName = data.address.city || data.address.town || data.address.village || data.address.county || 'My Location';
        state.country = data.address.country || '';
      }
    } catch(e) { /* fallback handled */ }
  }

  /* ======================================================
     UNIT TOGGLE
     ====================================================== */

  dom.unitC.addEventListener('click', () => {
    state.unit = 'celsius';
    dom.unitC.classList.add('active');
    dom.unitF.classList.remove('active');
    if (state.weatherData) renderWeather();
  });

  dom.unitF.addEventListener('click', () => {
    state.unit = 'fahrenheit';
    dom.unitF.classList.add('active');
    dom.unitC.classList.remove('active');
    if (state.weatherData) renderWeather();
  });

  /* ======================================================
     RETRY
     ====================================================== */

  dom.retryBtn.addEventListener('click', () => {
    if (state.lat && state.lon) {
      fetchWeather();
    } else {
      dom.errorScreen.classList.add('hidden');
      dom.loadingScreen.classList.add('hidden');
      dom.weatherContent.classList.add('hidden');
    }
  });

  /* ======================================================
     FETCH WEATHER DATA
     ====================================================== */

  async function fetchWeather() {
    showLoading();
    try {
      const params = new URLSearchParams({
        latitude: state.lat,
        longitude: state.lon,
        current: [
          'temperature_2m','relative_humidity_2m','apparent_temperature',
          'weather_code','wind_speed_10m','wind_direction_10m',
          'surface_pressure','is_day'
        ].join(','),
        hourly: [
          'temperature_2m','weather_code','precipitation_probability'
        ].join(','),
        daily: [
          'weather_code','temperature_2m_max','temperature_2m_min',
          'precipitation_probability_max','sunrise','sunset','uv_index_max'
        ].join(','),
        timezone: 'auto',
        forecast_days: 7,
      });

      const res = await fetch(`${WEATHER_API}?${params}`);
      if (!res.ok) throw new Error(`API error: ${res.status}`);
      const data = await res.json();
      state.weatherData = data;
      state.isDay = !!data.current.is_day;
      state.weatherCode = data.current.weather_code;
      renderWeather();
      showContent();
    } catch (err) {
      console.error('Weather fetch error:', err);
      showError('Could not fetch weather data. Please check your connection and try again.');
    }
  }

  /* ======================================================
     RENDER WEATHER DATA
     ====================================================== */

  function renderWeather() {
    const d = state.weatherData;
    const cur = d.current;
    const daily = d.daily;
    const hourly = d.hourly;
    const info = getWeatherInfo(cur.weather_code, state.isDay);

    // Current
    dom.cityName.textContent = state.cityName + (state.country ? `, ${state.country}` : '');
    dom.currentDate.textContent = formatDate(new Date().toISOString());
    dom.currentTemp.textContent = displayTemp(cur.temperature_2m);
    dom.currentUnit.textContent = unitSymbol();
    dom.currentDesc.textContent = info.desc;
    dom.hiTemp.textContent = `H: ${displayTemp(daily.temperature_2m_max[0])}°`;
    dom.loTemp.textContent = `L: ${displayTemp(daily.temperature_2m_min[0])}°`;
    dom.weatherIcon.textContent = info.icon;

    // Detail cards
    dom.feelsLike.textContent = `${displayTemp(cur.apparent_temperature)}°`;
    dom.humidity.textContent = `${cur.relative_humidity_2m}%`;
    dom.humidityBar.style.width = `${cur.relative_humidity_2m}%`;

    const windUnit = state.unit === 'fahrenheit' ? 'mph' : 'km/h';
    const windVal = state.unit === 'fahrenheit'
      ? Math.round(cur.wind_speed_10m * 0.621371)
      : Math.round(cur.wind_speed_10m);
    dom.windSpeed.textContent = `${windVal} ${windUnit}`;
    dom.windDir.textContent = windDirLabel(cur.wind_direction_10m);

    const uv = daily.uv_index_max[0];
    dom.uvIndex.textContent = Math.round(uv);
    dom.uvLabel.textContent = uvLabel(uv);

    // Visibility: Open-Meteo doesn't provide visibility in current; show pressure
    const vis = state.unit === 'fahrenheit' ? '—' : '—';
    dom.visibility.textContent = '10+ km'; // typical default
    dom.pressure.textContent = `${Math.round(cur.surface_pressure)} hPa`;

    // Hourly forecast (next 24h)
    renderHourly(hourly);

    // Daily forecast
    renderDaily(daily);

    // Sun info
    renderSunInfo(daily);

    // Update background effects
    updateBackground(info.cat);
  }

  function renderHourly(hourly) {
    dom.hourlyCards.innerHTML = '';
    const now = new Date();
    const currentHour = now.getHours();
    // Find index of current hour
    let startIdx = 0;
    for (let i = 0; i < hourly.time.length; i++) {
      const h = new Date(hourly.time[i]);
      if (h >= now) { startIdx = Math.max(0, i - 1); break; }
    }

    for (let i = startIdx; i < Math.min(startIdx + 25, hourly.time.length); i++) {
      const time = hourly.time[i];
      const temp = hourly.temperature_2m[i];
      const code = hourly.weather_code[i];
      const precip = hourly.precipitation_probability[i];
      const h = new Date(time);
      const isNow = i === startIdx;
      const isNight = h.getHours() >= 19 || h.getHours() < 6;
      const info = getWeatherInfo(code, !isNight);

      const card = document.createElement('div');
      card.className = `hourly-card${isNow ? ' now' : ''}`;
      card.innerHTML = `
        <span class="hourly-time">${isNow ? 'Now' : formatHour(time)}</span>
        <span class="hourly-icon">${info.icon}</span>
        <span class="hourly-temp">${displayTemp(temp)}°</span>
        ${precip > 0 ? `<span class="hourly-precip">${precip}%</span>` : ''}
      `;
      dom.hourlyCards.appendChild(card);
    }
  }

  function renderDaily(daily) {
    dom.dailyCards.innerHTML = '';
    // Find global min/max for temperature bar scaling
    const allMin = Math.min(...daily.temperature_2m_min);
    const allMax = Math.max(...daily.temperature_2m_max);
    const range = allMax - allMin || 1;

    for (let i = 0; i < daily.time.length; i++) {
      const date = daily.time[i];
      const hi = daily.temperature_2m_max[i];
      const lo = daily.temperature_2m_min[i];
      const code = daily.weather_code[i];
      const precip = daily.precipitation_probability_max[i];
      const info = getWeatherInfo(code, true);
      const today = isToday(date);

      const leftPct = ((lo - allMin) / range) * 100;
      const widthPct = ((hi - lo) / range) * 100;

      const card = document.createElement('div');
      card.className = `daily-card${today ? ' today' : ''}`;
      card.innerHTML = `
        <span class="daily-day">${today ? 'Today' : getDayName(date, true)}</span>
        <span class="daily-icon">${info.icon}</span>
        <div class="daily-temp-bar">
          <span class="daily-lo">${displayTemp(lo)}°</span>
          <div class="daily-bar-track">
            <div class="daily-bar-fill" style="left:${leftPct}%;width:${Math.max(widthPct, 8)}%"></div>
          </div>
          <span class="daily-hi">${displayTemp(hi)}°</span>
        </div>
        <span class="daily-precip">${precip > 0 ? precip + '%' : ''}</span>
      `;
      dom.dailyCards.appendChild(card);
    }
  }

  function renderSunInfo(daily) {
    const sunrise = daily.sunrise[0];
    const sunset  = daily.sunset[0];
    dom.sunriseTime.textContent = formatTime(sunrise);
    dom.sunsetTime.textContent  = formatTime(sunset);

    // Daylight duration
    const sunriseD = new Date(sunrise);
    const sunsetD  = new Date(sunset);
    const diff = sunsetD - sunriseD;
    const hours = Math.floor(diff / 3600000);
    const mins  = Math.floor((diff % 3600000) / 60000);
    dom.daylightTime.textContent = `${hours}h ${mins}m`;
  }

  /* ======================================================
     SHOW/HIDE STATES
     ====================================================== */

  function showLoading() {
    dom.loadingScreen.classList.remove('hidden');
    dom.loadingScreen.style.display = '';
    dom.errorScreen.classList.add('hidden');
    dom.weatherContent.classList.add('hidden');
  }

  function showContent() {
    dom.loadingScreen.classList.add('hidden');
    dom.errorScreen.classList.add('hidden');
    dom.weatherContent.classList.remove('hidden');
  }

  function showError(msg) {
    dom.loadingScreen.classList.add('hidden');
    dom.weatherContent.classList.add('hidden');
    dom.errorScreen.classList.remove('hidden');
    dom.errorMessage.textContent = msg;
  }

  /* ======================================================
     DYNAMIC BACKGROUND
     ====================================================== */

  // Background state (weather-driven instead of scroll-driven)
  let bgState = {
    timeProgress: 0.4,  // default to midday
    targetProgress: 0.4,
    category: 'clear',
    rainIntensity: 0,
    snowIntensity: 0,
  };

  function updateBackground(category) {
    bgState.category = category;

    // Determine time of day from actual local time (using timezone from API)
    const now = new Date();
    const hour = now.getHours() + now.getMinutes() / 60;

    // Map hour to a sky progress (0=midnight, ~0.25=sunrise, ~0.5=noon, ~0.75=sunset, 1=midnight)
    if (hour < 5)       bgState.targetProgress = 0.95 + (hour / 5) * 0.05;
    else if (hour < 7)  bgState.targetProgress = 0.08 + ((hour - 5) / 2) * 0.1;
    else if (hour < 12) bgState.targetProgress = 0.18 + ((hour - 7) / 5) * 0.27;
    else if (hour < 16) bgState.targetProgress = 0.45 + ((hour - 12) / 4) * 0.15;
    else if (hour < 19) bgState.targetProgress = 0.60 + ((hour - 16) / 3) * 0.12;
    else if (hour < 21) bgState.targetProgress = 0.72 + ((hour - 19) / 2) * 0.13;
    else                bgState.targetProgress = 0.85 + ((hour - 21) / 3) * 0.1;

    // Weather category effects
    switch (category) {
      case 'rain':
      case 'storm':
        bgState.rainIntensity = category === 'storm' ? 1.0 : 0.6;
        bgState.snowIntensity = 0;
        break;
      case 'snow':
        bgState.rainIntensity = 0;
        bgState.snowIntensity = 0.8;
        break;
      default:
        bgState.rainIntensity = 0;
        bgState.snowIntensity = 0;
    }
  }

  /* ======================================================
     BACKGROUND RENDERING ENGINE
     ====================================================== */

  // Sky gradient keyframes: [progress, topRGB, bottomRGB]
  const SKY_STOPS = [
    [0.00, [15,15,50],  [40,30,60]],
    [0.10, [50,30,80],  [180,90,80]],
    [0.18, [120,60,80], [240,150,80]],
    [0.28, [80,150,220],[160,210,245]],
    [0.45, [50,130,230],[120,190,240]],
    [0.60, [60,140,220],[140,200,240]],
    [0.72, [180,90,60], [240,160,80]],
    [0.82, [60,30,80],  [140,60,70]],
    [0.92, [15,15,50],  [25,20,55]],
    [1.00, [10,10,40],  [18,15,45]],
  ];

  const MTN_STOPS = [
    [0.00, [45,53,97],  [30,39,73],  [20,27,51]],
    [0.15, [90,60,80],  [70,45,65],  [40,28,45]],
    [0.25, [70,110,150],[50,80,120], [30,55,85]],
    [0.45, [60,100,140],[40,70,110], [25,48,78]],
    [0.72, [140,70,50], [100,50,40], [60,30,30]],
    [0.85, [50,40,70],  [35,28,55],  [22,18,40]],
    [1.00, [20,25,50],  [15,18,40],  [10,12,30]],
  ];

  function lerp(a, b, t) { return a + (b - a) * t; }
  function lerpColor(c1, c2, t) {
    return [Math.round(lerp(c1[0],c2[0],t)), Math.round(lerp(c1[1],c2[1],t)), Math.round(lerp(c1[2],c2[2],t))];
  }
  function rgb(c) { return `rgb(${c[0]},${c[1]},${c[2]})`; }

  function interpolateStops(stops, progress, valCount) {
    let i = 0;
    for (; i < stops.length - 1; i++) {
      if (progress <= stops[i + 1][0]) break;
    }
    const s0 = stops[i];
    const s1 = stops[Math.min(i + 1, stops.length - 1)];
    const range = s1[0] - s0[0] || 1;
    const t = (progress - s0[0]) / range;
    const results = [];
    for (let v = 1; v <= valCount; v++) results.push(lerpColor(s0[v], s1[v], t));
    return results;
  }

  // Particles
  const STAR_COUNT = 180;
  const RAIN_COUNT = 200;
  const SNOW_COUNT = 100;

  const stars = Array.from({ length: STAR_COUNT }, () => ({
    x: Math.random(), y: Math.random() * 0.55,
    r: Math.random() * 1.4 + 0.3,
    twinkleSpeed: Math.random() * 2 + 1,
    twinkleOffset: Math.random() * Math.PI * 2,
  }));

  const raindrops = Array.from({ length: RAIN_COUNT }, () => ({
    x: Math.random(), y: Math.random(),
    speed: Math.random() * 1.5 + 1.2,
    length: Math.random() * 12 + 6,
    opacity: Math.random() * 0.4 + 0.2,
  }));

  const snowflakes = Array.from({ length: SNOW_COUNT }, () => ({
    x: Math.random(), y: Math.random(),
    r: Math.random() * 2.5 + 0.8,
    speed: Math.random() * 0.3 + 0.1,
    drift: Math.random() * 0.4 - 0.2,
    wobbleAmp: Math.random() * 0.005 + 0.002,
    wobbleFreq: Math.random() * 2 + 1,
  }));

  function resizeCanvases() {
    const w = window.innerWidth, h = window.innerHeight;
    dom.skyCanvas.width = w;  dom.skyCanvas.height = h;
    dom.partCanvas.width = w; dom.partCanvas.height = h;
  }
  window.addEventListener('resize', resizeCanvases);
  resizeCanvases();

  // Parallax
  let mouseX = 0.5, mouseY = 0.5, smoothX = 0.5, smoothY = 0.5;
  document.addEventListener('mousemove', (e) => {
    mouseX = e.clientX / window.innerWidth;
    mouseY = e.clientY / window.innerHeight;
  });

  // Main render loop
  let lastTime = performance.now();

  function renderFrame() {
    const now = performance.now();
    const dt = Math.min((now - lastTime) / 16.67, 3);
    lastTime = now;

    // Smoothly approach target time
    bgState.timeProgress = lerp(bgState.timeProgress, bgState.targetProgress, 0.02);
    const progress = bgState.timeProgress;

    // Sky
    const [skyTop, skyBottom] = interpolateStops(SKY_STOPS, progress, 2);
    // Darken sky for rain/storm
    const darken = bgState.category === 'rain' || bgState.category === 'storm' || bgState.category === 'fog';
    const skyTopFinal = darken ? lerpColor(skyTop, [20,22,40], 0.4) : skyTop;
    const skyBotFinal = darken ? lerpColor(skyBottom, [30,32,50], 0.3) : skyBottom;
    const grad = skyCtx.createLinearGradient(0, 0, 0, dom.skyCanvas.height);
    grad.addColorStop(0, rgb(skyTopFinal));
    grad.addColorStop(1, rgb(skyBotFinal));
    skyCtx.fillStyle = grad;
    skyCtx.fillRect(0, 0, dom.skyCanvas.width, dom.skyCanvas.height);

    // Mountains
    const [mFar, mMid, mNear] = interpolateStops(MTN_STOPS, progress, 3);
    dom.mtnFar.style.fill = rgb(mFar);
    dom.mtnMid.querySelector('path:first-child').style.fill = rgb(mMid);
    dom.mtnNear.querySelector('path:first-child').style.fill = rgb(mNear);

    // Trees & ground
    const nightness = progress > 0.8 ? (progress - 0.8) / 0.2 : progress < 0.15 ? 1 - progress / 0.15 : 0;
    const tb = Math.round(lerp(18, 8, nightness));
    dom.treelineEl.style.fill = `rgb(${tb},${Math.round(tb*1.3)},${Math.round(tb*1.8)})`;
    const gb = Math.round(lerp(15, 6, nightness));
    dom.groundEl.style.background = `rgb(${gb},${Math.round(gb*1.4)},${Math.round(gb*2)})`;

    // Sun / Moon
    const sunArc = (progress - 0.08) / 0.72;
    const sunAngle = sunArc * Math.PI;
    const sunVisible = progress > 0.06 && progress < 0.82;
    const moonVisible = progress > 0.80 || progress < 0.08;

    if (sunVisible) {
      const sx = 0.5 + Math.cos(sunAngle) * 0.35;
      const sy = 0.15 + (1 - Math.sin(sunAngle)) * 0.55;
      dom.celestialEl.style.left = `${sx * 100}%`;
      dom.celestialEl.style.bottom = `${(1 - sy) * 100}%`;
      dom.sunEl.style.opacity = Math.min(1, Math.min((progress - 0.06) / 0.06, (0.82 - progress) / 0.06));
      dom.moonEl.style.opacity = 0;
      // Hide sun in heavy rain
      if (darken) dom.sunEl.style.opacity = Math.max(0, dom.sunEl.style.opacity * 0.3);
    }

    if (moonVisible) {
      let mp = progress > 0.80 ? (progress - 0.80) / 0.20 * 0.5 : 0.5 + (progress / 0.08) * 0.5;
      const ma = mp * Math.PI;
      const mx = 0.5 + Math.cos(ma) * 0.3;
      const my = 0.2 + (1 - Math.sin(ma)) * 0.5;
      dom.celestialEl.style.left = `${mx * 100}%`;
      dom.celestialEl.style.bottom = `${(1 - my) * 100}%`;
      dom.moonEl.style.opacity = Math.min(1, progress > 0.80 ? (progress - 0.80) / 0.05 : (0.08 - progress) / 0.03);
      dom.sunEl.style.opacity = 0;
    }

    // Clouds
    const sunGlow = sunVisible ? Math.sin(sunAngle) : 0;
    const cloudAlpha = lerp(0.08, 0.3, sunGlow);
    const isWarm = progress > 0.06 && progress < 0.28 || progress > 0.65 && progress < 0.82;
    const cloudCount = darken ? 1.0 : 1.0; // could scale
    dom.cloudEls.forEach(el => {
      const extraOpacity = darken ? 0.4 : 0;
      el.style.background = isWarm
        ? `rgba(255,200,140,${cloudAlpha + extraOpacity})`
        : moonVisible
          ? `rgba(180,200,230,${cloudAlpha * 0.5 + extraOpacity})`
          : `rgba(255,255,255,${cloudAlpha + extraOpacity})`;
    });

    // Fog
    const fogAlpha = darken ? 0.5 : (progress > 0.2 && progress < 0.7 ? 0.15 : 0.35);
    dom.fogEls.forEach(el => { el.style.opacity = fogAlpha; });

    // Particles
    partCtx.clearRect(0, 0, dom.partCanvas.width, dom.partCanvas.height);

    // Stars
    const starAlpha = progress > 0.82 ? Math.min(1, (progress - 0.82) / 0.1) : progress < 0.12 ? Math.max(0, 1 - progress / 0.12) : 0;
    if (starAlpha > 0.01 && !darken) {
      const w = dom.partCanvas.width, h = dom.partCanvas.height;
      for (const s of stars) {
        const tw = 0.5 + 0.5 * Math.sin(now / 1000 * s.twinkleSpeed + s.twinkleOffset);
        partCtx.beginPath();
        partCtx.arc(s.x * w, s.y * h, s.r, 0, Math.PI * 2);
        partCtx.fillStyle = `rgba(220,230,255,${starAlpha * tw})`;
        partCtx.fill();
      }
    }

    // Rain
    if (bgState.rainIntensity > 0.01) {
      const w = dom.partCanvas.width, h = dom.partCanvas.height;
      const intensity = bgState.rainIntensity;
      for (const r of raindrops) {
        r.y += r.speed * dt * 0.025;
        r.x -= 0.002 * dt; // slight wind
        if (r.y > 1.05) { r.y = -0.05; r.x = Math.random(); }
        if (r.x < -0.05) r.x = 1.05;

        partCtx.beginPath();
        partCtx.moveTo(r.x * w, r.y * h);
        partCtx.lineTo(r.x * w - 1, r.y * h + r.length);
        partCtx.strokeStyle = `rgba(180,210,240,${r.opacity * intensity})`;
        partCtx.lineWidth = 1.2;
        partCtx.stroke();
      }
    }

    // Snow
    const snowAlpha = bgState.snowIntensity > 0.01 ? bgState.snowIntensity : 0.12;
    if (snowAlpha > 0.01) {
      const w = dom.partCanvas.width, h = dom.partCanvas.height;
      const time = now / 1000;
      for (const s of snowflakes) {
        s.y += s.speed * dt * 0.015;
        s.x += (s.drift + Math.sin(time * s.wobbleFreq) * s.wobbleAmp) * dt * 0.01;
        if (s.y > 1) { s.y = -0.02; s.x = Math.random(); }
        if (s.x > 1.05) s.x = -0.05;
        if (s.x < -0.05) s.x = 1.05;
        partCtx.beginPath();
        partCtx.arc(s.x * w, s.y * h, s.r, 0, Math.PI * 2);
        partCtx.fillStyle = `rgba(230,240,255,${snowAlpha * 0.7})`;
        partCtx.fill();
      }
    }

    // Parallax
    smoothX = lerp(smoothX, mouseX, 0.05);
    smoothY = lerp(smoothY, mouseY, 0.05);
    const ox = (smoothX - 0.5) * 2, oy = (smoothY - 0.5) * 2;
    dom.mtnFar.style.transform  = `translateX(${ox * -8}px) translateY(${oy * -3}px)`;
    dom.mtnMid.style.transform  = `translateX(${ox * -15}px) translateY(${oy * -6}px)`;
    dom.mtnNear.style.transform = `translateX(${ox * -25}px) translateY(${oy * -10}px)`;
    document.getElementById('forest').style.transform = `translateX(${ox * -35}px) translateY(${oy * -12}px)`;

    requestAnimationFrame(renderFrame);
  }

  requestAnimationFrame(renderFrame);

  /* ======================================================
     INIT — default city or geolocation
     ====================================================== */

  async function init() {
    // Try geolocation first, fall back to Delhi
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          state.lat = pos.coords.latitude;
          state.lon = pos.coords.longitude;
          state.cityName = 'My Location';
          await reverseGeocode(state.lat, state.lon);
          fetchWeather();
        },
        () => {
          // Fallback to a default city
          state.lat = 28.6139;
          state.lon = 77.2090;
          state.cityName = 'New Delhi';
          state.country = 'India';
          fetchWeather();
        },
        { timeout: 5000 }
      );
    } else {
      state.lat = 28.6139;
      state.lon = 77.2090;
      state.cityName = 'New Delhi';
      state.country = 'India';
      fetchWeather();
    }
  }

  init();

})();
