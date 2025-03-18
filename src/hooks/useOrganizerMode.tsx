
import React, { createContext, useContext, useState } from 'react';

interface OrganizerModeContextType {
  isOrganizerMode: boolean;
  toggleOrganizerMode: () => void;
}

const OrganizerModeContext = createContext<OrganizerModeContextType | undefined>(undefined);

export const OrganizerModeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isOrganizerMode, setIsOrganizerMode] = useState(false);

  const toggleOrganizerMode = () => {
    setIsOrganizerMode(prev => !prev);
  };

  return (
    <OrganizerModeContext.Provider value={{ isOrganizerMode, toggleOrganizerMode }}>
      {children}
    </OrganizerModeContext.Provider>
  );
};

export const useOrganizerMode = () => {
  const context = useContext(OrganizerModeContext);
  if (context === undefined) {
    throw new Error('useOrganizerMode must be used within an OrganizerModeProvider');
  }
  return context;
};
