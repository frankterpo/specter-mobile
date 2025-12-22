import AsyncStorage from "@react-native-async-storage/async-storage";

const USER_CONTEXT_KEY = "@specter_user_context";

export interface UserContext {
  userId: string;
  userEmail: string;
  displayName?: string;
}

/**
 * Get user context from AsyncStorage
 */
export async function getUserContext(): Promise<UserContext | null> {
  try {
    const stored = await AsyncStorage.getItem(USER_CONTEXT_KEY);
    if (!stored) return null;
    return JSON.parse(stored) as UserContext;
  } catch (error) {
    console.error("Failed to get user context:", error);
    return null;
  }
}

/**
 * Set user context in AsyncStorage
 */
export async function setUserContext(context: UserContext): Promise<void> {
  try {
    await AsyncStorage.setItem(USER_CONTEXT_KEY, JSON.stringify(context));
  } catch (error) {
    console.error("Failed to set user context:", error);
    throw error;
  }
}

/**
 * Clear user context from AsyncStorage
 */
export async function clearUserContext(): Promise<void> {
  try {
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

