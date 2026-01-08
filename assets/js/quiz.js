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
    button.disabled = true;
    
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
                // include the canonical solution coordinates in the stored metadata
                try {
                    successMeta.solution = { lat: targetLat, lon: targetLon };
                } catch (e) {
                    // ignore
                }
                markSolvedById(id, successMeta);
                applySolvedState(article, true);
                // Populate solved datetime in single view
                const dateEl = document.getElementById('quiz-solved-datetime');
                if (dateEl && successMeta.datetime) {
                    try {
                        const d = new Date(successMeta.datetime);
                        dateEl.textContent = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(d);
                    } catch (e) {
                        dateEl.textContent = successMeta.datetime;
                    }
                }
                // Populate attempts in single view: stored attempts (markSolvedById already increments)
                const attemptsSpan = document.getElementById('quiz-solved-attempts');
                if (attemptsSpan) {
                    const prevState = getStateForId(id) || {};
                    const storedAttempts = (prevState && prevState.attempts) ? prevState.attempts : 0;
                    const attempts = storedAttempts;
                    const oneFmt = attemptsSpan.dataset.attemptOne || '%d attempt';
                    const manyFmt = attemptsSpan.dataset.attemptsMany || '%d attempts';
                    let text = '';
                    if (attempts === 1) text = oneFmt.replace('%d', attempts);
                    else if (attempts > 1) text = manyFmt.replace('%d', attempts);
                    attemptsSpan.textContent = text;
                    const sep = document.getElementById('quiz-solved-sep');
                    if (sep) sep.style.display = text ? '' : 'none';
                }
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
    // If this is the first time marking solved, count it as an attempt
    if (!entry.solved) {
        entry.attempts = (entry.attempts || 0) + 1;
    }
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
    try {
        // Update UI immediately where possible
        const article = document.getElementById('quiz-article');
        if (article) applySolvedState(article, false);
        // Remove solved classes and clear overlays
        document.querySelectorAll('.quiz-image-item').forEach(el => {
            el.classList.remove('solved');
            const overlay = el.querySelector('.quiz-overlay');
            if (overlay) overlay.style.opacity = '';
            const attemptsEl = el.querySelector('.quiz-overlay-attempts');
            if (attemptsEl) attemptsEl.textContent = '';
        });
        // Re-initialize list to ensure consistent state
        initQuizList();
    } catch (domErr) {
        // Log to console but don't throw
        console.error('resetAllSolved error:', domErr);
    }
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
    console.debug('initQuizSingle id=', id);
    if (isSolvedId(id)) {
        applySolvedState(article, true);
        // populate solved datetime if available
        const state = getStateForId(id);
        console.debug('initQuizSingle state=', state);
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
        // populate attempts in single view
        const attemptsSpan = document.getElementById('quiz-solved-attempts');
        if (attemptsSpan) {
            const storedAttempts = (state && state.attempts) ? state.attempts : 0;
            const attempts = storedAttempts;
            const oneFmt = attemptsSpan.dataset.attemptOne || '%d attempt';
            const manyFmt = attemptsSpan.dataset.attemptsMany || '%d attempts';
            let text = '';
            if (attempts === 1) text = oneFmt.replace('%d', attempts);
            else if (attempts > 1) text = manyFmt.replace('%d', attempts);
            attemptsSpan.textContent = text;
            const sep = document.getElementById('quiz-solved-sep');
            if (sep) sep.style.display = text ? '' : 'none';
        }
    } else {
        applySolvedState(article, false);
    }
}

function initQuizList() {
    // Mark solved items in the list (if any)
    const stateObj = loadState();
    document.querySelectorAll('.quiz-image-item').forEach(el => {
        try {
            const href = el.getAttribute('href') || '';
            const url = new URL(href, window.location.origin);
            const id = normalizePath(url.pathname);
            const state = getStateForId(id);
            if (state && state.solved) {
                el.classList.add('solved');
            }
            // populate overlay attempts text
            const overlay = el.querySelector('.quiz-overlay');
            const attemptsEl = el.querySelector('.quiz-overlay-attempts');
            if (attemptsEl) {
                const storedAttempts = (state && state.attempts) ? state.attempts : 0;
                const attempts = storedAttempts;
                const oneFmt = attemptsEl.dataset.attemptOne || '%d attempt';
                const manyFmt = attemptsEl.dataset.attemptsMany || '%d attempts';
                let text = '';
                if (attempts === 1) text = oneFmt.replace('%d', attempts);
                else if (attempts > 1) text = manyFmt.replace('%d', attempts);
                attemptsEl.textContent = text;
                // ensure overlay is visible when solved
                if (state && state.solved) {
                    if (overlay) overlay.style.opacity = '1';
                } else {
                    if (overlay) overlay.style.opacity = '';
                }
            }
        } catch (e) {
            // ignore
        }
    });
}

function getStateForId(id) {
    if (!id) return null;
    const state = loadState();
    if (state[id]) return state[id];
    // Try fuzzy match: keys that end with the id (e.g. missing language prefix) or vice versa
    const keys = Object.keys(state);
    for (let k of keys) {
        try {
            if (k === id) return state[k];
            if (k.endsWith(id)) return state[k];
            if (id.endsWith(k)) return state[k];
        } catch (e) {
            // ignore
        }
    }
    return null;
}

window.getQuizState = getStateForId;

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', function() {
    initQuizSingle();
    initQuizList();
    // Attach reset button if present
    const resetBtn = document.getElementById('quiz-reset-button');
    if (resetBtn) {
        resetBtn.addEventListener('click', function(e) {
            try {
                e.preventDefault();
                // Ask for confirmation using localized message (data-confirm)
                const confirmMsg = resetBtn.getAttribute('data-confirm') || 'Are you sure?';
                if (!window.confirm(confirmMsg)) return; // abort if cancelled
                // Clear stored progress and update UI
                resetAllSolved();
                // Refresh list UI
                initQuizList();
            } catch (err) {
                console.error('Reset button handler error:', err);
            }
        });
    }

    // Attach solve button handler to support debug (Ctrl/Cmd-click) on devices without GPS
    const solveBtn = document.getElementById('quiz-solve-button');
    if (solveBtn) {
        solveBtn.addEventListener('click', function(event) {
            // If Ctrl (Windows/Linux) or Meta (Mac) is held, treat as debug-solve
            if (event.ctrlKey || event.metaKey) {
                // Prevent normal behavior and show solved state with invalid coords
                event.preventDefault();
                const article = document.getElementById('quiz-article');
                if (!article) return;
                const id = normalizePath(window.location.pathname);
                const successMeta = {
                    lat: null,
                    lon: null,
                    distance: -1,
                    datetime: new Date().toISOString(),
                    lang: (document.documentElement && document.documentElement.lang) ? document.documentElement.lang : navigator.language || null,
                    debug: true
                };
                // include canonical solution coordinates when available
                try {
                    const solLat = parseFloat(article.dataset.lat);
                    const solLon = parseFloat(article.dataset.lon);
                    if (!isNaN(solLat) && !isNaN(solLon)) successMeta.solution = { lat: solLat, lon: solLon };
                } catch (e) {
                    // ignore
                }
                markSolvedById(id, successMeta);
                applySolvedState(article, true);
                // populate datetime
                const el = document.getElementById('quiz-solved-datetime');
                if (el) {
                    try {
                        const d = new Date(successMeta.datetime);
                        el.textContent = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(d);
                    } catch (e) {
                        el.textContent = successMeta.datetime;
                    }
                }
                // populate attempts in single view for debug-solve
                const attemptsSpanDbg = document.getElementById('quiz-solved-attempts');
                if (attemptsSpanDbg) {
                    const prevState = getStateForId(id) || {};
                    const storedAttempts = (prevState && prevState.attempts) ? prevState.attempts : 0;
                    const attempts = storedAttempts;
                    const oneFmt = attemptsSpanDbg.dataset.attemptOne || '%d attempt';
                    const manyFmt = attemptsSpanDbg.dataset.attemptsMany || '%d attempts';
                    let text = '';
                    if (attempts === 1) text = oneFmt.replace('%d', attempts);
                    else if (attempts > 1) text = manyFmt.replace('%d', attempts);
                    attemptsSpanDbg.textContent = text;
                    const sepDbg = document.getElementById('quiz-solved-sep');
                    if (sepDbg) sepDbg.style.display = text ? '' : 'none';
                }
            } else {
                // Normal click: run real solve flow which asks for GPS
                solveQuiz();
            }
        });
    }
});

/* --- Export progress as JSON --- */
function sanitizeFileName(name) {
    if (!name) return 'quiz-progress';
    // remove spaces, slashes, and special characters; keep alphanumerics, dash and underscore
    return name.replace(/[^a-zA-Z0-9-_]/g, '_').replace(/_+/g, '_');
}

function buildExportObject(teamName) {
    const state = loadState();
    return {
        exportedAt: new Date().toISOString(),
        team: teamName || null,
        version: QUIZ_STORAGE_KEY,
        state: state
    };
}

function triggerDownload(filename, content) {
    try {
        const blob = new Blob([content], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    } catch (e) {
        console.error('Download failed', e);
    }
}

function exportQuizProgress() {
    try {
        const btn = document.getElementById('quiz-export-button');
        const promptMsg = (btn && btn.getAttribute('data-prompt')) ? btn.getAttribute('data-prompt') : 'Enter team name';
        let team = window.prompt(promptMsg, '');
        if (team === null) return; // user cancelled
        team = team.trim();
        const safeName = sanitizeFileName(team || 'team');
        const exportObj = buildExportObject(team || null);
        const filename = safeName + '-' + (new Date().toISOString().slice(0,19).replace(/[:T]/g,'-')) + '.json';
        triggerDownload(filename, JSON.stringify(exportObj, null, 2));
    } catch (e) {
        console.error('exportQuizProgress error', e);
    }
}

// Wire export button
document.addEventListener('DOMContentLoaded', function() {
    const exportBtn = document.getElementById('quiz-export-button');
    if (exportBtn) {
        exportBtn.addEventListener('click', function(e) {
            e.preventDefault();
            exportQuizProgress();
        });
    }
});
