import type { UserProfile } from "@/components/providers/magic-provider";

const GAMMA_API_URL =
  process.env.NEXT_PUBLIC_GAMMA_API_URL ?? "http://localhost:8084";

const BUILDER_ID = process.env.NEXT_PUBLIC_BUILDER_ID
  ? Number(process.env.NEXT_PUBLIC_BUILDER_ID)
  : null;

/**
 * Calls POST /login with the Magic DID token, then GET /users to fetch the
 * full user profile. Returns a UserProfile containing the proxy wallet,
 * email, and name. The `predictionsession` cookie is set by the login response.
 */
export async function loginWithMagic(didToken: string): Promise<UserProfile> {
  const body: Record<string, unknown> = {};
  if (BUILDER_ID !== null) body.builder_id = BUILDER_ID;

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

  const user = (await userRes.json()) as {
    proxy_wallet: string;
    email?: string | null;
    name?: string | null;
  };

  if (!user.proxy_wallet) throw new Error("User response missing proxy_wallet");

  return {
    proxyWallet: user.proxy_wallet,
    email: user.email ?? null,
    name: user.name ?? null,
  };
}
