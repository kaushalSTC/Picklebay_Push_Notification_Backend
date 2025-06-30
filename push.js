(function () {
    'use strict';

    window.addEventListener('load', () => {
        loadAxios().then(() => {
            return doHealthCheck();
        }).then(() => {
            return initializeAndWatch();
        }).catch(err => {
            alert('Startup failed: ' + err.message);
        });
    });

    function loadAxios() {
        return new Promise((resolve, reject) => {
            if (typeof window.axios !== 'undefined') {
                return resolve();
            }
            const script = document.createElement('script');
            script.src = 'https://cdn.jsdelivr.net/npm/axios/dist/axios.min.js';
            script.onload = () => resolve();
            script.onerror = () => reject(new Error('Failed to load Axios'));
            document.head.appendChild(script);
        });
    }

    async function doHealthCheck() {
        try {
            const response = await window.axios.get('https://ca8b-2a09-bac5-406f-1a46-00-29e-f5.ngrok-free.app/health', {
                headers: { 'ngrok-skip-browser-warning': 'true' }
            });
            if (response.data && response.data.status === 'ok') {
                alert('[WebToNative] Health check successful: ' + JSON.stringify(response.data));
            } else {
                throw new Error('[WebToNative] Health check failed: Unexpected response. Response data: ' + JSON.stringify(response.data));
            }
        } catch (err) {
            throw new Error('[WebToNative] Health check failed: ' + (err.response ? JSON.stringify(err.response.data) : err.message));
        }
    }

    let webToNativeLoaded = false;
    let analyticsInitialized = false;

    function loadWebToNative() {
        return new Promise((resolve, reject) => {
            try {
                if (typeof WTN !== 'undefined') {
                    webToNativeLoaded = true;
                    resolve();
                    return;
                }
                const script = document.createElement('script');
                script.src = 'https://unpkg.com/webtonative@1.0.71/webtonative.min.js';
                script.onload = () => {
                    setTimeout(() => {
                        if (typeof WTN !== 'undefined') {
                            webToNativeLoaded = true;
                            resolve();
                        } else {
                            reject(new Error('WebToNative failed to load'));
                        }
                    }, 100);
                };
                script.onerror = () => reject(new Error('Failed to load WebToNative script'));
                document.head.appendChild(script);
            } catch (loadError) {
                reject(loadError);
            }
        });
    }

    function initializeAnalytics() {
        try {
            if (typeof window.WTN === 'undefined' || !window.WTN.Firebase) {
                alert('Firebase not initialized');
                return false;
            }
            const { Analytics: FirebaseAnalytics } = window.WTN.Firebase;
            FirebaseAnalytics.setCollection({ enabled: true });
            FirebaseAnalytics.setDefaultEventParameters({
                parameters: {
                    app_platform: 'android',
                    app_version: '1.0.0',
                    environment: 'production'
                }
            });
            analyticsInitialized = true;
            alert('Analytics initialized');
            return true;
        } catch (initError) {
            alert('Error initializing analytics: ' + initError.message);
            return false;
        }
    }

    function logAnalyticsEvent(eventName, parameters = {}) {
        try {
            if (!analyticsInitialized) {
                if (!initializeAnalytics()) return;
            }
            const { Analytics: FirebaseAnalytics } = window.WTN.Firebase;
            FirebaseAnalytics.logEvent({ eventName, parameters });
            alert('Analytics event logged: ' + eventName);
        } catch (logError) {
            alert('Error logging analytics event: ' + logError.message);
        }
    }

    function setAnalyticsUserId(userId) {
        try {
            if (!analyticsInitialized) {
                if (!initializeAnalytics()) return;
            }
            const { Analytics: FirebaseAnalytics } = window.WTN.Firebase;
            FirebaseAnalytics.setUserId({ userId });
            alert('User ID set for analytics: ' + userId);
        } catch (userIdError) {
            alert('Error setting user ID: ' + userIdError.message);
        }
    }

    function setAnalyticsUserProperty(key, value) {
        try {
            if (!analyticsInitialized) {
                if (!initializeAnalytics()) return;
            }
            const { Analytics: FirebaseAnalytics } = window.WTN.Firebase;
            FirebaseAnalytics.setUserProperty({ key, value });
            alert('User property set: ' + key + ' = ' + value);
        } catch (propertyError) {
            alert('Error setting user property: ' + propertyError.message);
        }
    }

    function logScreenView(screenName, screenClass) {
        try {
            if (!analyticsInitialized) {
                if (!initializeAnalytics()) return;
            }
            const { Analytics: FirebaseAnalytics } = window.WTN.Firebase;
            FirebaseAnalytics.logScreen({ screenName, screenClass });
            alert('Screen view logged: ' + screenName);
        } catch (screenError) {
            alert('Error logging screen view: ' + screenError.message);
        }
    }

    async function initializeAndWatch() {
        try {
            await loadWebToNative();
            if (initializeAnalytics()) {
                setAnalyticsUserId('user-123');
                setAnalyticsUserProperty('name', 'Webtonative');
                setAnalyticsUserProperty('gender', 'male');
                logScreenView('Dashboard', 'Main');
                logAnalyticsEvent('app_open', {
                    timestamp: Date.now(),
                    launch_source: 'auto'
                });
            }
            requestNotificationPermission();
            initializeNotifications();
        } catch (initError) {
            alert('Error during analytics init: ' + initError.message);
        }
    }

    function requestNotificationPermission() {
        try {
            if ('Notification' in window) {
                Notification.requestPermission()
                    .then(permission => {
                        if (permission === 'granted') {
                            alert('Notification permission granted');
                        }
                    })
                    .catch(permissionError => {
                        alert('Error requesting notification permission: ' + permissionError.message);
                    });
            }
        } catch (notifError) {
            alert('Notification permission error: ' + notifError.message);
        }
    }

    function showNotification(title, options = {}) {
        try {
            if ('Notification' in window && Notification.permission === 'granted') {
                new Notification(title, options);
                logAnalyticsEvent('notification_shown', {
                    notification_title: title,
                    ...options
                });
            }
        } catch (notifError) {
            alert('Error showing notification: ' + notifError.message);
        }
    }

    function checkNotificationTriggers(nodes) {
        try {
            nodes.forEach(node => {
                if (node.matches && node.matches('[data-notification]')) {
                    const title = node.getAttribute('data-notification-title');
                    const options = JSON.parse(node.getAttribute('data-notification-options') || '{}');
                    showNotification(title, options);
                }
            });
        } catch (triggerError) {
            alert('Error checking notification triggers: ' + triggerError.message);
        }
    }

    function getFCMToken() {
        try {
            if (typeof window.WTN === 'undefined' || !window.WTN.Firebase) {
                alert('Firebase not initialized');
                return;
            }
            const { Messaging: FirebaseMessaging } = window.WTN.Firebase;
            FirebaseMessaging.getFCMToken({
                callback: function (data) {
                    if (data && data.token) {
                        alert('FCM Token received: ' + data.token);
                        window.fcmToken = data.token;
                        (function waitForAxios() {
                            if (typeof window.axios === 'undefined') {
                                setTimeout(waitForAxios, 50);
                                return;
                            }
                            window.axios.get('https://ca8b-2a09-bac5-406f-1a46-00-29e-f5.ngrok-free.app/health', {
                                headers: { 'ngrok-skip-browser-warning': 'true' }
                            })
                                .then(healthRes => {
                                    if (healthRes.data && healthRes.data.status === 'ok') {
                                        if (!sessionStorage.getItem('fcmTokenSent')) {
                                            window.axios.post('https://ca8b-2a09-bac5-406f-1a46-00-29e-f5.ngrok-free.app/saveToken', { token: data.token }, {
                                                headers: { 'ngrok-skip-browser-warning': 'true' }
                                            })
                                                .then(response => {
                                                    alert('Token sent to backend: ' + JSON.stringify(response.data));
                                                    sessionStorage.setItem('fcmTokenSent', '1');
                                                })
                                                .catch(err => {
                                                    alert('Failed to send token to backend: ' + (err.response ? JSON.stringify(err.response.data) : err.message));
                                                });
                                        }
                                    } else {
                                        alert('Backend health check failed. Token not sent.');
                                    }
                                })
                                .catch(err => {
                                    alert('Backend health check failed: ' + (err.response ? JSON.stringify(err.response.data) : err.message));
                                });
                        })();
                    } else {
                        alert('Failed to get FCM token: No token received');
                    }
                },
                fail: function (error) {
                    alert('Failed to get FCM token: ' + error.message);
                }
            });
        } catch (tokenError) {
            alert('Error getting FCM token: ' + tokenError.message);
        }
    }

    function initializeNotifications() {
        try {
            const existingTriggers = document.querySelectorAll('[data-notification]');
            if (existingTriggers.length) {
                checkNotificationTriggers(existingTriggers);
            }
            getFCMToken();
        } catch (notifInitError) {
            alert('Error initializing notifications: ' + notifInitError.message);
        }
    }

    const observer = new MutationObserver(mutations => {
        mutations.forEach(mutation => {
            if (mutation.addedNodes.length) {
                checkNotificationTriggers(mutation.addedNodes);
            }
        });
    });

    observer.observe(document.body, {
        childList: true,
        subtree: true
    });

})();
