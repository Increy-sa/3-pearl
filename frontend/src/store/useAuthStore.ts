import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type StaffRole = 'ADMIN' | 'ACCOUNT_MANAGER' | 'DESIGNER' | 'DEVELOPER' | 'SEO';
export type Role = StaffRole | 'CUSTOMER';

interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  phone?: string | null;  // from Adtopia webhook via login response
}


interface AuthState {
  user: User | null;
  token: string | null;
  isProfileComplete: boolean;
  login: (user: User, token: string, isProfileComplete: boolean) => void;
  setProfileComplete: (value: boolean) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      isProfileComplete: true, // safe default — guard only activates for CUSTOMER role
      login: (user, token, isProfileComplete) => set({ user, token, isProfileComplete }),
      setProfileComplete: (value) => set({ isProfileComplete: value }),
      logout: () => set({ user: null, token: null, isProfileComplete: true }),
    }),
    {
      name: 'auth-storage',
    }
  )
);
