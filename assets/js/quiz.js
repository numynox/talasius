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
                article.classList.add('solved');
            } else {
                // Too far away
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
