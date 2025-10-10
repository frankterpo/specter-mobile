import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";

interface User {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
}

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  token: string | null;
  
  // Actions
  setUser: (user: User | null) => void;
  setToken: (token: string | null) => Promise<void>;
  setIsAuthenticated: (isAuthenticated: boolean) => void;
  setIsLoading: (isLoading: boolean) => void;
  logout: () => Promise<void>;
  initialize: () => Promise<void>;
}

const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      isAuthenticated: false,
      isLoading: true,
      token: null,

      setUser: (user) => set({ user }),
      
      setToken: async (token) => {
        if (token) {
          await SecureStore.setItemAsync("clerk_token", token);
        } else {
          await SecureStore.deleteItemAsync("clerk_token");
        }
        set({ token });
      },
      
      setIsAuthenticated: (isAuthenticated) => set({ isAuthenticated }),
      
      setIsLoading: (isLoading) => set({ isLoading }),
      
      logout: async () => {
        await SecureStore.deleteItemAsync("clerk_token");
        set({
          user: null,
          isAuthenticated: false,
          token: null,
        });
      },
      
      initialize: async () => {
        try {
          const token = await SecureStore.getItemAsync("clerk_token");
          if (token) {
            set({ token, isAuthenticated: true });
          }
        } catch (error) {
          console.error("Failed to initialize auth:", error);
        } finally {
          set({ isLoading: false });
        }
      },
    }),
    {
      name: "auth-storage",
      storage: createJSONStorage(() => AsyncStorage),
      // Don't persist token in AsyncStorage for security
      partialize: (state) => ({
        user: state.user,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);

export default useAuthStore;
