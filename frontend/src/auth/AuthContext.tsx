import { createContext } from 'react';
import type { AuthStatus, AuthUser } from '../types';

export interface AuthContextType {
  status:          AuthStatus;
  user:            AuthUser | null;
  isAuthenticated: boolean;
  isLoading:       boolean;
  /** Technical failure only (network/API/timeout) — never set for "authenticated but no roles". */
  meError:         string | null;
  login:           () => Promise<void>;
  logout:          () => void;
  getAccessToken:  () => Promise<string | null>;
}

export const AuthContext = createContext<AuthContextType | null>(null);
