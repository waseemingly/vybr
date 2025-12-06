/**
 * Vybr Apple Music Module - Web Implementation
 * 
 * This module provides a unified API for Apple Music integration on Web
 * using MusicKit JS for authentication and data fetching.
 * 
 * Features:
 * - User authorization via MusicKit JS
 * - Fetch recently played tracks
 * - Fetch heavy rotation items
 * - Fetch song catalog data (for genres)
 * - Compute top songs, artists, genres for the past month
 */

// ========================================
// = OLD IMPLEMENTATION (COMMENTED OUT)
// ========================================
/*
// Modules are not compatible with 'react-native-web' by default,
// so we need to implement the web layer manually.
import { Platform } from 'react-native';

let _developerToken: string | null = null;
let _userToken: string | null = null;
let _musicKitInstance: any = null;

declare global {
  interface Window {
    MusicKit?: any;
  }
}

const APPLE_MUSIC_API_URL = 'https://api.music.apple.com/v1';

// Setup polyfills for MusicKit's CommonJS dependencies
const setupPolyfills = () => {
  if (typeof window === 'undefined') return;
  
  console.log('[AppleMusic] Setting up polyfills for MusicKit...');
  
  // Add module polyfill
  if (!(window as any).module) {
    (window as any).module = { exports: {} };
  }
  
  if (!(window as any).exports) {
    (window as any).exports = (window as any).module.exports;
  }
  
  if (!(window as any).global) {
    (window as any).global = window;
  }
  
  // Add process polyfill with proper structure
  if (!(window as any).process) {
    (window as any).process = {
      env: {},
      version: '',
      versions: { node: '16.0.0' }, // Add fake node version
      platform: 'browser',
      browser: true,
      nextTick: (fn: Function) => setTimeout(fn, 0),
      cwd: () => '/',
      chdir: () => {},
      umask: () => 0
    };
  }
  
  // Mock require function
  if (!(window as any).require) {
    (window as any).require = (module: string) => {
      console.log('[AppleMusic] Mock require called for:', module);
      return {};
    };
    // Add resolve method
    (window as any).require.resolve = (module: string) => module;
  }
  
  console.log('[AppleMusic] Polyfills ready');
};

// Load MusicKit dynamically with proper error handling
const loadMusicKit = async (): Promise<void> => {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  
  console.log('[AppleMusic] Checking MusicKit availability...');
  console.log('[AppleMusic] window.MusicKit exists:', !!window.MusicKit);
  console.log('[AppleMusic] window.MusicKit type:', typeof window.MusicKit);
  
  // Check if already loaded and functional
  if (window.MusicKit && typeof window.MusicKit.configure === 'function') {
    console.log('[AppleMusic] MusicKit already loaded and ready');
    return;
  }

  // Setup polyfills BEFORE loading MusicKit
  setupPolyfills();

  // Check if script already exists in DOM
  const existingScript = document.querySelector('script[src*="musickit"]');
  console.log('[AppleMusic] Existing MusicKit script found:', !!existingScript);
  
  if (existingScript) {
    // Remove broken script and reload
    console.log('[AppleMusic] Removing existing broken MusicKit script...');
    existingScript.remove();
  }

  // Load script manually with polyfills in place
  console.log('[AppleMusic] Loading MusicKit script...');
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://js-cdn.music.apple.com/musickit/v1/musickit.js';
    script.crossOrigin = 'anonymous';
    
    let loaded = false;
    let attempts = 0;
    
    // Check periodically if MusicKit is available
    const checkInterval = setInterval(() => {
      attempts++;
      
      if (window.MusicKit && typeof window.MusicKit.configure === 'function') {
        console.log('[AppleMusic] MusicKit loaded and ready');
        loaded = true;
        clearInterval(checkInterval);
        resolve();
        return;
      }
      
      if (attempts > 100) {
        console.error('[AppleMusic] MusicKit still not available after 10 seconds');
        clearInterval(checkInterval);
        reject(new Error('MusicKit failed to initialize'));
      }
    }, 100);
    
    script.onload = () => {
      console.log('[AppleMusic] MusicKit script tag loaded');
    };
    
    script.onerror = (error) => {
      console.error('[AppleMusic] Failed to load MusicKit script:', error);
      clearInterval(checkInterval);
      reject(new Error('Failed to load MusicKit script'));
    };
    
    document.head.appendChild(script);
    console.log('[AppleMusic] MusicKit script tag added to DOM');
  });
};

export async function authorize(config?: { developerToken: string }): Promise<string> {
  if (!config?.developerToken) {
    throw new Error('Developer token is required for Web authorization');
  }

  _developerToken = config.developerToken;

  try {
    console.log('[AppleMusic] Starting authorization process...');
    
    // Load MusicKit (either from HTML or dynamically)
    await loadMusicKit();
    
    console.log('[AppleMusic] MusicKit status after loading:', {
      exists: !!window.MusicKit,
      type: typeof window.MusicKit,
      hasConfigure: !!(window.MusicKit && typeof window.MusicKit.configure === 'function'),
      hasGetInstance: !!(window.MusicKit && typeof window.MusicKit.getInstance === 'function'),
      musicKitKeys: window.MusicKit ? Object.keys(window.MusicKit).slice(0, 10) : [],
      instanceExists: !!_musicKitInstance
    });

    if (!window.MusicKit) {
      throw new Error('MusicKit object not found on window after loading');
    }

    if (typeof window.MusicKit.configure !== 'function') {
      console.error('[AppleMusic] MusicKit.configure is not a function');
      console.error('[AppleMusic] Available keys:', Object.keys(window.MusicKit));
      console.error('[AppleMusic] MusicKit type:', typeof window.MusicKit);
      throw new Error('MusicKit.configure is not a function. Available methods: ' + Object.keys(window.MusicKit).join(', '));
    }

    // Configure MusicKit if not already configured
    if (!_musicKitInstance) {
      console.log('[AppleMusic] Configuring MusicKit...');
      console.log('[AppleMusic] Developer token length:', _developerToken?.length);
      
      try {
        const config = {
          developerToken: _developerToken,
          app: {
            name: 'Vybr',
            build: '1.0.0'
          }
        };
        
        console.log('[AppleMusic] Calling MusicKit.configure with config:', config);
        const configResult = await window.MusicKit.configure(config);
        console.log('[AppleMusic] Configure result:', configResult);
        
        _musicKitInstance = window.MusicKit.getInstance();
        console.log('[AppleMusic] Got instance:', {
          exists: !!_musicKitInstance,
          type: typeof _musicKitInstance,
          hasAuthorize: !!(_musicKitInstance && typeof _musicKitInstance.authorize === 'function')
        });
      } catch (configError: any) {
        console.error('[AppleMusic] Configuration error:', configError);
        console.error('[AppleMusic] Error details:', {
          message: configError.message,
          stack: configError.stack,
          name: configError.name
        });
        throw new Error('Failed to configure MusicKit: ' + configError.message);
      }
    }

    if (!_musicKitInstance) {
      throw new Error('Failed to get MusicKit instance after configuration');
    }

    if (typeof _musicKitInstance.authorize !== 'function') {
      console.error('[AppleMusic] Instance does not have authorize method');
      console.error('[AppleMusic] Instance keys:', Object.keys(_musicKitInstance));
      throw new Error('MusicKit instance does not have authorize method');
    }

    // Call authorize - this opens Apple's auth dialog
    console.log('[AppleMusic] Calling authorize on MusicKit instance...');
    const token = await _musicKitInstance.authorize();
    console.log('[AppleMusic] Authorize returned, token received:', !!token);
    
    if (!token) {
      throw new Error('No token received from Apple Music');
    }

    console.log('[AppleMusic] Authorization successful, token received');
    _userToken = token;
    return token;
  } catch (error: any) {
    console.error('[AppleMusic] Authorization error:', error);
    console.error('[AppleMusic] Error stack:', error.stack);
    throw new Error(error.message || 'Apple Music authorization failed');
  }
}

// Allow setting tokens manually if they are already cached
export function setTokens(developerToken: string, userToken: string) {
  _developerToken = developerToken;
  _userToken = userToken;
}

export async function getHeavyRotation(limit: number = 20): Promise<any> {
  if (!_developerToken || !_userToken) {
    throw new Error('Not authorized. Call authorize() or setTokens() first.');
  }

  const response = await fetch(`${APPLE_MUSIC_API_URL}/me/history/heavy-rotation?limit=${limit}`, {
    headers: {
      'Authorization': `Bearer ${_developerToken}`,
      'Music-User-Token': _userToken
    }
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch heavy rotation: ${response.statusText}`);
  }

  return await response.json();
}

export async function getRecentlyPlayed(limit: number = 20): Promise<any> {
  if (!_developerToken || !_userToken) {
    throw new Error('Not authorized. Call authorize() or setTokens() first.');
  }

  const response = await fetch(`${APPLE_MUSIC_API_URL}/me/recent/played/tracks?limit=${limit}`, {
    headers: {
      'Authorization': `Bearer ${_developerToken}`,
      'Music-User-Token': _userToken
    }
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch recently played: ${response.statusText}`);
  }

  return await response.json();
}
*/
// ========================================
// = END OF OLD IMPLEMENTATION
// ========================================

// ========================================
// = NEW UNIFIED IMPLEMENTATION
// ========================================

declare global {
  interface Window {
    MusicKit?: any;
  }
}

// --- Module State ---
let _developerToken: string | null = null;
let _userToken: string | null = null;
let _musicKitInstance: any = null;
let _userStorefront: string = 'us'; // Default storefront

// --- Constants ---
const APPLE_MUSIC_API_URL = 'https://api.music.apple.com/v1';

// --- Type Definitions ---
export interface AppleMusicArtist {
  id: string;
  name: string;
  genres: string[];
  images: { url: string; height: number; width: number }[];
  popularity: number;
  uri: string;
}

export interface AppleMusicTrack {
  id: string;
  name: string;
  uri: string;
  album: {
    id: string;
    name: string;
    images: { url: string; height: number; width: number }[];
  };
  artists: { id: string; name: string }[];
  popularity: number;
  genreNames?: string[];
}

export interface AppleMusicAlbum {
  id: string;
  name: string;
  artists: { id: string; name: string }[];
  images: { url: string; height: number; width: number }[];
  uri: string;
}

export interface AppleMusicGenre {
  name: string;
  count: number;
  score: number;
}

// --- Polyfills Setup ---
// MusicKit JS requires certain Node.js-like globals to be present
// We set these up BEFORE loading the script to prevent errors
// Using Object.defineProperty to prevent overwriting
let _polyfillsInitialized = false;

const setupPolyfills = () => {
  if (typeof window === 'undefined') return;
  if (_polyfillsInitialized) return;
  
  console.log('[AppleMusic] Setting up polyfills for MusicKit...');
  
  const win = window as any;
  
  // Create a robust versions object that can't break
  const versionsObj = {
    node: '16.0.0',
    v8: '9.0.0',
    uv: '1.0.0',
    zlib: '1.0.0',
    brotli: '1.0.0',
    ares: '1.0.0',
    modules: '93',
    nghttp2: '1.0.0',
    napi: '8',
    llhttp: '6.0.0',
    openssl: '1.0.0',
    cldr: '39.0',
    icu: '69.1',
    tz: '2021a',
    unicode: '13.0'
  };
  
  // Create a robust process object
  const processObj = {
    env: { NODE_ENV: 'production' },
    version: 'v16.0.0',
    versions: versionsObj,
    platform: 'browser',
    browser: true,
    title: 'browser',
    argv: [],
    execArgv: [],
    pid: 1,
    ppid: 0,
    arch: 'x64',
    release: { name: 'node' },
    nextTick: (fn: Function, ...args: any[]) => {
      Promise.resolve().then(() => fn(...args));
    },
    cwd: () => '/',
    chdir: () => {},
    umask: () => 0,
    hrtime: (prev?: [number, number]) => {
      const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
      const sec = Math.floor(now / 1000);
      const nano = Math.floor((now % 1000) * 1000000);
      if (prev) {
        return [sec - prev[0], nano - prev[1]];
      }
      return [sec, nano];
    },
    memoryUsage: () => ({
      rss: 0,
      heapTotal: 0,
      heapUsed: 0,
      external: 0,
      arrayBuffers: 0
    }),
    exit: () => {},
    kill: () => {},
    on: function() { return this; },
    off: function() { return this; },
    once: function() { return this; },
    emit: () => false,
    addListener: function() { return this; },
    removeListener: function() { return this; },
    removeAllListeners: function() { return this; },
    listeners: () => [],
    binding: () => ({}),
    _linkedBinding: () => ({}),
    config: {},
    dlopen: () => {},
    uptime: () => 0,
    _getActiveRequests: () => [],
    _getActiveHandles: () => [],
    reallyExit: () => {},
    _kill: () => {},
    cpuUsage: () => ({ user: 0, system: 0 }),
    resourceUsage: () => ({}),
    debugPort: 9229,
    _debugProcess: () => {},
    _debugEnd: () => {},
    _startProfilerIdleNotifier: () => {},
    _stopProfilerIdleNotifier: () => {},
    stdout: { write: console.log },
    stderr: { write: console.error },
    stdin: { read: () => null }
  };
  
  // Global object - set early
  if (!win.global) {
    try {
      Object.defineProperty(win, 'global', {
        value: window,
        writable: true,
        configurable: true
      });
    } catch (e) {
      win.global = window;
    }
  }
  
  // Process object - handle existing process that might be incomplete
  if (!win.process) {
    try {
      Object.defineProperty(win, 'process', {
        value: processObj,
        writable: true,
        configurable: true
      });
    } catch (e) {
      win.process = processObj;
    }
  } else {
    // Process exists but might be incomplete - patch it
    if (!win.process.versions) {
      try {
        win.process.versions = versionsObj;
      } catch (e) {
        // If we can't set it, try defineProperty
        try {
          Object.defineProperty(win.process, 'versions', {
            value: versionsObj,
            writable: true,
            configurable: true
          });
        } catch (e2) {
          console.warn('[AppleMusic] Could not set process.versions');
        }
      }
    } else if (!win.process.versions.node) {
      try {
        win.process.versions.node = '16.0.0';
      } catch (e) {
        // If process.versions is frozen, we need a different approach
        try {
          const newVersions = { ...win.process.versions, node: '16.0.0' };
          Object.defineProperty(win.process, 'versions', {
            value: newVersions,
            writable: true,
            configurable: true
          });
        } catch (e2) {
          console.warn('[AppleMusic] Could not set process.versions.node');
        }
      }
    }
    
    // Ensure other process properties exist
    if (typeof win.process.browser === 'undefined') {
      win.process.browser = true;
    }
    if (typeof win.process.version === 'undefined') {
      win.process.version = 'v16.0.0';
    }
  }
  
  // Module exports
  if (!win.module) {
    win.module = { exports: {}, id: '', filename: '', loaded: true, parent: null, children: [] };
  }
  
  if (!win.exports) {
    win.exports = win.module.exports;
  }
  
  // Require function mock
  if (!win.require) {
    const mockRequire: any = (moduleName: string) => {
      // Return empty module-like objects for common Node.js modules
      const mocks: Record<string, any> = {
        'path': { join: (...args: string[]) => args.join('/'), resolve: (...args: string[]) => args.join('/') },
        'fs': { readFileSync: () => '', writeFileSync: () => {}, existsSync: () => false },
        'util': { promisify: (fn: Function) => fn },
        'events': { EventEmitter: class {} },
        'buffer': { Buffer: { from: () => new Uint8Array(), isBuffer: () => false } },
        'stream': {},
        'http': {},
        'https': {},
        'url': { URL: win.URL, URLSearchParams: win.URLSearchParams },
        'crypto': { randomBytes: (n: number) => new Uint8Array(n) }
      };
      return mocks[moduleName] || {};
    };
    mockRequire.resolve = (moduleName: string) => moduleName;
    mockRequire.cache = {};
    mockRequire.main = win.module;
    win.require = mockRequire;
  }
  
  // Buffer polyfill
  if (!win.Buffer) {
    win.Buffer = {
      from: (data: any) => new Uint8Array(typeof data === 'string' ? [...data].map(c => c.charCodeAt(0)) : data),
      isBuffer: () => false,
      alloc: (size: number) => new Uint8Array(size),
      allocUnsafe: (size: number) => new Uint8Array(size),
      concat: (arr: Uint8Array[]) => {
        const totalLength = arr.reduce((acc, val) => acc + val.length, 0);
        const result = new Uint8Array(totalLength);
        let offset = 0;
        for (const item of arr) {
          result.set(item, offset);
          offset += item.length;
        }
        return result;
      }
    };
  }
  
  // __dirname and __filename
  if (!win.__dirname) {
    win.__dirname = '/';
  }
  if (!win.__filename) {
    win.__filename = '/index.js';
  }
  
  _polyfillsInitialized = true;
  console.log('[AppleMusic] Polyfills ready');
  console.log('[AppleMusic] process.versions.node:', win.process?.versions?.node);
};

// --- CRITICAL: Initialize polyfills IMMEDIATELY when module loads ---
// This MUST run before any other code executes to prevent MusicKit initialization errors
if (typeof window !== 'undefined') {
  const win = window as any;
  
  // Force create process.versions.node IMMEDIATELY
  if (!win.process) {
    Object.defineProperty(win, 'process', {
      value: {
        env: { NODE_ENV: 'production' },
        version: 'v16.0.0',
        versions: { node: '16.0.0', v8: '9.0.0' },
        platform: 'browser',
        browser: true,
        nextTick: (fn: Function) => Promise.resolve().then(() => fn())
      },
      writable: false,
      configurable: false
    });
  } else {
    // Patch existing process
    if (!win.process.versions) {
      Object.defineProperty(win.process, 'versions', {
        value: { node: '16.0.0', v8: '9.0.0' },
        writable: false,
        configurable: false
      });
    } else {
      // Force set node version
      try {
        win.process.versions.node = '16.0.0';
      } catch (e) {
        // If can't set, create new versions object
        const newVersions = { ...win.process.versions, node: '16.0.0' };
        Object.defineProperty(win.process, 'versions', {
          value: newVersions,
          writable: false,
          configurable: false
        });
      }
    }
  }
  
  // Ensure global exists
  if (!win.global) {
    win.global = window;
  }
  
  // Ensure module/exports exist
  if (!win.module) {
    win.module = { exports: {} };
  }
  if (!win.exports) {
    win.exports = win.module.exports;
  }
}

// --- MusicKit Version ---
// Using MusicKit v1 which is more stable with React Native Web
// MusicKit JS will automatically open a popup window for authorization
const MUSICKIT_SCRIPT_URL = 'https://js-cdn.music.apple.com/musickit/v1/musickit.js';

// --- Defensive Process Check ---
// Call this right before loading any external script
const ensureProcessVersions = () => {
  if (typeof window === 'undefined') return;
  
  const win = window as any;
  
  if (!win.process) {
    win.process = { versions: { node: '16.0.0' }, browser: true, env: {} };
  } else if (!win.process.versions) {
    win.process.versions = { node: '16.0.0' };
  } else if (!win.process.versions.node) {
    win.process.versions.node = '16.0.0';
  }
  
  console.log('[AppleMusic] ensureProcessVersions - process.versions.node:', win.process?.versions?.node);
};

// --- MusicKit Loading (DEPRECATED - Using popup approach instead) ---
// This function is kept for reference but not used in the current popup-based implementation
const loadMusicKit = async (): Promise<void> => {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  
  console.log('[AppleMusic] Checking MusicKit availability...');
  
  // Ensure polyfills are set up (full setup)
  setupPolyfills();
  
  // Double-check critical polyfills right before loading
  ensureProcessVersions();
  
  // Check if already loaded and functional
  if (window.MusicKit && typeof window.MusicKit.configure === 'function') {
    console.log('[AppleMusic] MusicKit already loaded and ready');
    return;
  }

  // Check if script already exists in DOM but MusicKit isn't working
  const existingScript = document.querySelector('script[src*="musickit"]');
  if (existingScript) {
    // Give existing script a chance to load
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Re-ensure polyfills after waiting
    ensureProcessVersions();
    
    if (window.MusicKit && typeof window.MusicKit.configure === 'function') {
      console.log('[AppleMusic] MusicKit loaded from existing script');
      return;
    }
    
    console.log('[AppleMusic] Removing existing non-functional MusicKit script...');
    existingScript.remove();
  }

  console.log('[AppleMusic] Loading MusicKit script from:', MUSICKIT_SCRIPT_URL);
  console.log('[AppleMusic] Pre-load check - process.versions.node:', (window as any).process?.versions?.node);
  
  return new Promise((resolve, reject) => {
    // Final polyfill check right before creating script
    ensureProcessVersions();
    
    // Create an inline script that sets up polyfills IMMEDIATELY before MusicKit loads
    const polyfillScript = document.createElement('script');
    polyfillScript.textContent = `
      (function() {
        if (typeof window === 'undefined') return;
        var win = window;
        if (!win.process) {
          win.process = { versions: { node: '16.0.0' }, browser: true, env: {} };
        } else if (!win.process.versions) {
          win.process.versions = { node: '16.0.0' };
        } else if (!win.process.versions.node) {
          win.process.versions.node = '16.0.0';
        }
        if (!win.global) win.global = win;
        if (!win.module) win.module = { exports: {} };
        if (!win.exports) win.exports = win.module.exports;
        console.log('[AppleMusic] Inline polyfill - process.versions.node:', win.process.versions.node);
      })();
    `;
    document.head.appendChild(polyfillScript);
    
    // Load MusicKit script SYNCHRONOUSLY to ensure proper initialization
    // Async loading can cause timing issues with React Native Web
    const script = document.createElement('script');
    script.src = MUSICKIT_SCRIPT_URL;
    script.crossOrigin = 'anonymous';
    script.async = false; // Load synchronously
    script.defer = false;
    script.type = 'text/javascript';
    
    let attempts = 0;
    const maxAttempts = 200; // 20 seconds (increased for slower connections)
    let checkInterval: ReturnType<typeof setInterval>;
    let scriptError: Error | null = null;
    let scriptLoaded = false;
    
    const cleanup = () => {
      if (checkInterval) {
        clearInterval(checkInterval);
      }
      window.removeEventListener('unhandledrejection', unhandledRejectionHandler);
    };
    
    // Enhanced error handler
    const originalOnError = window.onerror;
    const originalOnUnhandledRejection = window.onunhandledrejection;
    
    window.onerror = (message, source, lineno, colno, error) => {
      if (source && (source.includes('musickit') || source.includes('music.apple.com'))) {
        console.error('[AppleMusic] MusicKit execution error:', {
          message,
          source,
          lineno,
          colno,
          error: error?.toString(),
          stack: error?.stack
        });
        scriptError = new Error(`MusicKit script error: ${message}`);
      }
      if (typeof originalOnError === 'function') {
        return originalOnError(message, source, lineno, colno, error);
      }
      return false;
    };
    
    const unhandledRejectionHandler = (event: Event) => {
      const rejectionEvent = event as PromiseRejectionEvent;
      const reason = rejectionEvent.reason?.toString() || '';
      if (reason.includes('musickit') || reason.includes('MusicKit')) {
        console.error('[AppleMusic] MusicKit unhandled rejection:', rejectionEvent.reason);
        scriptError = new Error(`MusicKit unhandled rejection: ${reason}`);
      }
      if (typeof originalOnUnhandledRejection === 'function') {
        originalOnUnhandledRejection.call(window, rejectionEvent);
      }
    };
    window.addEventListener('unhandledrejection', unhandledRejectionHandler);
    
    // Check periodically if MusicKit is available
    checkInterval = setInterval(() => {
      attempts++;
      
      // Re-ensure polyfills during loading
      ensureProcessVersions();
      
      // Check for script errors
      if (scriptError) {
        cleanup();
        // Restore error handlers
        window.onerror = originalOnError;
        reject(scriptError);
        return;
      }
      
      // Check for MusicKit v1 API
      if (window.MusicKit) {
        const hasConfigure = typeof window.MusicKit.configure === 'function';
        const hasGetInstance = typeof window.MusicKit.getInstance === 'function';
        
        console.log('[AppleMusic] MusicKit detected!', {
          hasConfigure,
          hasGetInstance,
          keys: Object.keys(window.MusicKit).slice(0, 10),
          scriptLoaded
        });
        
        if (hasConfigure && hasGetInstance) {
          console.log('[AppleMusic] MusicKit loaded and ready (v1)');
          cleanup();
          // Restore error handlers
          window.onerror = originalOnError;
          resolve();
          return;
        }
      }
      
      // Debug logging every 20 attempts
      if (attempts % 20 === 0) {
        console.log(`[AppleMusic] Still waiting for MusicKit (attempt ${attempts}/${maxAttempts})...`, {
          scriptLoaded,
          windowMusicKit: !!window.MusicKit,
          processVersionsNode: (window as any).process?.versions?.node,
          allWindowKeys: Object.keys(window).filter(k => k.toLowerCase().includes('music')).slice(0, 5)
        });
      }
      
      if (attempts > maxAttempts) {
        console.error('[AppleMusic] MusicKit still not available after 20 seconds');
        console.error('[AppleMusic] Final diagnostic:', {
          scriptLoaded,
          windowMusicKit: !!window.MusicKit,
          windowKeys: Object.keys(window).slice(0, 20),
          processVersionsNode: (window as any).process?.versions?.node,
          scriptElement: script,
          scriptSrc: script.src,
          scriptParent: script.parentNode !== null
        });
        cleanup();
        // Restore error handlers
        window.onerror = originalOnError;
        reject(new Error('MusicKit failed to initialize - timeout. The script loaded but MusicKit object was not created.'));
      }
    }, 100);
    
    script.onload = () => {
      console.log('[AppleMusic] MusicKit script tag loaded successfully');
      scriptLoaded = true;
      
      // Give it a moment to execute, then check immediately
      setTimeout(() => {
        if (window.MusicKit) {
          console.log('[AppleMusic] MusicKit found immediately after load!');
        } else {
          console.log('[AppleMusic] MusicKit not found immediately after load, will continue polling...');
        }
      }, 100);
    };
    
    script.onerror = (error) => {
      console.error('[AppleMusic] Failed to load MusicKit script:', error);
      scriptError = new Error('Failed to load MusicKit script');
      cleanup();
      // Restore error handlers
      window.onerror = originalOnError;
      reject(scriptError);
    };
    
    // Listen for MusicKit ready event (if it fires)
    const musicKitReadyHandler = () => {
      console.log('[AppleMusic] MusicKit ready event fired!');
      if (window.MusicKit) {
        cleanup();
        window.onerror = originalOnError;
        document.removeEventListener('musickitloaded', musicKitReadyHandler);
        resolve();
      }
    };
    document.addEventListener('musickitloaded', musicKitReadyHandler);
    
    // Append MusicKit script right after polyfill script
    document.head.appendChild(script);
    console.log('[AppleMusic] MusicKit script tag added to DOM (synchronous load)');
    
    // Also try checking immediately after a short delay (for fast connections)
    setTimeout(() => {
      if (window.MusicKit && typeof window.MusicKit.configure === 'function') {
        console.log('[AppleMusic] MusicKit found in immediate check!');
        cleanup();
        window.onerror = originalOnError;
        document.removeEventListener('musickitloaded', musicKitReadyHandler);
        resolve();
      }
    }, 500);
  });
};

// --- Authorization (Popup-based for Web) ---
export async function authorize(config?: { developerToken: string }): Promise<string> {
  if (!config?.developerToken) {
    throw new Error('Developer token is required for Web authorization');
  }

  _developerToken = config.developerToken;

  try {
    console.log('[AppleMusic] Starting authorization process with popup window...');
    
    // Get the current origin to construct the auth page URL
    const currentOrigin = typeof window !== 'undefined' && window.location 
      ? window.location.origin 
      : 'http://localhost:8081';
    
    // Construct the authentication page URL
    const authPageUrl = `${currentOrigin}/apple-music-auth.html?developerToken=${encodeURIComponent(_developerToken)}`;
    
    console.log('[AppleMusic] Opening popup window:', authPageUrl);
    
    // Open popup window (similar to Spotify OAuth flow)
    const popup = window.open(
      authPageUrl,
      'apple-music-auth',
      'width=500,height=600,scrollbars=yes,resizable=yes,status=yes,location=yes,toolbar=no,menubar=no'
    );
    
    if (!popup) {
      throw new Error('Popup window blocked. Please allow popups for this site.');
    }
    
    // Focus the popup
    popup.focus();
    
    // Wait for message from popup
    return new Promise<string>((resolve, reject) => {
      let resolved = false;
      
      const messageHandler = (event: MessageEvent) => {
        // Verify origin for security (allow same origin and localhost variations)
        const allowedOrigins = [
          currentOrigin,
          currentOrigin.replace('https://', 'http://'),
          currentOrigin.replace('http://', 'https://'),
          window.location.origin
        ];
        
        // Also allow if it's from the same domain (for ngrok/localhost variations)
        const eventHost = new URL(event.origin).hostname;
        const currentHost = new URL(currentOrigin).hostname;
        const isSameDomain = eventHost === currentHost || 
                            eventHost.includes('localhost') && currentHost.includes('localhost') ||
                            eventHost.includes('ngrok') && currentHost.includes('ngrok');
        
        if (!allowedOrigins.includes(event.origin) && !isSameDomain) {
          console.warn('[AppleMusic] Ignoring message from different origin:', event.origin, 'expected:', currentOrigin);
          return;
        }
        
        // Handle console messages from popup (forward to main console)
        if (event.data && event.data.type === 'APPLE_MUSIC_AUTH_CONSOLE') {
          const prefix = '[AppleMusic Popup]';
          const message = event.data.message || '';
          const level = event.data.level || 'log';
          
          // Forward to main console with prefix
          switch (level) {
            case 'error':
              console.error(prefix, message);
              break;
            case 'warn':
              console.warn(prefix, message);
              break;
            case 'info':
              console.info(prefix, message);
              break;
            case 'debug':
              console.debug(prefix, message);
              break;
            default:
              console.log(prefix, message);
          }
          return; // Don't resolve/reject on console messages
        }
        
        // Only process Apple Music auth messages
        if (!event.data || !event.data.type || !event.data.type.startsWith('APPLE_MUSIC_AUTH_')) {
          return;
        }
        
        if (resolved) return;
        resolved = true;
        
        if (event.data.type === 'APPLE_MUSIC_AUTH_SUCCESS') {
          console.log('[AppleMusic] Authorization successful, token received from popup');
          
          // Keep handler for console messages, but mark as resolved
          resolved = true;
          
          if (!popup.closed) {
            popup.close();
          }
          
          const token = event.data.token;
          if (!token) {
            reject(new Error('No token received from Apple Music'));
            return;
          }
          
          _userToken = token;
          resolve(token);
        } else if (event.data.type === 'APPLE_MUSIC_AUTH_RETRY') {
          console.log('[AppleMusic] Retry requested from popup - token may be expired');
          
          // Keep handler for console messages, but mark as resolved
          resolved = true;
          
          if (!popup.closed) {
            popup.close();
          }
          
          // Reject with a special error that indicates retry is needed
          reject(new Error('TOKEN_REFRESH_NEEDED: Developer token expired or invalid. Please retry.'));
        } else if (event.data.type === 'APPLE_MUSIC_AUTH_ERROR') {
          console.error('[AppleMusic] Authorization error from popup:', event.data.error);
          
          // Log detailed error information if available
          if (event.data.errorDetails) {
            console.error('[AppleMusic] Detailed error information:', event.data.errorDetails);
            
            // Log specific error codes for debugging
            if (event.data.errorDetails.status === 403 || event.data.errorDetails.code === 403) {
              console.error('[AppleMusic] 403 Forbidden - Token signature is invalid!');
              console.error('[AppleMusic] This means the private key in Supabase does NOT match Key ID: 55272UR5Y5');
              console.error('[AppleMusic] Action: Verify APPLE_MUSIC_PRIVATE_KEY in Supabase matches the .p8 file');
            } else if (event.data.errorDetails.status === 401 || event.data.errorDetails.code === 401) {
              console.error('[AppleMusic] 401 Unauthorized - Token is invalid or expired');
            }
            
            if (event.data.errorDetails.errorCode) {
              console.error('[AppleMusic] MusicKit error code:', event.data.errorDetails.errorCode);
            }
            if (event.data.errorDetails.description) {
              console.error('[AppleMusic] MusicKit error description:', event.data.errorDetails.description);
            }
          }
          
          // Keep handler for console messages, but mark as resolved
          resolved = true;
          
          if (!popup.closed) {
            popup.close();
          }
          
          reject(new Error(event.data.error || 'Apple Music authorization failed'));
        }
      };
      
      window.addEventListener('message', messageHandler);
      
      // Check if popup was closed manually
      const checkClosed = setInterval(() => {
        if (popup.closed && !resolved) {
          clearInterval(checkClosed);
          resolved = true;
          // Keep handler for console messages, remove after delay
          setTimeout(() => {
            window.removeEventListener('message', messageHandler);
          }, 10000); // Keep for 10 seconds to catch any final console messages
          reject(new Error('Authorization window was closed'));
        }
      }, 500);
      
      // Cleanup on timeout (5 minutes)
      const timeoutId = setTimeout(() => {
        if (!resolved && !popup.closed) {
          clearInterval(checkClosed);
          resolved = true;
          popup.close();
          // Keep handler for console messages, remove after delay
          setTimeout(() => {
            window.removeEventListener('message', messageHandler);
          }, 10000); // Keep for 10 seconds to catch any final console messages
          reject(new Error('Authorization timeout'));
        }
      }, 5 * 60 * 1000);
      
      // Cleanup function - keep handler active for console messages
      const cleanup = () => {
        clearInterval(checkClosed);
        clearTimeout(timeoutId);
        // Don't remove handler immediately - keep it for console messages
        // It will be cleaned up when popup closes or after timeout
        setTimeout(() => {
          window.removeEventListener('message', messageHandler);
        }, 10000); // Keep for 10 seconds to catch any final console messages
      };
      
      // Store cleanup in case we need to cancel
      (popup as any)._cleanup = cleanup;
    });
    
  } catch (error: any) {
    console.error('[AppleMusic] Authorization error:', error);
    throw new Error(error.message || 'Apple Music authorization failed');
  }
}

// --- Token Management ---
export function setTokens(developerToken: string, userToken: string) {
  _developerToken = developerToken;
  _userToken = userToken;
}

export function getTokens(): { developerToken: string | null; userToken: string | null } {
  return { developerToken: _developerToken, userToken: _userToken };
}

export function isAuthorized(): boolean {
  return !!_developerToken && !!_userToken;
}

// --- API Helper ---
async function fetchAppleMusicAPI(endpoint: string, params?: Record<string, string>): Promise<any> {
  if (!_developerToken || !_userToken) {
    throw new Error('Not authorized. Call authorize() or setTokens() first.');
  }

  let url = `${APPLE_MUSIC_API_URL}${endpoint}`;
  
  if (params) {
    const searchParams = new URLSearchParams(params);
    url += `?${searchParams.toString()}`;
  }

  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${_developerToken}`,
      'Music-User-Token': _userToken
    }
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`[AppleMusic] API Error (${response.status}):`, errorText);
    throw new Error(`Apple Music API error: ${response.status} ${response.statusText}`);
  }

  return await response.json();
}

// --- Heavy Rotation ---
export async function getHeavyRotation(limit: number = 20): Promise<any> {
  console.log(`[AppleMusic] Fetching heavy rotation with limit: ${limit}`);
  
  const response = await fetchAppleMusicAPI('/me/history/heavy-rotation', {
    limit: String(limit)
  });
  
  console.log(`[AppleMusic] Heavy rotation response:`, response?.data?.length || 0, 'items');
  return response;
}

// --- Recently Played ---
export async function getRecentlyPlayed(limit: number = 20): Promise<any> {
  console.log(`[AppleMusic] Fetching recently played with limit: ${limit}`);
  
  const response = await fetchAppleMusicAPI('/me/recent/played/tracks', {
    limit: String(limit)
  });
  
  console.log(`[AppleMusic] Recently played response:`, response?.data?.length || 0, 'items');
  return response;
}

// --- Catalog Song Lookup (for genres) ---
export async function getCatalogSongs(songIds: string[]): Promise<any> {
  if (songIds.length === 0) return { data: [] };
  
  console.log(`[AppleMusic] Fetching catalog data for ${songIds.length} songs`);
  
  // Apple Music API allows max 300 IDs per request, batch if needed
  const batchSize = 100;
  const batches: string[][] = [];
  
  for (let i = 0; i < songIds.length; i += batchSize) {
    batches.push(songIds.slice(i, i + batchSize));
  }
  
  const allResults: any[] = [];
  
  for (const batch of batches) {
    try {
      const response = await fetchAppleMusicAPI(`/catalog/${_userStorefront}/songs`, {
        ids: batch.join(','),
        include: 'genres,artists'
      });
      
      if (response.data) {
        allResults.push(...response.data);
      }
    } catch (error) {
      console.warn('[AppleMusic] Error fetching catalog batch:', error);
    }
  }
  
  console.log(`[AppleMusic] Retrieved catalog data for ${allResults.length} songs`);
  return { data: allResults };
}

// --- Catalog Artist Lookup (for genres) ---
export async function getCatalogArtists(artistIds: string[]): Promise<any> {
  if (artistIds.length === 0) return { data: [] };
  
  console.log(`[AppleMusic] Fetching catalog data for ${artistIds.length} artists`);
  
  const batchSize = 25; // Artists endpoint has lower limits
  const batches: string[][] = [];
  
  for (let i = 0; i < artistIds.length; i += batchSize) {
    batches.push(artistIds.slice(i, i + batchSize));
  }
  
  const allResults: any[] = [];
  
  for (const batch of batches) {
    try {
      const response = await fetchAppleMusicAPI(`/catalog/${_userStorefront}/artists`, {
        ids: batch.join(','),
        include: 'genres'
      });
      
      if (response.data) {
        allResults.push(...response.data);
      }
    } catch (error) {
      console.warn('[AppleMusic] Error fetching artist batch:', error);
    }
  }
  
  console.log(`[AppleMusic] Retrieved catalog data for ${allResults.length} artists`);
  return { data: allResults };
}

// --- Parse Resources from API Response ---
export function parseTracksFromResponse(resources: any[]): AppleMusicTrack[] {
  const tracks: AppleMusicTrack[] = [];
  
  resources.forEach((resource: any) => {
    if (resource.type === 'songs' || resource.type === 'library-songs') {
      const attributes = resource.attributes || {};
      const artwork = attributes.artwork;
      
      tracks.push({
        id: resource.id,
        name: attributes.name || 'Unknown Track',
        uri: `apple-music:song:${resource.id}`,
        album: {
          id: resource.relationships?.albums?.data?.[0]?.id || '',
          name: attributes.albumName || '',
          images: artwork ? [{
            url: artwork.url?.replace('{w}', '300').replace('{h}', '300') || '',
            height: 300,
            width: 300
          }] : []
        },
        artists: attributes.artistName ? [{
          id: resource.relationships?.artists?.data?.[0]?.id || '',
          name: attributes.artistName
        }] : [],
        popularity: 0,
        genreNames: attributes.genreNames || []
      });
    }
  });
  
  return tracks;
}

export function parseArtistsFromResponse(resources: any[]): AppleMusicArtist[] {
  const artists: AppleMusicArtist[] = [];
  
  resources.forEach((resource: any) => {
    if (resource.type === 'artists' || resource.type === 'library-artists') {
      const attributes = resource.attributes || {};
      const artwork = attributes.artwork;
      
      artists.push({
        id: resource.id,
        name: attributes.name || 'Unknown Artist',
        genres: attributes.genreNames || [],
        images: artwork ? [{
          url: artwork.url?.replace('{w}', '300').replace('{h}', '300') || '',
          height: 300,
          width: 300
        }] : [],
        popularity: 0,
        uri: `apple-music:artist:${resource.id}`
      });
    }
  });
  
  return artists;
}

// --- Unified Data Fetching Function ---
export async function fetchUserMusicData(options?: { 
  includeGenres?: boolean;
  limit?: number;
}): Promise<{
  tracks: AppleMusicTrack[];
  artists: AppleMusicArtist[];
  albums: AppleMusicAlbum[];
}> {
  const { includeGenres = true, limit = 50 } = options || {};
  
  console.log('[AppleMusic] Fetching comprehensive user music data...');
  
  let allTracks: AppleMusicTrack[] = [];
  let allArtists: AppleMusicArtist[] = [];
  const albumMap = new Map<string, AppleMusicAlbum>();
  const artistMap = new Map<string, AppleMusicArtist>();
  
  // 1. Fetch Heavy Rotation (albums, playlists, artists the user plays frequently)
  try {
    const heavyRotation = await getHeavyRotation(limit);
    const resources = heavyRotation.data || [];
    
    // Heavy rotation can contain albums, playlists, and artists
    resources.forEach((resource: any) => {
      const attributes = resource.attributes || {};
      const artwork = attributes.artwork;
      
      if (resource.type === 'albums' || resource.type === 'library-albums') {
        const albumId = resource.id;
        if (!albumMap.has(albumId)) {
          albumMap.set(albumId, {
            id: albumId,
            name: attributes.name || 'Unknown Album',
            artists: attributes.artistName ? [{ id: '', name: attributes.artistName }] : [],
            images: artwork ? [{
              url: artwork.url?.replace('{w}', '300').replace('{h}', '300') || '',
              height: 300,
              width: 300
            }] : [],
            uri: `apple-music:album:${albumId}`
          });
        }
      } else if (resource.type === 'artists' || resource.type === 'library-artists') {
        const parsedArtists = parseArtistsFromResponse([resource]);
        parsedArtists.forEach(artist => {
          if (!artistMap.has(artist.id)) {
            artistMap.set(artist.id, artist);
          }
        });
      }
    });
    
    console.log(`[AppleMusic] Heavy rotation: ${resources.length} items`);
  } catch (error) {
    console.warn('[AppleMusic] Heavy rotation fetch failed:', error);
  }
  
  // 2. Fetch Recently Played Tracks
  try {
    const recentlyPlayed = await getRecentlyPlayed(limit);
    const resources = recentlyPlayed.data || [];
    
    const parsedTracks = parseTracksFromResponse(resources);
    allTracks.push(...parsedTracks);
    
    // Extract artists from tracks
    parsedTracks.forEach(track => {
      track.artists.forEach(artist => {
        if (artist.name && !artistMap.has(artist.name)) {
          artistMap.set(artist.name, {
            id: artist.id || '',
            name: artist.name,
            genres: [],
            images: [],
            popularity: 0,
            uri: `apple-music:artist:${artist.id || artist.name}`
          });
        }
      });
      
      // Extract albums
      if (track.album && track.album.name && !albumMap.has(track.album.id || track.album.name)) {
        albumMap.set(track.album.id || track.album.name, {
          id: track.album.id,
          name: track.album.name,
          artists: track.artists,
          images: track.album.images,
          uri: `apple-music:album:${track.album.id}`
        });
      }
    });
    
    console.log(`[AppleMusic] Recently played: ${parsedTracks.length} tracks`);
  } catch (error) {
    console.warn('[AppleMusic] Recently played fetch failed:', error);
  }
  
  // 3. If includeGenres is true, fetch catalog data to get genre information
  if (includeGenres && allTracks.length > 0) {
    // Get catalog song IDs (need to convert library IDs to catalog IDs if necessary)
    const catalogSongIds = allTracks
      .filter(track => track.id && !track.id.startsWith('i.')) // Filter out library IDs
      .map(track => track.id)
      .slice(0, 50); // Limit to avoid too many API calls
    
    if (catalogSongIds.length > 0) {
      try {
        const catalogData = await getCatalogSongs(catalogSongIds);
        const catalogSongs = catalogData.data || [];
        
        // Create a map for quick lookup
        const catalogMap = new Map<string, any>();
        catalogSongs.forEach((song: any) => {
          catalogMap.set(song.id, song);
        });
        
        // Enrich tracks with genre data
        allTracks = allTracks.map(track => {
          const catalogSong = catalogMap.get(track.id);
          if (catalogSong && catalogSong.attributes?.genreNames) {
            return {
              ...track,
              genreNames: catalogSong.attributes.genreNames
            };
          }
          return track;
        });
        
        console.log(`[AppleMusic] Enriched ${catalogSongs.length} tracks with genre data`);
      } catch (error) {
        console.warn('[AppleMusic] Catalog genre fetch failed:', error);
      }
    }
    
    // Also try to get artist genres
    const artistIds = Array.from(artistMap.values())
      .filter(artist => artist.id && !artist.id.startsWith('i.'))
      .map(artist => artist.id)
      .slice(0, 25);
    
    if (artistIds.length > 0) {
      try {
        const catalogArtists = await getCatalogArtists(artistIds);
        const artists = catalogArtists.data || [];
        
        artists.forEach((catalogArtist: any) => {
          const existingArtist = artistMap.get(catalogArtist.id) || 
                                 artistMap.get(catalogArtist.attributes?.name);
          if (existingArtist && catalogArtist.attributes?.genreNames) {
            existingArtist.genres = catalogArtist.attributes.genreNames;
          }
        });
        
        console.log(`[AppleMusic] Enriched ${artists.length} artists with genre data`);
      } catch (error) {
        console.warn('[AppleMusic] Artist genre fetch failed:', error);
      }
    }
  }
  
  allArtists = Array.from(artistMap.values());
  
  return {
    tracks: allTracks,
    artists: allArtists,
    albums: Array.from(albumMap.values())
  };
}

// --- Calculate Top Genres ---
export function calculateTopGenres(tracks: AppleMusicTrack[], artists: AppleMusicArtist[]): AppleMusicGenre[] {
  const genreMap = new Map<string, { count: number; score: number }>();
  
  // Count genres from tracks
  tracks.forEach(track => {
    const genres = track.genreNames || [];
    genres.forEach(genre => {
      const existing = genreMap.get(genre) || { count: 0, score: 0 };
      existing.count += 1;
      existing.score += 1; // Each track occurrence adds 1 to score
      genreMap.set(genre, existing);
    });
  });
  
  // Count genres from artists (weighted higher as they represent overall taste)
  artists.forEach(artist => {
    const genres = artist.genres || [];
    genres.forEach(genre => {
      const existing = genreMap.get(genre) || { count: 0, score: 0 };
      existing.count += 1;
      existing.score += 2; // Artist genres weighted higher
      genreMap.set(genre, existing);
    });
  });
  
  // Convert to array and sort by score
  const topGenres: AppleMusicGenre[] = Array.from(genreMap.entries())
    .map(([name, data]) => ({
      name,
      count: data.count,
      score: data.score
    }))
    .sort((a, b) => b.score - a.score);
  
  return topGenres;
}

// --- Export for Debugging ---
export function getMusicKitInstance() {
  return _musicKitInstance;
}

export function getStorefront(): string {
  return _userStorefront;
}
