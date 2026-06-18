import { useState, type ReactNode } from 'react';
import { AuthContext } from './AuthContext';
import type { AuthUser, RoleName } from '../types';

const MOCK_USERS: Record<RoleName, AuthUser> = {
  DragonHelp: { id: '1', name: 'Ana García', email: 'ana.garcia@empresa.com', role: 'DragonHelp' },
  Registro: { id: '2', name: 'Carlos López', email: 'carlos.lopez@empresa.com', role: 'Registro' },
  Seguridades: { id: '3', name: 'María Torres', email: 'maria.torres@empresa.com', role: 'Seguridades' },
  RRHH: { id: '4', name: 'Juan Pérez', email: 'juan.perez@empresa.com', role: 'RRHH' },
};

export function MockAuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser>(MOCK_USERS.DragonHelp);

  const login = (role: RoleName) => setUser(MOCK_USERS[role]);
  const logout = () => setUser(MOCK_USERS.DragonHelp);
  const switchRole = (role: RoleName) => setUser(MOCK_USERS[role]);

  return (
    <AuthContext.Provider value={{ user, isAuthenticated: true, login, logout, switchRole }}>
      {children}
    </AuthContext.Provider>
  );
}
