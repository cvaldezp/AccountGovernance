import { createContext } from 'react';
import type { AuthUser } from '../types';

export interface AuthContextType {
  user:            AuthUser | null;
  isAuthenticated: boolean;
  isLoading:       boolean;
  meError:         string | null;
  login:           () => Promise<void>;
  logout:          () => void;
  getAccessToken:  () => Promise<string | null>;
}

export const AuthContext = createContext<AuthContextType | null>(null);
