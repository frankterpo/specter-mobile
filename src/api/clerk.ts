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
    // Step 1: Create a sign in attempt
    const createResponse = await fetch(`https://${CLERK_DOMAIN}/v1/client/sign_ins?_clerk_js_version=4.70.0`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        identifier: email,
      }),
    });

    if (!createResponse.ok) {
      const errorData = await createResponse.json();
      return {
        success: false,
        error: errorData.errors?.[0]?.long_message || errorData.errors?.[0]?.message || "Failed to initiate sign in",
      };
    }

    const createData = await createResponse.json();
    const signInId = createData.response?.id;

    if (!signInId) {
      return {
        success: false,
        error: "Failed to create sign in session",
      };
    }

    // Step 2: Attempt to sign in with password
    const attemptResponse = await fetch(
      `https://${CLERK_DOMAIN}/v1/client/sign_ins/${signInId}/attempt_first_factor?_clerk_js_version=4.70.0`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          strategy: "password",
          password: password,
        }),
      }
    );

    if (!attemptResponse.ok) {
      const errorData = await attemptResponse.json();
      return {
        success: false,
        error: errorData.errors?.[0]?.long_message || errorData.errors?.[0]?.message || "Invalid email or password",
      };
    }

    const attemptData = await attemptResponse.json();
    
    // Extract session token and user data
    const session = attemptData.response?.created_session_id 
      ? attemptData.client?.sessions?.find((s: any) => s.id === attemptData.response.created_session_id)
      : attemptData.client?.sessions?.[0];

    const sessionToken = session?.last_active_token?.jwt;
    const userData = session?.user;

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
  } catch (error: any) {
    console.error("Sign in error:", error);
    return {
      success: false,
      error: error.message || "Network error. Please check your connection and try again.",
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
    // Step 1: Create a sign up
    const createResponse = await fetch(`https://${CLERK_DOMAIN}/v1/client/sign_ups?_clerk_js_version=4.70.0`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email_address: email,
        password,
        first_name: firstName,
        last_name: lastName,
      }),
    });

    if (!createResponse.ok) {
      const errorData = await createResponse.json();
      return {
        success: false,
        error: errorData.errors?.[0]?.long_message || errorData.errors?.[0]?.message || "Failed to create account",
      };
    }

    const createData = await createResponse.json();
    const signUpId = createData.response?.id;

    if (!signUpId) {
      return {
        success: false,
        error: "Failed to create sign up session",
      };
    }

    // Step 2: Check if we need email verification
    const signUpResponse = createData.response;
    
    // If email verification is required, we need to handle that
    if (signUpResponse.status === "missing_requirements") {
      return {
        success: false,
        error: "Email verification required. Please check your email.",
      };
    }

    // Step 3: Try to complete the sign up and get session
    const session = createData.client?.sessions?.[0];
    const sessionToken = session?.last_active_token?.jwt;
    const userData = session?.user || signUpResponse;

    if (!sessionToken) {
      // Try to sign in instead
      return await signIn({ email, password });
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
  } catch (error: any) {
    console.error("Sign up error:", error);
    return {
      success: false,
      error: error.message || "Network error. Please check your connection and try again.",
    };
  }
}

/**
 * Verify session token with Clerk
 */
export async function verifyToken(token: string): Promise<boolean> {
  try {
    const response = await fetch(`https://${CLERK_DOMAIN}/v1/client/sessions/${token}/touch?_clerk_js_version=4.70.0`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
    });

    return response.ok;
  } catch (error) {
    console.error("Token verification error:", error);
    return false;
  }
}
