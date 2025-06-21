import { useCallback } from 'react';

// Define a common interface for the hook's return value
interface PlatformStripe {
  initPaymentSheet: (params: any) => Promise<{ error?: { message?: string, code?: any, type?: any } }>;
  presentPaymentSheet: () => Promise<{ error?: { message?: string, code?: any, type?: any } }>;
  stripe: any;
  elements: any;
}

export const usePlatformStripe = (): PlatformStripe => {
  const initPaymentSheet = useCallback(async (params: any): Promise<{ error?: { message?: string, code?: any, type?: any } }> => {
    // On web, initialization is handled by the <Elements> provider.
    // This function is a placeholder to match the mobile interface.
    console.log('initPaymentSheet called on web with:', params);
    return {};
  }, []);

  const presentPaymentSheet = useCallback(async (): Promise<{ error?: { message?: string, code?: any, type?: any } }> => {
    // On web, this should not be called directly since payment is handled 
    // within Elements components using confirmPayment or confirmSetup
    console.warn('presentPaymentSheet called on web - this should be handled within Elements components');
    return { error: { message: 'presentPaymentSheet not supported on web - use Elements components' } };
  }, []);

  return {
    initPaymentSheet,
    presentPaymentSheet,
    stripe: null, // These will be accessed via useStripe/useElements within Elements components
    elements: null,
  };
}; 