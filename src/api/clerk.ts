// Mock Authentication Service (Clerk-style for mobile apps)
// Since Clerk's dev instance requires browser authentication which isn't available in React Native,
// we'll use a mock authentication system that simulates Clerk's behavior

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

// Simple in-memory store for demo users
const mockUsers = new Map<string, { 
  id: string; 
  email: string; 
  password: string; 
  firstName?: string; 
  lastName?: string;
}>();

// Generate a simple JWT-like token
function generateToken(userId: string): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(7);
  return `clerk_token_${userId}_${timestamp}_${random}`;
}

/**
 * Sign in with email and password
 */
export async function signIn({ email, password }: SignInParams): Promise<AuthResponse> {
  try {
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 800));

    const user = mockUsers.get(email.toLowerCase());

    if (!user || user.password !== password) {
      return {
        success: false,
        error: "Invalid email or password. Please check your credentials and try again.",
      };
    }

    const token = generateToken(user.id);

    return {
      success: true,
      token,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
      },
    };
  } catch (error: any) {
    console.error("Sign in error:", error);
    return {
      success: false,
      error: error.message || "An unexpected error occurred. Please try again.",
    };
  }
}

/**
 * Sign up with email and password
 */
export async function signUp({
  email,
  password,
  firstName,
  lastName,
}: SignUpParams): Promise<AuthResponse> {
  try {
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 1000));

    const emailLower = email.toLowerCase();

    // Check if user already exists
    if (mockUsers.has(emailLower)) {
      return {
        success: false,
        error: "An account with this email already exists. Please sign in instead.",
      };
    }

    // Validate password
    if (password.length < 8) {
      return {
        success: false,
        error: "Password must be at least 8 characters long.",
      };
    }

    // Create new user
    const userId = `user_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    const newUser = {
      id: userId,
      email: emailLower,
      password,
      firstName,
      lastName,
    };

    mockUsers.set(emailLower, newUser);

    const token = generateToken(userId);

    return {
      success: true,
      token,
      user: {
        id: userId,
        email: emailLower,
        firstName,
        lastName,
      },
    };
  } catch (error: any) {
    console.error("Sign up error:", error);
    return {
      success: false,
      error: error.message || "An unexpected error occurred. Please try again.",
    };
  }
}

/**
 * Verify session token
 */
export async function verifyToken(token: string): Promise<boolean> {
  try {
    // Simple token validation - check if it has the expected format
    return token.startsWith("clerk_token_");
  } catch (error) {
    console.error("Token verification error:", error);
    return false;
  }
}
