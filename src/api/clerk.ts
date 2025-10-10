// Clerk Authentication Service
// Integrates with Clerk API for authentication

const CLERK_PUBLISHABLE_KEY = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY;
const CLERK_DOMAIN = process.env.EXPO_PUBLIC_CLERK_DOMAIN;

interface SignInParams {
  email: string;
  password: string;
}

interface SignUpParams {
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
}

interface AuthResponse {
  success: boolean;
  token?: string;
  user?: {
    id: string;
    email: string;
    firstName?: string;
    lastName?: string;
  };
  error?: string;
}

/**
 * Sign in with email and password using Clerk
 */
export async function signIn({ email, password }: SignInParams): Promise<AuthResponse> {
  try {
    const response = await fetch(`https://${CLERK_DOMAIN}/v1/client/sign_ins`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${CLERK_PUBLISHABLE_KEY}`,
      },
      body: JSON.stringify({
        identifier: email,
        password,
        strategy: "password",
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      return {
        success: false,
        error: errorData.errors?.[0]?.message || "Invalid email or password",
      };
    }

    const data = await response.json();
    
    // Extract session token and user data
    const sessionToken = data.client?.sessions?.[0]?.last_active_token?.jwt || data.response?.session_token;
    const userData = data.client?.sessions?.[0]?.user || data.response?.user;

    if (!sessionToken) {
      return {
        success: false,
        error: "Failed to retrieve session token",
      };
    }

    return {
      success: true,
      token: sessionToken,
      user: {
        id: userData?.id || `user_${Date.now()}`,
        email: userData?.email_addresses?.[0]?.email_address || email,
        firstName: userData?.first_name,
        lastName: userData?.last_name,
      },
    };
  } catch (error) {
    console.error("Sign in error:", error);
    return {
      success: false,
      error: "Network error. Please check your connection and try again.",
    };
  }
}

/**
 * Sign up with email and password using Clerk
 */
export async function signUp({
  email,
  password,
  firstName,
  lastName,
}: SignUpParams): Promise<AuthResponse> {
  try {
    const response = await fetch(`https://${CLERK_DOMAIN}/v1/client/sign_ups`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${CLERK_PUBLISHABLE_KEY}`,
      },
      body: JSON.stringify({
        email_address: email,
        password,
        first_name: firstName,
        last_name: lastName,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      return {
        success: false,
        error: errorData.errors?.[0]?.message || "Failed to create account",
      };
    }

    const data = await response.json();
    
    // For sign up, we may need to complete the sign up flow
    const sessionToken = data.client?.sessions?.[0]?.last_active_token?.jwt || data.response?.session_token;
    const userData = data.response?.user || data.client?.sessions?.[0]?.user;

    if (!sessionToken) {
      return {
        success: false,
        error: "Account created but failed to sign in automatically",
      };
    }

    return {
      success: true,
      token: sessionToken,
      user: {
        id: userData?.id || `user_${Date.now()}`,
        email: userData?.email_addresses?.[0]?.email_address || email,
        firstName: userData?.first_name || firstName,
        lastName: userData?.last_name || lastName,
      },
    };
  } catch (error) {
    console.error("Sign up error:", error);
    return {
      success: false,
      error: "Network error. Please check your connection and try again.",
    };
  }
}

/**
 * Verify session token with Clerk
 */
export async function verifyToken(token: string): Promise<boolean> {
  try {
    const response = await fetch(`https://${CLERK_DOMAIN}/v1/client/sessions/verify`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    });

    return response.ok;
  } catch (error) {
    console.error("Token verification error:", error);
    return false;
  }
}
