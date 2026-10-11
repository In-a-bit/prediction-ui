import { Chacha20Poly1305 } from "@hpke/chacha20poly1305";
import { CipherSuite, DhkemP256HkdfSha256, HkdfSha256 } from "@hpke/core";
import {
  Captcha,
  PrivyProvider,
  useCreateWallet,
  useExportWallet,
  useGetWalletPrivateKey,
  useLoginWithEmail,
  usePrivy,
} from "@privy-io/react-auth";
import { createRoot } from "react-dom/client";
import { useEffect, useRef, useState } from "react";

const appId = window.__PRIVY_APP_ID__;

function toBase64(bytes) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function fromBase64(value) {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function embeddedAddress(user) {
  const account = user?.linkedAccounts?.find(
    (item) =>
      item.type === "wallet" &&
      item.walletClientType === "privy" &&
      (item.chainType === "ethereum" || !item.chainType),
  );
  return account?.address ?? user?.wallet?.address ?? "";
}

async function recipientKeypair() {
  const pair = await crypto.subtle.generateKey(
    { name: "ECDH", namedCurve: "P-256" },
    true,
    ["deriveKey", "deriveBits"],
  );
  const spki = await crypto.subtle.exportKey("spki", pair.publicKey);
  return {
    publicKey: toBase64(new Uint8Array(spki)),
    privateKey: pair.privateKey,
  };
}

async function decryptHpke(privateKey, encapsulatedKey, ciphertext) {
  const suite = new CipherSuite({
    kem: new DhkemP256HkdfSha256(),
    kdf: new HkdfSha256(),
    aead: new Chacha20Poly1305(),
  });
  const recipient = await suite.createRecipientContext({
    recipientKey: privateKey,
    enc: fromBase64(encapsulatedKey),
  });
  const opened = await recipient.open(fromBase64(ciphertext));
  return new TextDecoder().decode(opened);
}

function ExportForm() {
  const { ready, authenticated, user, logout } = usePrivy();
  const { sendCode, loginWithCode } = useLoginWithEmail();
  const { createWallet } = useCreateWallet();
  const { exportWallet } = useExportWallet();
  const { getWalletPrivateKey } = useGetWalletPrivateKey();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [address, setAddress] = useState("");
  const [privateKey, setPrivateKey] = useState("");
  const started = useRef(false);

  async function ensureAddress() {
    const existing = embeddedAddress(user);
    if (existing) return existing;
    try {
      const created = await createWallet();
      return created.address;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (!message.toLowerCase().includes("already")) throw err;
      return embeddedAddress(user);
    }
  }

  async function exportKey() {
    setError("");
    setPrivateKey("");
    setStatus("Exporting…");
    const walletAddress = await ensureAddress();
    if (!walletAddress) throw new Error("No Privy wallet on this account");
    setAddress(walletAddress);

    try {
      const recipient = await recipientKeypair();
      const encrypted = await getWalletPrivateKey({
        address: walletAddress,
        recipientPublicKey: recipient.publicKey,
      });
      const key = await decryptHpke(
        recipient.privateKey,
        encrypted.encapsulatedKey,
        encrypted.ciphertext,
      );
      setPrivateKey(key);
      setStatus("Private key exported.");
      return;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setStatus(`${message} Opening Privy export window.`);
      await exportWallet({ address: walletAddress });
      setStatus("Privy export window closed. Copy the key from that window.");
    }
  }

  useEffect(() => {
    if (!ready || !authenticated || started.current) return;
    if (!embeddedAddress(user)) return;
    started.current = true;
    void exportKey().catch((err) => {
      setStatus("");
      setError(err instanceof Error ? err.message : String(err));
    });
  }, [ready, authenticated, user]);

  async function onSend(event) {
    event.preventDefault();
    setError("");
    setStatus("Sending code…");
    try {
      await sendCode({ email: email.trim() });
      setCodeSent(true);
      setStatus("Code sent.");
    } catch (err) {
      setStatus("");
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function onLogin(event) {
    event.preventDefault();
    setError("");
    setStatus("Logging in…");
    try {
      await loginWithCode({ code: code.trim() });
      setStatus("Logged in. Exporting wallet…");
    } catch (err) {
      setStatus("");
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  if (!ready) return <p>Loading Privy…</p>;

  if (!authenticated) {
    return (
      <form onSubmit={codeSent ? onLogin : onSend}>
        <h1>Export Privy key</h1>
        <label>
          Email
          <input
            type="email"
            autoComplete="email"
            value={email}
            required
            onChange={(event) => setEmail(event.target.value)}
          />
        </label>
        {codeSent && (
          <label>
            Code
            <input
              inputMode="numeric"
              autoComplete="one-time-code"
              value={code}
              required
              onChange={(event) => setCode(event.target.value)}
            />
          </label>
        )}
        <button type="submit">{codeSent ? "Log in and export" : "Send code"}</button>
        {status && <p>{status}</p>}
        {error && <p className="err">{error}</p>}
      </form>
    );
  }

  return (
    <section>
      <h1>Export Privy key</h1>
      <p>Address: {address || embeddedAddress(user) || "…"}</p>
      {privateKey && (
        <label>
          Private key
          <textarea readOnly value={privateKey} />
        </label>
      )}
      {status && <p>{status}</p>}
      {error && <p className="err">{error}</p>}
      <button type="button" onClick={() => void exportKey().catch((err) => setError(err instanceof Error ? err.message : String(err)))}>
        Export again
      </button>
      <button
        type="button"
        onClick={() => {
          started.current = false;
          setPrivateKey("");
          setAddress("");
          void logout();
        }}
      >
        Log out
      </button>
    </section>
  );
}

function App() {
  if (!appId || appId.includes("PRIVY_APP_ID")) {
    return <p className="err">PRIVY_APP_ID is missing.</p>;
  }
  return (
    <PrivyProvider
      appId={appId}
      config={{
        loginMethods: ["email"],
        embeddedWallets: {
          ethereum: { createOnLogin: "users-without-wallets" },
          showWalletUIs: true,
        },
      }}
    >
      <Captcha />
      <ExportForm />
    </PrivyProvider>
  );
}

createRoot(document.getElementById("root")).render(<App />);
