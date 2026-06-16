/**
 * Brightworks installer tier predicate.
 *
 * Checks installer_profiles table for verified status.
 * @nexus/organizations-and-teams RBAC assigns 'installer' role post-approval;
 * this module handles the DB-level predicate that gates the wholesale portal.
 */

import { buildDb } from "@/lib/db";

export interface InstallerProfile {
  id: string;
  user_id: string;
  company_name: string;
  contact_name: string;
  phone: string;
  message: string;
  status: "pending" | "approved" | "rejected";
  installer_verified: boolean;
  applied_at: string;
}

/**
 * Returns true if the given user has installer_verified=true in installer_profiles.
 * Returns false for any DB error or missing row (fail-closed by design).
 */
export async function isInstallerVerified(userId: string): Promise<boolean> {
  const db = buildDb();
  try {
    const rows = await db.query<{ installer_verified: boolean }>(
      "SELECT installer_verified FROM installer_profiles WHERE user_id = $1 LIMIT 1",
      userId,
    );
    return rows.length > 0 && rows[0].installer_verified === true;
  } catch {
    return false;
  }
}

/**
 * Returns the full installer profile for the user, or null if none exists.
 */
export async function getInstallerProfile(
  userId: string,
): Promise<InstallerProfile | null> {
  const db = buildDb();
  try {
    const rows = await db.query<InstallerProfile>(
      `SELECT id, user_id, company_name, contact_name, phone, message,
              status, installer_verified, applied_at
       FROM installer_profiles
       WHERE user_id = $1
       LIMIT 1`,
      userId,
    );
    return rows.length > 0 ? rows[0] : null;
  } catch {
    return null;
  }
}

/**
 * Creates or updates a pending installer application for the given user.
 * Uses ON CONFLICT to allow re-application (resets status to 'pending').
 */
export async function createInstallerApplication(params: {
  userId: string;
  companyName: string;
  contactName: string;
  phone: string;
  message: string;
}): Promise<void> {
  const db = buildDb();
  await db.execute(
    `INSERT INTO installer_profiles
       (id, user_id, company_name, contact_name, phone, message,
        status, installer_verified, applied_at)
     VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, 'pending', false, NOW())
     ON CONFLICT (user_id) DO UPDATE SET
       company_name      = EXCLUDED.company_name,
       contact_name      = EXCLUDED.contact_name,
       phone             = EXCLUDED.phone,
       message           = EXCLUDED.message,
       status            = 'pending',
       applied_at        = NOW()`,
    params.userId,
    params.companyName,
    params.contactName,
    params.phone,
    params.message,
  );
}
