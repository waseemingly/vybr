import React from 'react';
import { Platform, Alert } from 'react-native';
import type {
  PaymentSheet as ActualPaymentSheet,
  StripeProviderProps as ActualStripeProviderProps,
  InitStripeParams
} from '@stripe/stripe-react-native';

// Define a type for the useStripe hook's return value for clarity
type UseStripeHook = () => {
  initPaymentSheet: (params: ActualPaymentSheet.SetupParams) => Promise<{ error?: { code: string; message: string } | undefined }>;
  presentPaymentSheet: () => Promise<{ error?: { code: string; message: string } | undefined }>;
  // Add other Stripe hook methods if used elsewhere, e.g., confirmPayment, handleCardAction
};

// Modify StripeProvider type to make publishableKey optional for the wrapper, but children mandatory.
// The actual native StripeProvider will still require publishableKey.
type CustomStripeProviderProps = Omit<ActualStripeProviderProps, 'publishableKey'> & 
                                 Partial<Pick<ActualStripeProviderProps, 'publishableKey'>> & 
                                 { children: React.ReactNode };

type StripeLibrary = {
  useStripe: UseStripeHook;
  StripeProvider: React.FC<CustomStripeProviderProps>;
  PaymentSheet: typeof ActualPaymentSheet;
};

let ExportedStripeLibrary: StripeLibrary;

if (Platform.OS === 'web') {
  console.log('[Stripe Wrapper] Using Web Mocks for Stripe');
  const showWebPaymentAlert = () => {
    Alert.alert(
      "Payment Notice",
      "Live payments are not available in the web version. This is a simulated flow."
    );
  };

  const WebStripeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    // On the web, StripeProvider is essentially a pass-through or no-op for rendering.
    // The actual StripeProvider logic is skipped to avoid native errors.
    return children as React.ReactElement; // Cast children to ReactElement or ReactNode if necessary
  };

  ExportedStripeLibrary = {
    useStripe: () => ({
      initPaymentSheet: async (params) => {
        console.log('[WEB_STRIPE_MOCK] initPaymentSheet called with:', params);
        showWebPaymentAlert();
        return { error: undefined };
      },
      presentPaymentSheet: async () => {
        console.log('[WEB_STRIPE_MOCK] presentPaymentSheet called');
        showWebPaymentAlert();
        return { error: { code: 'Canceled', message: 'Payments are simulated on web.' } };
      },
    }),
    StripeProvider: WebStripeProvider as React.FC<CustomStripeProviderProps>,
    PaymentSheet: {} as typeof ActualPaymentSheet,
  };
} else {
  console.log('[Stripe Wrapper] Using Native Stripe SDK');
  const {
    useStripe: useActualStripe,
    StripeProvider: ActualStripeProviderComponent,
    PaymentSheet: ActualPaymentSheetModule,
  } = require('@stripe/stripe-react-native');

  ExportedStripeLibrary = {
    useStripe: useActualStripe as UseStripeHook,
    StripeProvider: ActualStripeProviderComponent as React.FC<CustomStripeProviderProps>,
    PaymentSheet: ActualPaymentSheetModule,
  };
}

export const { useStripe, StripeProvider, PaymentSheet } = ExportedStripeLibrary; 