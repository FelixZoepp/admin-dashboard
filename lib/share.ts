import { createHmac, randomBytes } from "crypto";

const SECRET = process.env.SHARE_LINK_SECRET ?? "dev-secret-change-me";

export type SharePayload = {
  tab: string;
  expiresAt: number;
  id: string;
};

function base64url(input: Buffer | string) {
  return Buffer.from(input)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function fromBase64url(s: string) {
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  return Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/") + pad, "base64");
}

export function createShareToken(tab: string, ttlHours = 168): string {
  const payload: SharePayload = {
    tab,
    expiresAt: Date.now() + ttlHours * 3600_000,
    id: randomBytes(8).toString("hex"),
  };
  const body = base64url(JSON.stringify(payload));
  const sig = base64url(
    createHmac("sha256", SECRET).update(body).digest(),
  );
  return `${body}.${sig}`;
}

export function verifyShareToken(token: string): SharePayload | null {
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  const expected = base64url(
    createHmac("sha256", SECRET).update(body).digest(),
  );
  if (expected !== sig) return null;
  try {
    const payload = JSON.parse(fromBase64url(body).toString()) as SharePayload;
    if (payload.expiresAt < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}
