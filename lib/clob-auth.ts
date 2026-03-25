import type { MagicLike } from "./allowance-relayer";

export interface ClobCredentials {
  apiKey: string;
  secret: string;
  passphrase: string;
}

export async function getOrDeriveClobCredentials(
  magic: MagicLike
): Promise<ClobCredentials> {
  const info = await magic.user.getInfo();
  const eoaAddress = info.wallets?.ethereum?.publicAddress;
  if (!eoaAddress) throw new Error("No Magic wallet address found");

  const cacheKey = `clob_auth_${eoaAddress.toLowerCase()}`;
  const cached = localStorage.getItem(cacheKey);
  if (cached) {
    try {
      const parsed = JSON.parse(cached) as ClobCredentials;
      if (parsed.apiKey && parsed.secret && parsed.passphrase) {
        return parsed;
      }
    } catch (e) {
      console.warn("Failed to parse cached clob credentials", e);
    }
  }

  const chainId = Number(process.env.NEXT_PUBLIC_CHAIN_ID || "80002");
  const timestamp = Date.now().toString();
  const nonce = "0";
  const messageText = "This message attests that I control the given wallet";

  const domain = {
    name: "ClobAuthDomain",
    version: "1",
    chainId: chainId,
  };

  const types = {
    EIP712Domain: [
      { name: "name", type: "string" },
      { name: "version", type: "string" },
      { name: "chainId", type: "uint256" },
    ],
    ClobAuth: [
      { name: "address", type: "address" },
      { name: "timestamp", type: "string" },
      { name: "nonce", type: "uint256" },
      { name: "message", type: "string" },
    ],
  };

  const message = {
    address: eoaAddress,
    timestamp,
    nonce: Number.parseInt(nonce, 10),
    message: messageText,
  };

  const typedData = {
    types,
    domain,
    primaryType: "ClobAuth",
    message,
  };

  const signature = await magic.rpcProvider.request({
    method: "eth_signTypedData_v4",
    params: [eoaAddress, JSON.stringify(typedData)],
  });

  const apiUrl = process.env.NEXT_PUBLIC_CLOB_API_URL;
  if (!apiUrl) throw new Error("NEXT_PUBLIC_CLOB_API_URL is not set");

  const headers = {
    PREDICTION_ADDRESS: eoaAddress,
    PREDICTION_TIMESTAMP: timestamp,
    PREDICTION_NONCE: nonce,
    PREDICTION_SIGNATURE: signature,
  };

  let res = await fetch(`${apiUrl}/auth/derive-api-key`, { headers });
  
  if (res.status === 404) {
    res = await fetch(`${apiUrl}/auth/api-key`, {
      method: "POST",
      headers,
    });
  }

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Failed to derive CLOB credentials: ${res.status} ${errorText}`);
  }

  const credentials = (await res.json()) as ClobCredentials;
  localStorage.setItem(cacheKey, JSON.stringify(credentials));
  return credentials;
}
