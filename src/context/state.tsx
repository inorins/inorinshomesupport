import { createContext, useContext, useEffect, useState, ReactNode } from "react";

interface AppContextType {
  top: boolean;
  setTop: (value: boolean) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

interface AppWrapperProps {
  children: ReactNode;
}

export function AppWrapper({ children }: AppWrapperProps) {
  const [top, setTop] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      const scrollThreshold = 100;
      const isScrolled = window.scrollY > scrollThreshold;
      setTop(isScrolled);
    };
    
    // Handle initial state
    handleScroll();
    
    // Listen to scroll
    window.addEventListener("scroll", handleScroll, { passive: true });
    
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const sharedState: AppContextType = { top, setTop };
  return (
    <AppContext.Provider value={sharedState}>{children}</AppContext.Provider>
  );
}

export function useAppContext() {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useAppContext must be used within AppWrapper');
  }
  return context;
}
