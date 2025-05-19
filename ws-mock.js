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

module.exports = {
  WebSocket: WebSocket,
  Server: WebSocketServer,
  createWebSocketStream: () => null,
  // Mock for StripeProvider
  StripeProvider: function MockStripeProvider({ children }) {
    // On the web, StripeProvider might not be needed or can just render children.
    // If you pass props like publishableKey to StripeProvider, they are ignored here.
    return children;
  },

  // Mock for useStripe hook
  useStripe: function mockUseStripe() {
    // Return a basic structure that your components might expect.
    // This prevents errors if your component tries to destructure or call methods on the result.
    return {
      retrievePaymentIntent: async () => ({ paymentIntent: null, error: { message: 'Stripe not available on web' } }),
      confirmPayment: async () => ({ paymentIntent: null, error: { message: 'Stripe not available on web' } }),
      createPaymentMethod: async () => ({ paymentMethod: null, error: { message: 'Stripe not available on web' } }),
      handleCardAction: async () => ({ paymentIntent: null, error: { message: 'Stripe not available on web' } }),
      // Add other methods or properties you use from useStripe with basic mock implementations
      loading: false, // example property
    };
  },

  // Add other exports from @stripe/stripe-react-native that you use
  // For example, if you use CardField:
  // CardField: function MockCardField(props) { 
  //   console.warn('CardField is not implemented for web in this mock.');
  //   return null; // Or render some placeholder UI
  // },
  
  // initStripe: function mockInitStripe() { 
  //   console.log('Stripe initStripe called on web (mocked)'); 
  // },
};