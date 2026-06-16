/**
 * Brightworks installer access tier predicate.
 *
 * Determines whether the current session user holds verified installer status
 * (checked via @nexus/organizations-and-teams RBAC role 'installer') and
 * manages the installer application lifecycle stored in installer_applications.
 */

import { cookies } from "next/headers";
import { handleSession } from "@nexus/identity-and-access";
import { buildDb } from "@/lib/db";
import { buildEventBus } from "@/lib/events";

export interface InstallerUser {
  id: string;
  email: string;
}

export interface InstallerApplication {
  id: string;
  user_id: string;
  company_name: string;
  business_type: string;
  phone: string;
  status: string;
  created_at: string;
}

export interface ApplicationData {
  company_name: string;
  business_type: string;
  license_number: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  years_experience: number;
  annual_volume: string;
  notes: string;
}

export interface SubmitResult {
  success: boolean;
  error?: string;
  id?: string;
}

async function ensureApplicationsTable(): Promise<void> {
  const db = buildDb();
  await db.execute(
    `CREATE TABLE IF NOT EXISTS installer_applications (
       id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
       user_id       TEXT        NOT NULL,
       company_name  TEXT        NOT NULL,
       business_type TEXT        NOT NULL,
       license_number TEXT,
       phone         TEXT        NOT NULL,
       address       TEXT        NOT NULL,
       city          TEXT        NOT NULL,
       state         TEXT        NOT NULL,
       zip           TEXT        NOT NULL,
       years_experience INTEGER  NOT NULL DEFAULT 0,
       annual_volume TEXT        NOT NULL,
       notes         TEXT,
       status        TEXT        NOT NULL DEFAULT 'pending',
       created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
       updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
     )`,
  );
}

/**
 * Resolve the current session user from the HttpOnly session cookie.
 * Returns null for anonymous or invalid sessions.
 */
export async function getInstallerSessionUser(): Promise<InstallerUser | null> {
  const token = cookies().get("session_token")?.value;
  if (!token) return null;

  let result;
  try {
    result = await handleSession({
      authorizationHeader: `Bearer ${token}`,
      ctx: { db: buildDb(), events: buildEventBus() },
    });
  } catch {
    return null;
  }

  if (
    result.status !== 200 ||
    typeof result.body !== "object" ||
    result.body === null
  ) {
    return null;
  }

  const body = result.body as { user_id?: string; email?: string };
  if (!body.email) return null;
  return { id: body.user_id ?? "", email: body.email };
}

/**
 * Returns true when the user holds the 'installer' role in any organization,
 * which @nexus/organizations-and-teams RBAC assigns post-approval.
 */
export async function isInstallerVerified(userId: string): Promise<boolean> {
  if (!userId) return false;
  const db = buildDb();
  try {
    const rows = await db.query<{ count: string }>(
      `SELECT COUNT(*) AS count FROM org_members WHERE user_id = $1 AND role = 'installer'`,
      userId,
    );
    return parseInt(rows[0]?.count ?? "0", 10) > 0;
  } catch {
    return false;
  }
}

/**
 * Fetch the most recent installer application for a user, or null if none.
 */
export async function getInstallerApplication(
  userId: string,
): Promise<InstallerApplication | null> {
  await ensureApplicationsTable();
  const db = buildDb();
  const rows = await db.query<InstallerApplication>(
    `SELECT id,
            user_id,
            company_name,
            business_type,
            phone,
            status,
            created_at::text AS created_at
       FROM installer_applications
      WHERE user_id = $1
      ORDER BY created_at DESC
      LIMIT 1`,
    userId,
  );
  return rows[0] ?? null;
}

/**
 * Insert a new pending installer application.
 * Blocks duplicate pending submissions from the same user.
 */
export async function submitInstallerApplication(
  userId: string,
  data: ApplicationData,
): Promise<SubmitResult> {
  if (!userId) return { success: false, error: "User session not found." };

  await ensureApplicationsTable();
  const db = buildDb();

  const existing = await db.query<{ id: string }>(
    `SELECT id FROM installer_applications WHERE user_id = $1 AND status = 'pending'`,
    userId,
  );
  if (existing.length > 0) {
    return {
      success: false,
      error: "You already have a pending application under review.",
    };
  }

  try {
    const rows = await db.query<{ id: string }>(
      `INSERT INTO installer_applications
         (user_id, company_name, business_type, license_number, phone,
          address, city, state, zip, years_experience, annual_volume, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       RETURNING id`,
      userId,
      data.company_name,
      data.business_type,
      data.license_number,
      data.phone,
      data.address,
      data.city,
      data.state,
      data.zip,
      data.years_experience,
      data.annual_volume,
      data.notes,
    );
    return { success: true, id: rows[0]?.id };
  } catch (err) {
    console.error("[installer] application insert failed:", err);
    return { success: false, error: "Failed to submit application. Please try again." };
  }
}
