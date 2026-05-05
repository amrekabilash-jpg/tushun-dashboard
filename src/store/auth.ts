import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type UserRole = 'admin' | 'manager' | 'analyst';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
}

const USERS = [
  { id: '1', email: 'admin@tushun.kz',   password: 'admin123',   name: 'Администратор', role: 'admin'   as UserRole },
  { id: '2', email: 'manager@tushun.kz', password: 'manager123', name: 'Нурсеит А.',    role: 'manager' as UserRole },
  { id: '3', email: 'analyst@tushun.kz', password: 'analyst123', name: 'Жанар К.',      role: 'analyst' as UserRole },
];

interface AuthStore {
  user: AuthUser | null;
  login: (email: string, password: string) => boolean;
  logout: () => void;
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set) => ({
      user: null,
      login: (email, password) => {
        const found = USERS.find(u => u.email === email && u.password === password);
        if (found) {
          const { password: _, ...user } = found;
          set({ user });
          return true;
        }
        return false;
      },
      logout: () => set({ user: null }),
    }),
    { name: 'tushun-auth' }
  )
);
