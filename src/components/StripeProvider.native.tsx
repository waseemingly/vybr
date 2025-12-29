import React from 'react';
import { StripeProvider as NativeStripeProvider } from '@stripe/stripe-react-native';

interface CustomStripeProviderProps {
  publishableKey: string;
  urlScheme?: string;
  children: React.ReactNode;
}

const CustomStripeProvider = ({ publishableKey, urlScheme, children }: CustomStripeProviderProps) => {
  return (
    <NativeStripeProvider publishableKey={publishableKey} urlScheme={urlScheme}>
      <>{React.Children.toArray(children)}</>
    </NativeStripeProvider>
  );
};

export default CustomStripeProvider; 