import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { hasValidSession } from '../utils/tokenCache';

interface AuthState {
  authEmail: string | null;
  isSignedIn: boolean;
  isBootstrapped: boolean;
  setAuthEmail: (email: string | null) => Promise<void>;
  bootstrapAuth: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  authEmail: null,
  isSignedIn: false,
  isBootstrapped: false,
  setAuthEmail: async (email: string | null) => {
    if (email) {
      await AsyncStorage.setItem("specter_auth_email", email);
    } else {
      await AsyncStorage.removeItem("specter_auth_email");
    }
    set({ authEmail: email, isSignedIn: !!email });
  },
  bootstrapAuth: async () => {
    const email = await AsyncStorage.getItem("specter_auth_email");
    const valid = await hasValidSession();
    set({ authEmail: email, isSignedIn: valid, isBootstrapped: true });
  },
}));
