// Quiz functionality

// Haversine formula to calculate distance between two GPS coordinates in meters
function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371e3; // Earth's radius in meters
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;

    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c; // Distance in meters
}

function solveQuiz() {
    const button = document.querySelector('#unsolved-state button');
    const errorDiv = document.getElementById('quiz-error');
    const article = document.getElementById('quiz-article');
    
    // Get GPS coordinates from data attributes
    const targetLat = parseFloat(article.dataset.lat);
    const targetLon = parseFloat(article.dataset.lon);
    const uncertainty = parseFloat(article.dataset.uncertainty);
    
    // Clear previous error
    errorDiv.textContent = '';
    errorDiv.style.display = 'none';
    
    // Show loading state
    const originalText = button.textContent;
    button.disabled = true;
    button.innerHTML = '<svg class="animate-spin inline-block h-5 w-5 mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>' + originalText;
    
    // Get user's GPS location
    if (!navigator.geolocation) {
        errorDiv.textContent = errorDiv.dataset.errorNoGps || 'GPS not supported';
        errorDiv.style.display = 'block';
        button.disabled = false;
        button.textContent = originalText;
        return;
    }
    
    navigator.geolocation.getCurrentPosition(
        (position) => {
            const userLat = position.coords.latitude;
            const userLon = position.coords.longitude;
            
            // Calculate distance
            const distance = calculateDistance(targetLat, targetLon, userLat, userLon);
            
            // Reset button
            button.disabled = false;
            button.textContent = originalText;
            
            // Check if within uncertainty
            if (distance <= uncertainty) {
                // Success! Switch to solved state
                // Persist solved state and update UI with success metadata
                const id = normalizePath(window.location.pathname);
                const successMeta = {
                    lat: userLat,
                    lon: userLon,
                    distance: Math.round(distance),
                    datetime: new Date().toISOString(),
                    lang: (document.documentElement && document.documentElement.lang) ? document.documentElement.lang : navigator.language || null
                };
                markSolvedById(id, successMeta);
                applySolvedState(article, true);
            } else {
                // Too far away
                // Increment attempts count for this article
                const id = normalizePath(window.location.pathname);
                incrementAttemptOnTooFar(id);

                const distanceText = errorDiv.dataset.errorTooFar || 'You are {distance} meters away from the location.';
                errorDiv.textContent = distanceText.replace('{distance}', Math.round(distance));
                errorDiv.style.display = 'block';
            }
        },
        (error) => {
            // Reset button
            button.disabled = false;
            button.textContent = originalText;
            
            // Handle different error types
            let errorMessage = errorDiv.dataset.errorGeneric || 'Could not get your location';
            
            switch(error.code) {
                case error.PERMISSION_DENIED:
                    errorMessage = errorDiv.dataset.errorDenied || 'Location access was denied. Please enable location services.';
                    break;
                case error.POSITION_UNAVAILABLE:
                    errorMessage = errorDiv.dataset.errorUnavailable || 'Location information is unavailable.';
                    break;
                case error.TIMEOUT:
                    errorMessage = errorDiv.dataset.errorTimeout || 'Location request timed out.';
                    break;
            }
            
            errorDiv.textContent = errorMessage;
            errorDiv.style.display = 'block';
        },
        {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 0
        }
    );
}

/* --- Persistent solved-state helpers using localStorage --- */
const QUIZ_STORAGE_KEY = 'quiz.solved.v1';

function normalizePath(pathname) {
    try {
        // Prefer the '/quiz/...' suffix if present so language prefixes are ignored
        const idx = pathname.indexOf('/quiz/');
        let p = pathname;
        if (idx !== -1) {
            p = pathname.slice(idx);
        } else {
            // Fallback: strip leading language segment if it's a two-letter code (en,de,it)
            const m = pathname.match(/^\/(en|de|it)(\/.*)/);
            if (m) p = m[2];
        }
        // Remove trailing slash
        if (p.endsWith('/')) p = p.slice(0, -1);
        return p || '/';
    } catch (e) {
        return pathname;
    }
}
function loadState() {
    try {
        const raw = localStorage.getItem(QUIZ_STORAGE_KEY);
        if (!raw) return {};
        const data = JSON.parse(raw);
        // Backwards compatibility: previous format was an array of ids
        if (Array.isArray(data)) {
            const obj = {};
            data.forEach(id => {
                obj[id] = { solved: true, attempts: 0, success: null };
            });
            return obj;
        }
        if (data && typeof data === 'object') return data;
    } catch (e) {
        // ignore parse errors
    }
    return {};
}

function saveState(obj) {
    try {
        localStorage.setItem(QUIZ_STORAGE_KEY, JSON.stringify(obj));
    } catch (e) {
        // storage may fail on private mode; ignore
    }
}

function isSolvedId(id) {
    const state = loadState();
    return !!(state[id] && state[id].solved);
}

function markSolvedById(id, successMeta) {
    if (!id) return;
    const state = loadState();
    const entry = state[id] || { solved: false, attempts: 0, success: null };
    entry.solved = true;
    if (successMeta) entry.success = successMeta;
    state[id] = entry;
    saveState(state);
}

function incrementAttemptOnTooFar(id) {
    if (!id) return;
    const state = loadState();
    const entry = state[id] || { solved: false, attempts: 0, success: null };
    entry.attempts = (entry.attempts || 0) + 1;
    state[id] = entry;
    saveState(state);
}

function resetAllSolved() {
    try { localStorage.removeItem(QUIZ_STORAGE_KEY); } catch (e) {}
    // Update UI immediately where possible
    const article = document.getElementById('quiz-article');
    if (article) applySolvedState(article, false);
    document.querySelectorAll('.quiz-image-item.solved').forEach(el => el.classList.remove('solved'));
}

// Expose reset function to global scope for button onclicks
window.resetAllQuizProgress = resetAllSolved;

function applySolvedState(articleEl, solved) {
    const unsolved = document.getElementById('unsolved-state');
    const solvedDiv = document.getElementById('solved-state');
    if (solved) {
        articleEl.classList.add('solved');
        if (unsolved) unsolved.style.display = 'none';
        if (solvedDiv) solvedDiv.style.display = 'block';
    } else {
        articleEl.classList.remove('solved');
        if (unsolved) unsolved.style.display = 'block';
        if (solvedDiv) solvedDiv.style.display = 'none';
    }
}

function initQuizSingle() {
    const article = document.getElementById('quiz-article');
    if (!article) return;
    const id = normalizePath(window.location.pathname);
    if (isSolvedId(id)) {
        applySolvedState(article, true);
        // populate solved datetime if available
        const state = getStateForId(id);
        if (state && state.success && state.success.datetime) {
            const el = document.getElementById('quiz-solved-datetime');
            if (el) {
                try {
                    const d = new Date(state.success.datetime);
                    el.textContent = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(d);
                } catch (e) {
                    el.textContent = state.success.datetime;
                }
            }
        }
    } else {
        applySolvedState(article, false);
    }
}

function initQuizList() {
    // Mark solved items in the list (if any)
    const solvedArr = loadSolvedArray();
    if (!solvedArr.length) return;
    document.querySelectorAll('.quiz-image-item').forEach(el => {
        try {
            const href = el.getAttribute('href') || '';
            const url = new URL(href, window.location.origin);
            const id = normalizePath(url.pathname);
            const state = getStateForId(id);
            if (state && state.solved) {
                el.classList.add('solved');
            }
            // populate attempts badge
            const badge = el.querySelector('.quiz-badge-count');
            if (badge) {
                const attempts = (state && state.attempts) ? state.attempts : 0;
                badge.textContent = attempts;
                // hide zero counts
                if (attempts > 0) badge.parentElement.style.display = 'flex'; else badge.parentElement.style.display = 'none';
            }
        } catch (e) {
            // ignore
        }
    });
}

function getStateForId(id) {
    if (!id) return null;
    const state = loadState();
    return state[id] || null;
}

window.getQuizState = getStateForId;

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', function() {
    initQuizSingle();
    initQuizList();
    // Attach reset button if present
    const resetBtn = document.getElementById('quiz-reset-button');
    if (resetBtn) {
        resetBtn.addEventListener('click', function() {
            // Clear stored progress and update UI
            resetAllSolved();
        });
    }
});
