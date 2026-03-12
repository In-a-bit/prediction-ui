const GAMMA_API_URL =
  process.env.NEXT_PUBLIC_GAMMA_API_URL ?? "http://localhost:8084";

const BUILDER_ID = process.env.NEXT_PUBLIC_BUILDER_ID
  ? Number(process.env.NEXT_PUBLIC_BUILDER_ID)
  : null;

/**
 * Calls POST /login on the gamma-api with the Magic DID token.
 * Returns the on-chain wallet address for the authenticated user.
 * Also sets the `predictionsession` cookie on the browser (HttpOnly, via Set-Cookie header).
 */
export async function loginWithMagic(didToken: string): Promise<string> {
  const body: Record<string, unknown> = {};
  if (BUILDER_ID !== null) body.builder_id = BUILDER_ID;

  const res = await fetch(`${GAMMA_API_URL}/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${didToken}`,
    },
    body: JSON.stringify(body),
    credentials: "include", // sends/receives cookies cross-origin
  });

  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(`Login failed (${res.status}): ${errBody}`);
  }

  const data = (await res.json()) as { address: string };
  if (!data.address) throw new Error("Login response missing address");
  return data.address;
}
