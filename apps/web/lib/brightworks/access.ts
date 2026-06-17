import { buildDb } from "@/lib/db";
import { randomUUID } from "crypto";

export interface InstallerApplicationInput {
  userId: string;
  businessName: string;
  licenseNumber: string;
  contactPhone: string;
  yearsExperience: number;
  serviceArea: string;
}

export type InstallerStatus = "pending" | "approved" | "rejected";

/**
 * Returns true when the user has an installer_profiles row with
 * installer_verified = true (set by admin after approval).
 */
export async function isInstallerVerified(userId: string): Promise<boolean> {
  const db = buildDb();
  const rows = await db.query<{ installer_verified: boolean }>(
    `SELECT installer_verified
     FROM installer_profiles
     WHERE user_id = $1 AND installer_verified = true
     LIMIT 1`,
    userId,
  );
  return rows.length > 0;
}

/**
 * Returns the most recent application status for the user, or null if they
 * have never applied.
 */
export async function getInstallerApplicationStatus(
  userId: string,
): Promise<InstallerStatus | null> {
  const db = buildDb();
  const rows = await db.query<{ status: string }>(
    `SELECT status
     FROM installer_profiles
     WHERE user_id = $1
     ORDER BY created_at DESC
     LIMIT 1`,
    userId,
  );
  if (rows.length === 0) return null;
  const s = rows[0].status;
  if (s === "pending" || s === "approved" || s === "rejected") return s;
  return null;
}

/**
 * Inserts a pending installer profile for human review via @nexus/admin-console.
 * Returns the new record ID.
 */
export async function createInstallerApplication(
  input: InstallerApplicationInput,
): Promise<string> {
  const db = buildDb();
  const id = randomUUID();
  await db.execute(
    `INSERT INTO installer_profiles
       (id, user_id, status, installer_verified,
        business_name, license_number, contact_phone,
        years_experience, service_area, created_at)
     VALUES ($1, $2, 'pending', false, $3, $4, $5, $6, $7, now())`,
    id,
    input.userId,
    input.businessName,
    input.licenseNumber,
    input.contactPhone,
    input.yearsExperience,
    input.serviceArea,
  );
  return id;
}
