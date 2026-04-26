import type { UserProfile } from "@/components/providers/magic-provider";

/** Raw GET /users response shape */
type UserApiResponse = {
  proxy_wallet: string;
  email?: string | null;
  name?: string | null;
  allowance_status?: string | null;
};

function userResponseToProfile(user: UserApiResponse): UserProfile {
  return {
    proxyWallet: user.proxy_wallet,
    email: user.email ?? null,
    name: user.name ?? null,
    allowanceStatus: user.allowance_status ?? null,
  };
}

export const GAMMA_API_URL =
  process.env.NEXT_PUBLIC_GAMMA_API_URL ?? "http://localhost:8084";

const BUILDER_API_PUBLIC_KEY =
  process.env.NEXT_PUBLIC_BUILDER_API_PUBLIC_KEY?.trim() ?? "";

/**
 * Calls POST /login with the Magic DID token, then GET /users to fetch the
 * full user profile. Returns a UserProfile containing the proxy wallet,
 * email, and name. The `predictionsession` cookie is set by the login response.
 */
export async function loginWithMagic(didToken: string): Promise<UserProfile> {
  const body: Record<string, unknown> = {};
  if (BUILDER_API_PUBLIC_KEY) {
    body.api_public_key = BUILDER_API_PUBLIC_KEY;
  }

  const loginRes = await fetch(`${GAMMA_API_URL}/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${didToken}`,
    },
    body: JSON.stringify(body),
    credentials: "include",
  });

  if (!loginRes.ok) {
    const errBody = await loginRes.text();
    throw new Error(`Login failed (${loginRes.status}): ${errBody}`);
  }

  // Session cookie is now set — fetch the full user profile
  const userRes = await fetch(`${GAMMA_API_URL}/users`, {
    credentials: "include",
  });

  if (!userRes.ok) {
    const errBody = await userRes.text();
    throw new Error(`Failed to fetch user (${userRes.status}): ${errBody}`);
  }

  const user = (await userRes.json()) as UserApiResponse;

  if (!user.proxy_wallet) throw new Error("User response missing proxy_wallet");

  return userResponseToProfile(user);
}

/**
 * Fetches the current user profile using the existing session cookie.
 * Returns null if the session is missing or expired (401).
 */
export async function getUser(): Promise<UserProfile | null> {
  const res = await fetch(`${GAMMA_API_URL}/users`, {
    credentials: "include",
  });
  if (!res.ok) return null;
  const user = (await res.json()) as UserApiResponse;
  if (!user.proxy_wallet) return null;
  return userResponseToProfile(user);
}
