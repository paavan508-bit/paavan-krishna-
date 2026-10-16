let currentSatId = '25544';
const WAQI_TOKEN = 'demo';

function switchView(viewName, activeBtn) {
    document.querySelectorAll('.view-panel').forEach(panel => panel.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));

    if (viewName === 'tracking') {
        document.getElementById('trackingView')?.classList.add('active');
    } else if (viewName === 'processing') {
        document.getElementById('processingView')?.classList.add('active');
    } else if (viewName === 'aiConsole') {
        document.getElementById('aiConsoleView')?.classList.add('active');
    }

    if (activeBtn) activeBtn.classList.add('active');
}

function toggleMenu() {
    const sidebar = document.getElementById('sidebar');
    if (sidebar) {
        sidebar.style.display = sidebar.style.display === 'none' ? 'flex' : 'none';
    }
}

function updateDashboardMetrics(no2, pm25, aqi) {
    const no2El = document.getElementById('no2Val');
    const no2Badge = document.getElementById('no2Badge');
    const aiEl = document.getElementById('aiVal');
    const aiBadge = document.getElementById('aiBadge');
    const co2El = document.getElementById('co2Val');

    if (no2El) no2El.innerText = `${no2} µg/m³`;
    if (no2Badge) {
        if (no2 > 25) {
            no2Badge.innerText = "Above WHO Guideline";
            no2Badge.className = "badge red";
        } else {
            no2Badge.innerText = "Normal Threshold";
            no2Badge.className = "badge green";
        }
    }

    const aerosolIndex = (pm25 / 35).toFixed(2);
    if (aiEl) aiEl.innerText = `${aerosolIndex} AI`;
    if (aiBadge) {
        if (aerosolIndex > 1.0) {
            aiBadge.innerText = "Elevated Activity";
            aiBadge.className = "badge yellow";
        } else {
            aiBadge.innerText = "Nominal Level";
            aiBadge.className = "badge green";
        }
    }

    if (co2El) co2El.innerText = "426.0 ppm";
}

async function switchSatellite(name, noradId, activeBtn) {
    currentSatId = noradId;
    const satNameEl = document.getElementById('satName');
    const radarLabelEl = document.getElementById('activeRadarLabel');
    if (satNameEl) satNameEl.innerText = name;
    if (radarLabelEl) radarLabelEl.innerText = `TACTICAL MAP GRID // ${name.toUpperCase()}`;
    
    document.querySelectorAll('.sub-btn').forEach(btn => btn.classList.remove('active'));
    if (activeBtn) activeBtn.classList.add('active');

    const sysStatus = document.querySelector('.system-status');
    if (sysStatus) sysStatus.innerText = "UPLINK: FETCHING TLE...";
    await fetchAndTrackSatellite();
}

async function fetchAndTrackSatellite() {
    try {
        if (typeof satellite === 'undefined') throw new Error("Offline / Satellite library not loaded");

        const response = await fetch(`https://celestrak.org/NORAD/elements/gp.php?CATNR=${currentSatId}&FORMAT=TLE`);
        const text = await response.text();
        const lines = text.trim().split('\n');

        if (lines.length < 2) throw new Error("Invalid TLE");

        const tleLine1 = lines.length === 3 ? lines[1] : lines[0];
        const tleLine2 = lines.length === 3 ? lines[2] : lines[1];

        const sysStatus = document.querySelector('.system-status');
        if (sysStatus) {
            sysStatus.innerText = "UPLINK: LIVE UPLINK ACTIVE";
            sysStatus.style.color = "var(--accent-green)";
        }

        const satrec = satellite.twoline2satrec(tleLine1, tleLine2);

        clearInterval(window.trackerInterval);
        window.trackerInterval = setInterval(() => updateOrbitPosition(satrec), 1000);
        updateOrbitPosition(satrec);

    } catch (err) {
        const sysStatus = document.querySelector('.system-status');
        if (sysStatus) {
            sysStatus.innerText = "UPLINK: SIMULATION FALLBACK (OFFLINE)";
            sysStatus.style.color = "var(--accent-yellow)";
        }
        runFallbackSimulation();
    }
}

function updateOrbitPosition(satrec) {
    if (typeof satellite === 'undefined') return runFallbackSimulation();

    const now = new Date();
    const pv = satellite.propagate(satrec, now);
    const gmst = satellite.gstime(now);

    if (pv.position) {
        const pd = satellite.eciToGeodetic(pv.position, gmst);
        const lat = satellite.degreesLat(pd.latitude);
        const lng = satellite.degreesLong(pd.longitude);
        const height = pd.height;
        const speed = Math.sqrt(pv.velocity.x**2 + pv.velocity.y**2 + pv.velocity.z**2);

        const latEl = document.getElementById('satLat');
        const lngEl = document.getElementById('satLng');
        const altEl = document.getElementById('satAlt');
        const velEl = document.getElementById('satVel');

        if (latEl) latEl.innerText = lat.toFixed(2) + "°";
        if (lngEl) lngEl.innerText = lng.toFixed(2) + "°";
        if (altEl) altEl.innerText = height.toFixed(1) + " km";
        if (velEl) velEl.innerText = speed.toFixed(2) + " km/s";

        const mapX = ((lng + 180) / 360) * 100;
        const mapY = ((90 - lat) / 180) * 100;

        const blip = document.getElementById('targetBlip');
        if (blip) {
            blip.style.left = `${mapX}%`;
            blip.style.top = `${mapY}%`;
        }
    }
}

function runFallbackSimulation() {
    let step = 0;
    clearInterval(window.trackerInterval);
    window.trackerInterval = setInterval(() => {
        step += 0.04;
        let lat = Math.sin(step) * 45;
        let lng = (step * 25) % 360 - 180;

        const latEl = document.getElementById('satLat');
        const lngEl = document.getElementById('satLng');
        const altEl = document.getElementById('satAlt');
        const velEl = document.getElementById('satVel');

        if (latEl) latEl.innerText = lat.toFixed(2) + "°";
        if (lngEl) lngEl.innerText = lng.toFixed(2) + "°";
        if (altEl) altEl.innerText = "415.4 km";
        if (velEl) velEl.innerText = "7.66 km/s";

        const mapX = ((lng + 180) / 360) * 100;
        const mapY = ((90 - lat) / 180) * 100;

        const blip = document.getElementById('targetBlip');
        if (blip) {
            blip.style.left = `${mapX}%`;
            blip.style.top = `${mapY}%`;
        }
    }, 1000);
}

function runDataProcessing() {
    const consoleLogs = document.getElementById('consoleLogs');
    const timestamp = new Date().toLocaleTimeString();
    if (!consoleLogs) return;
    
    consoleLogs.innerHTML += `<br>[${timestamp}] Executing atmospheric aerosol matrix sweep...`;
    setTimeout(() => {
        consoleLogs.innerHTML += `<br>[${timestamp}] NO2 columns verified. Carbon offset and SDG metrics validated.`;
        consoleLogs.scrollTop = consoleLogs.scrollHeight;
        updateDashboardMetrics(38.4, 45.2, 92);
    }, 800);
}

function generateLocationStats(cityName) {
    let hash = 0;
    for (let i = 0; i < cityName.length; i++) {
        hash = cityName.charCodeAt(i) + ((hash << 5) - hash);
    }
    
    const lat = (17.38 + (Math.abs(hash % 100) / 100)).toFixed(2);
    const lng = (78.48 + (Math.abs((hash >> 2) % 100) / 100)).toFixed(2);
    const aqi = 85 + (Math.abs(hash) % 45);
    const pm25 = (aqi * 0.62).toFixed(1);
    const temp = 26 + (Math.abs(hash) % 7);
    const hum = 50 + (Math.abs(hash) % 30);
    const no2 = (25 + (Math.abs(hash) % 20)).toFixed(1);

    updateDashboardMetrics(no2, pm25, aqi);

    const formattedName = cityName.charAt(0).toUpperCase() + cityName.slice(1);

    return `
        <div class="ai-card" style="border-color: var(--accent-cyan);">
            <div class="ai-card-header"><span style="color:var(--accent-cyan);">📡 REGIONAL TELEMETRY // ${formattedName.toUpperCase()}</span><span style="color:var(--accent-green);">NODE 404-OK</span></div>
            <div class="ai-stat-row" style="margin-top:8px;"><span>Target Coordinates</span><b>${lat}° N, ${lng}° E</b></div>
            <div class="ai-stat-row"><span>Air Quality Index (AQI)</span><b>${aqi} PM2.5 (${aqi <= 100 ? 'Moderate' : 'Unhealthy'})</b></div>
            <div class="ai-stat-row"><span>PM2.5 Concentration</span><b>${pm25} µg/m³</b></div>
            <div class="ai-stat-row"><span>NO2 Column Density</span><b>${no2} µg/m³</b></div>
            <div class="ai-stat-row"><span>Surface Temp / Humidity</span><b>${temp}°C / ${hum}%</b></div>
            <div class="visual-bar-container" style="margin-top:8px;"><div class="visual-bar-fill" style="width: ${Math.min(aqi, 100)}%;"></div></div>
        </div>
    `;
}

async function processAICommand() {
    const inputField = document.getElementById('aiUserInput');
    const chatLog = document.getElementById('aiChatLog');
    if (!inputField || !chatLog) return;

    const query = inputField.value.trim();
    if (!query) return;

    chatLog.innerHTML += `<div class="ai-msg user"><strong>[OPERATOR]:</strong> ${query}</div>`;
    inputField.value = '';
    chatLog.scrollTop = chatLog.scrollHeight;

    let replyHtml = "";
    const lowerQ = query.toLowerCase();

    let cityName = lowerQ.replace(/hows|how is|tell me about|status for/gi, '').trim();

    const isNumberOnly = /^\d+$/.test(cityName) \vert{}\vert{} /^\d+$/.test(lowerQ);
    const isShortOrInvalid = cityName.length < 2 || /^[a-z]$/i.test(cityName);
    const containsGibberishToken = /\d+[a-z]+\d+/i.test(lowerQ) || /[a-z]+\d+[a-z]+/i.test(lowerQ);
    const words = query.split(/\s+/);
    const isKeyboardSmash = words.some(w => (w.length > 5 && !/[aeiouy]/i.test(w)) || containsGibberishToken);

    const isSDG4 = lowerQ.includes('sdg 4') || lowerQ.includes('sdg4') || lowerQ.includes('education');
    const isSDG13 = lowerQ.includes('sdg 13') || lowerQ.includes('sdg13') || lowerQ.includes('climate');
    const isSDG6 = lowerQ.includes('sdg 6') || lowerQ.includes('sdg6') || lowerQ.includes('water');
    const isListSDG = lowerQ.includes('all sdg') || lowerQ.includes('list sdg') || lowerQ.includes('17 sdg');

    if ((isNumberOnly || isShortOrInvalid || isKeyboardSmash) && !isSDG4 && !isSDG13 && !isSDG6 && !isListSDG) {
        replyHtml = `
            <div class="ai-card" style="border-color: var(--accent-red);">
                <div class="ai-card-header"><span style="color:var(--accent-red);">⚠️ SYSTEM EXCEPTION</span><span style="color:var(--accent-red);">ERR_CODE 400</span></div>
                <div class="ai-card-desc" style="margin-top:8px;">Command string rejected. Unrecognized coordinate, satellite designation, or telemetry index. Verify parameters and retry.</div>
            </div>
        `;
        chatLog.innerHTML += `<div class="ai-msg system">${replyHtml}</div>`;
        chatLog.scrollTop = chatLog.scrollHeight;
        return;
    }

    if (isListSDG) {
        replyHtml = `
            <div class="ai-card">
                <div class="ai-card-header"><span>🌐 UN 17 SUSTAINABLE DEVELOPMENT GOALS</span><span style="color:var(--accent-green);">INDEX LOADED</span></div>
                <div style="max-height: 220px; overflow-y: auto; margin-top: 10px; padding-right: 5px;">
                    <div class="ai-stat-row"><span>SDG 1</span><b>No Poverty</b></div>
                    <div class="ai-stat-row"><span>SDG 2</span><b>Zero Hunger</b></div>
                    <div class="ai-stat-row"><span>SDG 3</span><b>Good Health & Well-Being</b></div>
                    <div class="ai-stat-row" style="color:#c5192d;"><span>SDG 4</span><b>Quality Education</b></div>
                    <div class="ai-stat-row"><span>SDG 5</span><b>Gender Equality</b></div>
                    <div class="ai-stat-row" style="color:#26bde2;"><span>SDG 6</span><b>Clean Water & Sanitation</b></div>
                    <div class="ai-stat-row"><span>SDG 7</span><b>Affordable & Clean Energy</b></div>
                    <div class="ai-stat-row"><span>SDG 8</span><b>Decent Work & Economic Growth</b></div>
                    <div class="ai-stat-row"><span>SDG 9</span><b>Industry, Innovation & Infrastructure</b></div>
                    <div class="ai-stat-row"><span>SDG 10</span><b>Reduced Inequalities</b></div>
                    <div class="ai-stat-row"><span>SDG 11</span><b>Sustainable Cities & Communities</b></div>
                    <div class="ai-stat-row"><span>SDG 12</span><b>Responsible Consumption & Production</b></div>
                    <div class="ai-stat-row" style="color:#3f7e44;"><span>SDG 13</span><b>Climate Action</b></div>
                    <div class="ai-stat-row"><span>SDG 14</span><b>Life Below Water</b></div>
                    <div class="ai-stat-row"><span>SDG 15</span><b>Life on Land</b></div>
                    <div class="ai-stat-row"><span>SDG 16</span><b>Peace, Justice & Strong Institutions</b></div>
                    <div class="ai-stat-row"><span>SDG 17</span><b>Partnerships for the Goals</b></div>
                </div>
            </div>
        `;
    } else if (isSDG4) {
        replyHtml = `
            <div class="ai-card" style="border-color: #c5192d;">
                <div class="ai-card-header"><span style="color:#c5192d;">📚 TARGET BRIEFING // SDG 4</span><span style="color:var(--accent-green);">VERIFIED</span></div>
                <div class="ai-stat-row" style="margin-top:8px;"><span>Objective</span><b>Ensure inclusive and equitable quality education</b></div>
                <div class="ai-stat-row"><span>Sensor Link</span><b>Remote Educational Infrastructure Grid</b></div>
                <div class="visual-bar-container" style="margin-top:8px;"><div class="visual-bar-fill" style="width: 82%; background-color: #c5192d;"></div></div>
            </div>
        `;
    } else if (isSDG13) {
        replyHtml = `
            <div class="ai-card" style="border-color: #3f7e44;">
                <div class="ai-card-header"><span style="color:#3f7e44;">🌍 TARGET BRIEFING // SDG 13</span><span style="color:var(--accent-green);">VERIFIED</span></div>
                <div class="ai-stat-row" style="margin-top:8px;"><span>Objective</span><b>Climate action and emission mitigation tracking</b></div>
                <div class="ai-stat-row"><span>Sensor Link</span><b>GHG Spectrometer & Polar Ice Radar</b></div>
                <div class="visual-bar-container" style="margin-top:8px;"><div class="visual-bar-fill" style="width: 90%; background-color: #3f7e44;"></div></div>
            </div>
        `;
    } else if (isSDG6) {
        replyHtml = `
            <div class="ai-card" style="border-color: #26bde2;">
                <div class="ai-card-header"><span style="color:#26bde2;">💧 TARGET BRIEFING // SDG 6</span><span style="color:var(--accent-green);">VERIFIED</span></div>
                <div class="ai-stat-row" style="margin-top:8px;"><span>Objective</span><b>Clean water and sanitation management</b></div>
                <div class="ai-stat-row"><span>Sensor Link</span><b>Reservoir Thermal & Aquifer Mapping Node</b></div>
                <div class="visual-bar-container" style="margin-top:8px;"><div class="visual-bar-fill" style="width: 75%; background-color: #26bde2;"></div></div>
            </div>
        `;
    } else if (lowerQ.includes('iss')) {
        replyHtml = `
            <div class="ai-card">
                <div class="ai-card-header"><span>🌍 SATELLITE DOWNLINK // ISS</span><span style="color:var(--accent-green);">NORAD #25544</span></div>
                <div class="ai-stat-row" style="margin-top:8px;"><span>Orbit Profile</span><b>Low Earth Orbit (~415 km)</b></div>
                <div class="ai-stat-row"><span>Telemetry Stream</span><b>Active Earth Observation Feed</b></div>
            </div>
        `;
        switchSatellite('ISS (Space Station)', '25544');
    } else if (lowerQ.includes('noaa')) {
        replyHtml = `
            <div class="ai-card">
                <div class="ai-card-header"><span>🌧️ SATELLITE DOWNLINK // NOAA 18</span><span style="color:var(--accent-green);">NORAD #28654</span></div>
                <div class="ai-stat-row" style="margin-top:8px;"><span>Mission</span><b>Meteorological & Atmospheric Sounding</b></div>
                <div class="ai-stat-row"><span>Telemetry Stream</span><b>Active Weather Radar Feed</b></div>
            </div>
        `;
        switchSatellite('NOAA 18 (Weather)', '28654');
    } else if (lowerQ.includes('hubble')) {
        replyHtml = `
            <div class="ai-card">
                <div class="ai-card-header"><span>🔭 SATELLITE DOWNLINK // HUBBLE</span><span style="color:var(--accent-green);">NORAD #20580</span></div>
                <div class="ai-stat-row" style="margin-top:8px;"><span>Mission</span><b>Deep Space Optical Astronomy</b></div>
                <div class="ai-stat-row"><span>Telemetry Stream</span><b>Active Spectroscopic Feed</b></div>
            </div>
        `;
        switchSatellite('Hubble Telescope', '20580');
    } else {
        if (!cityName) cityName = query;

        try {
            const searchRes = await fetch(`https://api.waqi.info/search/?keyword=${encodeURIComponent(cityName)}&token=${WAQI_TOKEN}`);
            const searchData = await searchRes.json();

            if (searchData.status === 'ok' && searchData.data && searchData.data.length > 0) {
                const bestMatch = searchData.data[0];
                const feedRes = await fetch(`https://api.waqi.info/feed/@${bestMatch.uid}/?token=${WAQI_TOKEN}`);
                const data = await feedRes.json();

                if (data.status === 'ok' && data.data) {
                    const res = data.data;
                    const aqi = res.aqi;
                    const stationName = res.city.name;
                    const lat = res.city.geo[0];
                    const lng = res.city.geo[1];
                    const temp = res.iaqi.t ? res.iaqi.t.v : '27';
                    const hum = res.iaqi.h ? res.iaqi.h.v : '62';
                    const pm25 = res.iaqi.pm25 ? res.iaqi.pm25.v : (aqi * 0.6).toFixed(1);
                    const no2 = res.iaqi.no2 ? res.iaqi.no2.v : '31.2';

                    updateDashboardMetrics(no2, pm25, aqi);

                    replyHtml = `
                        <div class="ai-card" style="border-color: var(--accent-cyan);">
                            <div class="ai-card-header"><span style="color:var(--accent-cyan);">📡 LIVE FEED // ${stationName.toUpperCase()}</span><span style="color:var(--accent-green);">CONNECTED</span></div>
                            <div class="ai-stat-row" style="margin-top:8px;"><span>Coordinates</span><b>${lat}° N, ${lng}° E</b></div>
                            <div class="ai-stat-row"><span>Air Quality Index (AQI)</span><b>${aqi} (${aqi <= 50 ? 'Good' : aqi <= 100 ? 'Moderate' : 'Unhealthy'})</b></div>
                            <div class="ai-stat-row"><span>PM2.5 Concentration</span><b>${pm25} µg/m³</b></div>
                            <div class="ai-stat-row"><span>Temperature / Humidity</span><b>${temp}°C / ${hum}%</b></div>
                            <div class="visual-bar-container" style="margin-top:8px;"><div class="visual-bar-fill" style="width: ${Math.min(aqi, 100)}%;"></div></div>
                        </div>
                    `;
                } else {
                    replyHtml = generateLocationStats(cityName);
                }
            } else {
                replyHtml = generateLocationStats(cityName);
            }
        } catch (e) {
            replyHtml = generateLocationStats(cityName);
        }
    }

    chatLog.innerHTML += `<div class="ai-msg system">${replyHtml}</div>`;
    chatLog.scrollTop = chatLog.scrollHeight;
}

document.addEventListener('DOMContentLoaded', () => {
    fetchAndTrackSatellite();

    document.getElementById('menuToggleBtn')?.addEventListener('click', toggleMenu);

    const aiInput = document.getElementById('aiUserInput');
    aiInput?.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') processAICommand();
    });

    // Theme Selector Logic
    const themeSelector = document.getElementById('themeSelector');
    if (themeSelector) {
        const savedTheme = localStorage.getItem('orbitcom_theme') || 'cyan';
        document.documentElement.setAttribute('data-theme', savedTheme);
        themeSelector.value = savedTheme;

        themeSelector.addEventListener('change', (e) => {
            const selectedTheme = e.target.value;
            document.documentElement.setAttribute('data-theme', selectedTheme);
            localStorage.setItem('orbitcom_theme', selectedTheme);
        });
    }
});