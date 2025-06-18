import React from 'react';
import { StripeProvider as NativeStripeProvider } from '@stripe/stripe-react-native';

interface CustomStripeProviderProps {
  publishableKey: string;
  children: React.ReactNode;
}

const CustomStripeProvider = ({ publishableKey, children }: CustomStripeProviderProps) => {
  return (
    <NativeStripeProvider publishableKey={publishableKey}>
      <>{React.Children.toArray(children)}</>
    </NativeStripeProvider>
  );
};

export default CustomStripeProvider; 