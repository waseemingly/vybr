// Mock implementation of the ws module for React Native
class WebSocket {
  constructor(url, protocols) {
    console.warn('WebSocket from ws package is not supported in React Native. Use the built-in WebSocket instead.');
    this.url = url;
    this.protocols = protocols;
    this.readyState = 3; // CLOSED
  }

  on() {
    return this;
  }

  addEventListener() {
    return this;
  }

  removeEventListener() {
    return this;
  }

  send() {
    return false;
  }

  close() {}
}

WebSocket.CONNECTING = 0;
WebSocket.OPEN = 1;
WebSocket.CLOSING = 2;
WebSocket.CLOSED = 3;

// Mock WebSocketServer
class WebSocketServer {
  constructor(options) {
    console.warn('WebSocketServer is not supported in React Native');
    this.options = options;
  }

  on() {
    return this;
  }

  close() {}
}

module.exports = WebSocket;
module.exports.Server = WebSocketServer;
module.exports.createWebSocketStream = () => null; 