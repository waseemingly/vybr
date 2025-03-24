import React, { createContext, useState, useContext, ReactNode } from "react";

interface OrganizerModeContextType {
  isOrganizerMode: boolean;
  toggleOrganizerMode: () => void;
}

const OrganizerModeContext = createContext<
  OrganizerModeContextType | undefined
>(undefined);

interface OrganizerModeProviderProps {
  children: ReactNode;
}

export const OrganizerModeProvider = ({
  children,
}: OrganizerModeProviderProps) => {
  const [isOrganizerMode, setIsOrganizerMode] = useState(false);

  const toggleOrganizerMode = () => {
    setIsOrganizerMode((prevMode) => !prevMode);
  };

  return (
    <OrganizerModeContext.Provider
      value={{ isOrganizerMode, toggleOrganizerMode }}
    >
      {children}
    </OrganizerModeContext.Provider>
  );
};

export const useOrganizerMode = (): OrganizerModeContextType => {
  const context = useContext(OrganizerModeContext);
  if (context === undefined) {
    throw new Error(
      "useOrganizerMode must be used within an OrganizerModeProvider"
    );
  }
  return context;
};
