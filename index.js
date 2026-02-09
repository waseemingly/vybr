// Global error handler - displays errors on screen for debugging (especially useful on mobile devices)
(function() {
  if (typeof window !== 'undefined' && __DEV__) {
    var showError = function(title, msg) {
      var root = document.getElementById('root');
      if (root && !root.querySelector('.error-display')) {
        var errorDiv = document.createElement('div');
        errorDiv.className = 'error-display';
        errorDiv.style.cssText = 'padding:20px;font-family:system-ui,sans-serif;word-break:break-all;position:fixed;top:0;left:0;right:0;bottom:0;background:white;z-index:9999;overflow:auto;';
        errorDiv.innerHTML = '<h2 style="color:red;">' + title + '</h2>' +
          '<pre style="white-space:pre-wrap;font-size:12px;background:#f5f5f5;padding:10px;border-radius:5px;max-height:80vh;overflow:auto;">' + msg + '</pre>';
        root.appendChild(errorDiv);
      }
    };
    
    window.onerror = function(msg, url, line, col, error) {
      showError('JavaScript Error', msg + '\n\nFile: ' + url + '\nLine: ' + line + ':' + col + '\n\n' + (error && error.stack ? error.stack : ''));
      return false;
    };
    
    window.addEventListener('unhandledrejection', function(e) {
      var reason = e.reason;
      showError('Unhandled Promise Rejection', (reason && reason.message ? reason.message : String(reason)) + '\n\n' + (reason && reason.stack ? reason.stack : ''));
    });
  }
})();

import { registerRootComponent } from 'expo';
import App from './App';

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures the app works in Expo Go, development builds, and production APKs.
registerRootComponent(App);
