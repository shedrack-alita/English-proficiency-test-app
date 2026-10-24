import "server-only";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getCandidate } from "./data";

const COOKIE = "ept_session";
const MAX_AGE = 60 * 60 * 12; // 12 hours

type SessionPayload = { sub: number; role: "candidate" | "admin"; exp: number };

let cachedSecret: string | null = null;

function secret() {
  if (cachedSecret) return cachedSecret;
  if (process.env.EPT_SECRET) return (cachedSecret = process.env.EPT_SECRET);
  // No secret configured: generate one once and keep it next to the database.
  const file = path.join(process.cwd(), "data", ".secret");
  fs.mkdirSync(path.dirname(file), { recursive: true });
  if (!fs.existsSync(file)) fs.writeFileSync(file, randomBytes(32).toString("hex"));
  return (cachedSecret = fs.readFileSync(file, "utf8").trim());
}

function sign(value: string) {
  return createHmac("sha256", secret()).update(value).digest("base64url");
}

function encode(payload: SessionPayload) {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${body}.${sign(body)}`;
}

function decode(token: string | undefined): SessionPayload | null {
  if (!token) return null;
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  const expected = Buffer.from(sign(body));
  const actual = Buffer.from(sig);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString()) as SessionPayload;
    return payload.exp > Date.now() ? payload : null;
  } catch {
    return null;
  }
}

export async function createSession(sub: number, role: SessionPayload["role"]) {
  const store = await cookies();
  store.set(COOKIE, encode({ sub, role, exp: Date.now() + MAX_AGE * 1000 }), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE,
  });
}

export async function destroySession() {
  (await cookies()).delete(COOKIE);
}

export async function getSession() {
  return decode((await cookies()).get(COOKIE)?.value);
}

/** Returns the signed-in, active candidate or redirects to the login page. */
export async function requireCandidate() {
  const session = await getSession();
  if (!session || session.role !== "candidate") redirect("/login");
  const candidate = getCandidate(session.sub);
  if (!candidate || candidate.status !== "active") redirect("/login");
  return candidate;
}
