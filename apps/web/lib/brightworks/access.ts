/**
 * Brightworks installer access predicates.
 *
 * Enforces the installer_verified gate for the wholesale portal and provides
 * helpers for reading / writing installer_profiles records.
 * The 20% wholesale discount is applied via applyWholesaleDiscount().
 */

import { buildDb } from "@/lib/db";

export interface InstallerApplicationData {
  userId: string;
  companyName: string;
  licenseNumber: string;
  phone: string;
  serviceArea: string;
}

export interface InstallerApplicationRow {
  id: string;
  user_id: string;
  company_name: string;
  license_number: string;
  phone: string;
  service_area: string;
  installer_verified: boolean;
  status: string;
  created_at: string;
}

/**
 * Returns true if the given user has installer_verified=true in installer_profiles.
 * Used by the wholesale portal page to gate access.
 */
export async function isInstallerVerified(userId: string): Promise<boolean> {
  const db = buildDb();
  const rows = await db.query<{ installer_verified: boolean }>(
    `SELECT installer_verified FROM installer_profiles
     WHERE user_id = $1::uuid AND installer_verified = true LIMIT 1`,
    userId,
  );
  return rows.length > 0;
}

/**
 * Returns the existing installer application row for the user, or null if none exists.
 */
export async function getInstallerApplication(
  userId: string,
): Promise<InstallerApplicationRow | null> {
  const db = buildDb();
  const rows = await db.query<InstallerApplicationRow>(
    `SELECT id, user_id, company_name, license_number, phone, service_area,
            installer_verified, status, created_at
     FROM installer_profiles
     WHERE user_id = $1::uuid LIMIT 1`,
    userId,
  );
  return rows.length > 0 ? rows[0] : null;
}

/**
 * Writes a new pending installer application to installer_profiles.
 * Throws if the DB insert fails (e.g. duplicate user_id).
 */
export async function createInstallerApplication(
  data: InstallerApplicationData,
): Promise<void> {
  const db = buildDb();
  const id = crypto.randomUUID();
  await db.execute(
    `INSERT INTO installer_profiles
       (id, user_id, company_name, license_number, phone, service_area,
        installer_verified, status, created_at, updated_at)
     VALUES ($1::uuid, $2::uuid, $3, $4, $5, $6, false, 'pending', NOW(), NOW())`,
    id,
    data.userId,
    data.companyName,
    data.licenseNumber,
    data.phone,
    data.serviceArea,
  );
}

/**
 * Applies the 20% wholesale volume discount to a retail price in cents.
 * Returns the discounted price rounded to the nearest cent.
 */
export function applyWholesaleDiscount(retailCents: number): number {
  return Math.round(retailCents * 0.8);
}
