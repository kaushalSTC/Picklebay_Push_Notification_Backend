(function () {
    'use strict';

    window.addEventListener('load', () => {
        if (typeof window.axios === 'undefined') {
            const script = document.createElement('script');
            script.src = 'https://cdn.jsdelivr.net/npm/axios/dist/axios.min.js';
            script.onload = () => {
                checkHealth();
            };
            document.head.appendChild(script);
        } else {
            checkHealth();
        }
    });

    async function checkHealth() {
        try {
            const response = await window.axios.get('https://picklebay-push-notification-backend.onrender.com/health', {
                headers: { 'ngrok-skip-browser-warning': 'true' }
            });
    
            if (response.data && response.data.status === 'ok') {
                alert('Health check successful: ' + JSON.stringify(response.data));
            } else {
                alert('Health check failed: Unexpected response. Response data: ' + JSON.stringify(response.data));
            }
        } catch (err) {
            let errorMessage = 'Unknown error occurred.';
    
            if (err.response) {
                errorMessage = 'Server responded with error: ' + JSON.stringify(err.response.data);
            } else if (err.request) {
                errorMessage = 'Network error: No response received from server.';
            } else if (err.message) {
                errorMessage = 'Error message: ' + err.message;
            }
    
            alert('Health check failed: ' + errorMessage);
        }
    }
    

})();
