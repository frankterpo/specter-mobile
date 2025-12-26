import { Platform } from "react-native";

// API key for web app authentication (since Railway endpoints don't exist)
const SPECTER_API_KEY = "iJXZPM060qU32m0UKCSfrtIVFzSt09La";

export function useClerkToken() {
  const getAuthToken = async (): Promise<string | null> => {
    // Return API key for web app authentication
    // (Railway staging doesn't have the endpoints we need)
    if (__DEV__) {
      console.log(`🔑 [API] Using API key authentication (web app)`);
    }
    return SPECTER_API_KEY;
  };

  return { getAuthToken };
}
