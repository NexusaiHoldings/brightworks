/**
 * Brightworks installer access helpers.
 *
 * Tier predicate: an account is installer-verified when a row exists in
 * installer_profiles with status = 'verified'. The application flow at
 * /installer/apply writes a 'pending' row for human review via
 * @nexus/admin-console.
 */

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { handleSession } from "@nexus/identity-and-access";
import { buildDb } from "@/lib/db";
import { buildEventBus } from "@/lib/events";

export interface InstallerUser {
  id: string;
  email: string;
  installerVerified: boolean;
}

/**
 * Resolve the current session user and their installer verification status.
 * Returns null for anonymous visitors or invalid sessions.
 */
export async function getCurrentUser(): Promise<InstallerUser | null> {
  const token = cookies().get("session_token")?.value;
  if (!token) return null;

  let sessionBody: { user_id?: string; email?: string };
  try {
    const result = await handleSession({
      authorizationHeader: `Bearer ${token}`,
      ctx: { db: buildDb(), events: buildEventBus() },
    });
    if (
      result.status !== 200 ||
      typeof result.body !== "object" ||
      result.body === null
    ) {
      return null;
    }
    sessionBody = result.body as { user_id?: string; email?: string };
  } catch {
    return null;
  }

  if (!sessionBody.email || !sessionBody.user_id) return null;

  const db = buildDb();
  let installerVerified = false;
  try {
    const rows = await db.query<{ status: string }>(
      "SELECT status FROM installer_profiles WHERE user_id = $1::uuid AND status = 'verified' LIMIT 1",
      sessionBody.user_id,
    );
    installerVerified = rows.length > 0;
  } catch {
    // Table may not exist in local dev; treat missing table as unverified
    installerVerified = false;
  }

  return {
    id: sessionBody.user_id,
    email: sessionBody.email,
    installerVerified,
  };
}

/**
 * Gate for installer-only pages.
 * Redirects unauthenticated visitors to login and unverified accounts to
 * the /installer/apply application flow.
 */
export async function requireInstallerAccess(): Promise<InstallerUser> {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/api/auth/login?callbackUrl=/installer");
  }
  if (!user.installerVerified) {
    redirect("/installer/apply");
  }
  return user;
}

/**
 * Compute the wholesale price from a retail price.
 * Applies the flat 20% volume discount defined in the CEO briefing MVP scope.
 */
export function wholesalePrice(retailPrice: number): number {
  return Math.round(retailPrice * 0.8 * 100) / 100;
}
