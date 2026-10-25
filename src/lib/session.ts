import "server-only";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getCandidate } from "./data";
import { getAdmin } from "./admin-data";

type Role = "candidate" | "admin";
type SessionPayload = { sub: number; role: Role; exp: number };

// Separate cookies so an admin and a candidate can be signed in in the same browser.
const COOKIES: Record<Role, string> = { candidate: "ept_session", admin: "ept_admin" };
const MAX_AGE = 60 * 60 * 12; // 12 hours

let cachedSecret: string | null = null;

function secret() {
  if (cachedSecret) return cachedSecret;
  if (process.env.EPT_SECRET) return (cachedSecret = process.env.EPT_SECRET);
  if (process.env.NETLIFY || process.env.VERCEL) {
    throw new Error("EPT_SECRET is not set. Add a long random string to the site's environment variables.");
  }
  // Local development without a configured secret: generate one once and keep it in data/.
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

function decode(token: string | undefined, role: Role): SessionPayload | null {
  if (!token) return null;
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  const expected = Buffer.from(sign(body));
  const actual = Buffer.from(sig);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString()) as SessionPayload;
    return payload.exp > Date.now() && payload.role === role ? payload : null;
  } catch {
    return null;
  }
}

export async function createSession(sub: number, role: Role) {
  const store = await cookies();
  store.set(COOKIES[role], encode({ sub, role, exp: Date.now() + MAX_AGE * 1000 }), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE,
  });
}

export async function destroySession(role: Role) {
  (await cookies()).delete(COOKIES[role]);
}

export async function getSession(role: Role = "candidate") {
  return decode((await cookies()).get(COOKIES[role])?.value, role);
}

/** Returns the signed-in, active candidate or redirects to the login page. */
export async function requireCandidate() {
  const session = await getSession("candidate");
  if (!session) redirect("/login");
  const candidate = await getCandidate(session.sub);
  if (!candidate || candidate.status !== "active") redirect("/login");
  return candidate;
}

/** Returns the signed-in admin or redirects to the admin login page. */
export async function requireAdmin() {
  const session = await getSession("admin");
  if (!session) redirect("/admin/login");
  const admin = await getAdmin(session.sub);
  if (!admin) redirect("/admin/login");
  return admin;
}
