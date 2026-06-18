import { createContext, useContext, useState, type ReactNode } from 'react';
import type { RouteKey } from '../types';

interface RouterContextType {
  currentRoute: RouteKey;
  params: Record<string, string>;
  navigate: (route: RouteKey, params?: Record<string, string>) => void;
}

const RouterContext = createContext<RouterContextType | null>(null);

export function useRouter() {
  const ctx = useContext(RouterContext);
  if (!ctx) throw new Error('useRouter must be used within AppRoutes');
  return ctx;
}

export function AppRoutes({ children }: { children: ReactNode }) {
  const [currentRoute, setCurrentRoute] = useState<RouteKey>('dashboard');
  const [params, setParams] = useState<Record<string, string>>({});

  const navigate = (route: RouteKey, newParams?: Record<string, string>) => {
    setCurrentRoute(route);
    setParams(newParams ?? {});
  };

  return (
    <RouterContext.Provider value={{ currentRoute, navigate, params }}>
      {children}
    </RouterContext.Provider>
  );
}
