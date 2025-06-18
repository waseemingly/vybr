import React from 'react';

interface CustomStripeProviderProps {
  publishableKey: string; // Keep for prop consistency
  children: React.ReactNode;
}

const CustomStripeProvider = ({ children }: CustomStripeProviderProps) => {
  // On web, this provider is a pass-through.
  // Each screen will wrap its payment form with the <Elements> provider.
  return <>{children}</>;
};

export default CustomStripeProvider; 