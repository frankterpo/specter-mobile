import AsyncStorage from "@react-native-async-storage/async-storage";

const USER_CONTEXT_KEY = "@specter_user_context";

// In-memory cache for faster access
let _cachedContext: UserContext | null = null;

export interface UserContext {
  userId: string;
  userEmail: string;
  displayName?: string;
  apiKey?: string;
}

/**
 * Get user context from AsyncStorage (with memory cache)
 */
export async function getUserContext(): Promise<UserContext | null> {
  if (_cachedContext) return _cachedContext;
  
  try {
    const stored = await AsyncStorage.getItem(USER_CONTEXT_KEY);
    if (!stored) return null;
    _cachedContext = JSON.parse(stored) as UserContext;
    return _cachedContext;
  } catch (error) {
    console.error("Failed to get user context:", error);
    return null;
  }
}

/**
 * Set user context in AsyncStorage and memory cache
 */
export async function setUserContext(context: UserContext): Promise<void> {
  try {
    _cachedContext = context;
    await AsyncStorage.setItem(USER_CONTEXT_KEY, JSON.stringify(context));
  } catch (error) {
    console.error("Failed to set user context:", error);
    throw error;
  }
}

/**
 * Clear user context from AsyncStorage and memory cache
 */
export async function clearUserContext(): Promise<void> {
  try {
    _cachedContext = null;
    await AsyncStorage.removeItem(USER_CONTEXT_KEY);
  } catch (error) {
    console.error("Failed to clear user context:", error);
    throw error;
  }
}

/**
 * Check if user context exists
 */
export async function hasUserContext(): Promise<boolean> {
  const context = await getUserContext();
  return context !== null;
}

