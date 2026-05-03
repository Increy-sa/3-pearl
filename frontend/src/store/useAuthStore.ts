import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type StaffRole = 'ADMIN' | 'ACCOUNT_MANAGER' | 'DESIGNER' | 'DEVELOPER' | 'QA';
export type Role = StaffRole | 'CUSTOMER';

interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
}

interface AuthState {
  user: User | null;
  token: string | null;
  login: (user: User, token: string) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      login: (user, token) => set({ user, token }),
      logout: () => set({ user: null, token: null }),
    }),
    {
      name: 'auth-storage',
    }
  )
);
