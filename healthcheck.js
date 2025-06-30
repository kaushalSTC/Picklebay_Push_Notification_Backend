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
        let response;
        try {
            response = await window.axios.get('https://picklebay-push-notificati-git-ad03d2-kaushals-projects-4063075f.vercel.app/health');
            if (response.data && response.data.status === 'ok') {
                alert('Health check successful: ' + JSON.stringify(response.data));
            } else {
                alert('Health check failed: Unexpected response. Response data: ' + JSON.stringify(response.data));
            }
        } catch (err) {
            let respString = '';
            if (err.response) {
                respString = JSON.stringify(err.response.data);
            } else if (response) {
                respString = JSON.stringify(response);
            } else {
                respString = err.message;
            }
            alert('Health check failed: ' + respString);
        }
    }

})();
