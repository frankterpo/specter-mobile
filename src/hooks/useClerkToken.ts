import { useAuth } from "@clerk/clerk-expo";
import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getCachedToken, cacheToken, clearTokenCache as clearCache } from "../utils/tokenCache";
import { getJwtSub } from "../utils/jwt";
import { useAuthStore } from "../stores/authStore";

export function useClerkToken() {
  // Conditionally call useAuth to avoid errors if Clerk isn't initialized
  let clerkGetToken: any = null;
  let clerkUserId: string | null = null;
  try {
    const auth = useAuth();
    clerkGetToken = auth.getToken;
    clerkUserId = auth.userId;
  } catch (e) {
    // Web builds may not have a working Clerk client (e.g. localhost origin restrictions).
    if (Platform.OS !== "web") console.error("Clerk useAuth failed in hook:", e);
  }

  const getAuthToken = async (): Promise<string | null> => {
    // 1) Fast path: cached JWT
    const cachedToken = await getCachedToken();
    if (cachedToken) {
      return cachedToken;
    }

    // 2) Native path: Clerk SDK token
    if (clerkGetToken) {
      try {
        const token = await clerkGetToken();
        if (token) {
          if (__DEV__) console.log(`🔑 [API] Using Clerk JWT authentication`);
          const sub = getJwtSub(token);
          await cacheToken(token, sub || clerkUserId || "clerk_user", "unknown");
          return token;
        }
      } catch (error) {
        console.warn("⚠️ [API] Clerk token retrieval failed");
      }
    }

    // 3) Web Dev Fallback: Fetch from proxy if Clerk is blocked
    const isWebDev = Platform.OS === 'web' && __DEV__;
    if (isWebDev) {
      try {
        const { authEmail } = useAuthStore.getState();
        const email = authEmail || await AsyncStorage.getItem("specter_auth_email");
        
        if (!email) {
          console.warn('⚠️ [API] No auth email stored, cannot fetch token from proxy');
          return null;
        }
        
        console.log(`🛠️ [API] Fetching dev token for ${email} from proxy...`);
        const response = await fetch("http://localhost:3333/api/get-jwt", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email }), // Back-compat: get-jwt might work with just email if session exists
        });
        
        if (response.ok) {
          const data = await response.json();
          if (data.jwt) {
            console.log(`✅ [API] Got token from proxy for ${email}`);
            await cacheToken(data.jwt, data.userId || "unknown", email, data.sessionId);
            return data.jwt;
          }
        }
      } catch (error: any) {
        console.error("❌ [API] Dev fallback token retrieval failed:", error?.message || error);
      }
    }

    return null;
  };

  const clearTokenCache = async () => {
    await clearCache();
    console.log('🗑️ [API] Token cache cleared');
  };

  return { getAuthToken, clearTokenCache };
}
