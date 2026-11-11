/**
 * login.ts — the (fake) authentication of the demo fixture.
 *
 * Nothing here is secure: the "credentials" are hard-coded demo users and the
 * token is a counter. The point of the file is to give the repository a second,
 * independent zone (`src/auth/`) that does not collide with `src/billing/`, so
 * judges can see a `free` verdict next to a `caution` one.
 */

export type Role = "admin" | "billing" | "viewer";

export interface DemoUser {
  email: string;
  name: string;
  role: Role;
  /** Plain text on purpose: demo fixture, never copy this. */
  password: string;
}

export interface Session {
  token: string;
  email: string;
  name: string;
  role: Role;
  issuedAt: string;
  expiresAt: string;
}

export const DEMO_USERS: readonly DemoUser[] = Object.freeze([
  { email: "lea@acme.test", name: "Léa", role: "admin", password: "demo-admin" },
  { email: "sam@acme.test", name: "Sam", role: "billing", password: "demo-billing" },
  { email: "visitor@acme.test", name: "Visitor", role: "viewer", password: "demo-viewer" },
]);

const SESSION_TTL_MS = 30 * 60 * 1000;
const sessions = new Map<string, Session>();
let tokenSequence = 0;

function nextToken(email: string): string {
  tokenSequence += 1;
  const suffix = email.replace(/[^a-z0-9]/gi, "").slice(0, 8).toLowerCase();
  return `tok_${suffix}_${String(tokenSequence).padStart(4, "0")}`;
}

/** Return a session, or null when the credentials are unknown. */
export function login(email: string, password: string, now: Date = new Date()): Session | null {
  const user = DEMO_USERS.find(
    (candidate) => candidate.email.toLowerCase() === email.trim().toLowerCase(),
  );
  if (!user || user.password !== password) return null;
  const expires = new Date(now.getTime() + SESSION_TTL_MS);
  const session: Session = {
    token: nextToken(user.email),
    email: user.email,
    name: user.name,
    role: user.role,
    issuedAt: now.toISOString(),
    expiresAt: expires.toISOString(),
  };
  sessions.set(session.token, session);
  return session;
}

export function sessionFor(token: string, now: Date = new Date()): Session | undefined {
  const session = sessions.get(token);
  if (!session) return undefined;
  if (now.toISOString() > session.expiresAt) {
    sessions.delete(token);
    return undefined;
  }
  return session;
}

export function logout(token: string): boolean {
  return sessions.delete(token);
}

/** Role check: admin passes everything, billing passes billing and viewer. */
export function can(session: Session, required: Role): boolean {
  const order: readonly Role[] = ["viewer", "billing", "admin"];
  return order.indexOf(session.role) >= order.indexOf(required);
}

export function activeSessionCount(): number {
  return sessions.size;
}
