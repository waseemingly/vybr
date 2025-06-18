import { useStripe as useNativeStripe } from '@stripe/stripe-react-native';

// Define a common interface for the hook's return value
interface PlatformStripe {
  initPaymentSheet: (params: any) => Promise<{ error?: { message?: string, code?: any, type?: any } }>;
  presentPaymentSheet: () => Promise<{ error?: { message?: string, code?: any, type?: any } }>;
  stripe: any;
  elements: any;
}

export const usePlatformStripe = (): PlatformStripe => {
    const nativeStripe = useNativeStripe();
    // Return the native implementation, which already matches the interface for the most part.
    // We just need to ensure the returned object fits our PlatformStripe interface.
    return {
      ...nativeStripe,
      stripe: nativeStripe,
      elements: null,
    };
}; 