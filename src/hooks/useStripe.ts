import { Platform } from 'react-native';
import { useStripe as useNativeStripe, InitPaymentSheetResult } from '@stripe/stripe-react-native';
import { useStripe as useWebStripe, useElements } from '@stripe/react-stripe-js';
import { StripeError } from '@stripe/stripe-js';

// Define a common interface for the hook's return value
interface PlatformStripe {
  initPaymentSheet: (params: any) => Promise<{ error?: { message?: string, code?: any, type?: any } }>;
  presentPaymentSheet: () => Promise<{ error?: { message?: string, code?: any, type?: any } }>;
  stripe: any;
  elements: any;
}

export const usePlatformStripe = (): PlatformStripe => {
  if (Platform.OS === 'web') {
    const stripe = useWebStripe();
    const elements = useElements();

    const initPaymentSheet = async (params: any): Promise<{ error?: { message?: string, code?: any, type?: any } }> => {
      // On web, initialization is handled by the <Elements> provider.
      // This function is a placeholder to match the mobile interface.
      console.log('initPaymentSheet called on web with:', params);
      return {};
    };

    const presentPaymentSheet = async (): Promise<{ error?: { message?: string, code?: any, type?: any } }> => {
      if (!stripe || !elements) {
        return { error: { message: 'Stripe.js has not loaded yet.' } };
      }

      const { error } = await stripe.confirmPayment({
        elements,
        redirect: 'if_required',
      });

      if (error) {
        return { error };
      }
      return {};
    };

    return {
      initPaymentSheet,
      presentPaymentSheet,
      stripe,
      elements,
    };
  } else {
    const nativeStripe = useNativeStripe();
    // Return the native implementation, which already matches the interface for the most part.
    // We just need to ensure the returned object fits our PlatformStripe interface.
    return {
      ...nativeStripe,
      stripe: nativeStripe,
      elements: null,
    };
  }
}; 