import AsyncStorage from '@react-native-async-storage/async-storage';
import { getJwtExpMs } from './jwt';

const TOKEN_KEY = 'specter_jwt_token';
const EXPIRY_KEY = 'specter_jwt_expiry';
const USER_KEY = 'specter_jwt_user';
const SESSION_KEY = 'specter_auth_session_id';

interface TokenCacheData {
  token: string;
  userId: string;
  email: string;
  expiry: number;
}

/**
 * Get cached JWT token if still valid
 */
export async function getCachedToken(): Promise<string | null> {
  try {
    const token = await AsyncStorage.getItem(TOKEN_KEY);
    const expiry = await AsyncStorage.getItem(EXPIRY_KEY);
    
    if (token && expiry && Date.now() < parseInt(expiry)) {
      console.log('🔑 [TokenCache] Using cached JWT');
      return token;
    }
    
    // Token expired or missing, clear cache
    if (token) {
      console.log('⚠️ [TokenCache] Token expired, clearing cache');
      await clearTokenCache();
    }
    
    return null;
  } catch (error) {
    console.error('❌ [TokenCache] Error reading cache:', error);
    return null;
  }
}

/**
 * Cache a JWT token with expiry
 */
export async function cacheToken(
  token: string, 
  userId: string, 
  email: string, 
  sessionId?: string | null,
  expiresInMs?: number
): Promise<void> {
  try {
    const derivedExpiry = getJwtExpMs(token);
    const expiry =
      typeof expiresInMs === 'number'
        ? Date.now() + expiresInMs
        : typeof derivedExpiry === 'number'
          ? derivedExpiry
          : Date.now() + (60 * 60 * 1000);
    const pairs: [string, string][] = [
      [TOKEN_KEY, token],
      [EXPIRY_KEY, expiry.toString()],
      [USER_KEY, JSON.stringify({ userId, email })],
    ];
    if (sessionId) {
      pairs.push([SESSION_KEY, sessionId]);
    }
    await AsyncStorage.multiSet(pairs);
    const mins = Math.max(0, Math.round((expiry - Date.now()) / 60000));
    console.log(`✅ [TokenCache] Cached token for ${email}, expires in ~${mins} minutes`);
  } catch (error) {
    console.error('❌ [TokenCache] Error caching token:', error);
  }
}

/**
 * Clear all cached token data
 */
export async function clearTokenCache(): Promise<void> {
  try {
    await AsyncStorage.multiRemove([TOKEN_KEY, EXPIRY_KEY, USER_KEY, SESSION_KEY]);
    console.log('🗑️ [TokenCache] Cache cleared');
  } catch (error) {
    console.error('❌ [TokenCache] Error clearing cache:', error);
  }
}

export async function getCachedSessionId(): Promise<string | null> {
  try {
    return (await AsyncStorage.getItem(SESSION_KEY)) || null;
  } catch (error) {
    console.error('❌ [TokenCache] Error reading session cache:', error);
    return null;
  }
}

/**
 * Get cached user info
 */
export async function getCachedUser(): Promise<{ userId: string; email: string } | null> {
  try {
    const userData = await AsyncStorage.getItem(USER_KEY);
    if (userData) {
      return JSON.parse(userData);
    }
    return null;
  } catch (error) {
    console.error('❌ [TokenCache] Error reading user cache:', error);
    return null;
  }
}

/**
 * Check if we have a valid cached session
 */
export async function hasValidSession(): Promise<boolean> {
  const token = await getCachedToken();
  return token !== null;
}
