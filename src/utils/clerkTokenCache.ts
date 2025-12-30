import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";

type TokenCache = {
  getToken: (key: string) => Promise<string | null>;
  saveToken: (key: string, token: string) => Promise<void>;
};

export const clerkTokenCache: TokenCache = {
  async getToken(key: string) {
    if (Platform.OS === "web") {
      try {
        return window?.localStorage?.getItem(key) ?? null;
      } catch {
        return null;
      }
    }
    try {
      return await SecureStore.getItemAsync(key);
    } catch {
      return null;
    }
  },
  async saveToken(key: string, token: string) {
    if (Platform.OS === "web") {
      try {
        window?.localStorage?.setItem(key, token);
      } catch {
        // ignore
      }
      return;
    }
    await SecureStore.setItemAsync(key, token);
  },
};

