import { createContext } from 'react';
import type { AuthUser, RoleName } from '../types';

export interface AuthContextType {
  user: AuthUser | null;
  isAuthenticated: boolean;
  login: (role: RoleName) => void;
  logout: () => void;
  switchRole: (role: RoleName) => void;
}

export const AuthContext = createContext<AuthContextType | null>(null);
