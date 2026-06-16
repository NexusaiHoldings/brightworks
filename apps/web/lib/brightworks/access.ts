/**
 * Installer tier access predicate for the Brightworks wholesale portal.
 *
 * Exposes: checkInstallerAccess (page-level gate), getInstallerStatusForUser
 * (re-usable predicate), createInstallerApplication (apply flow), and
 * wholesale-price helpers.
 */

import { buildDb } from "@/lib/db";
import { getSessionUser } from "@/lib/admin-auth";
import type { SessionUser } from "@/lib/admin-auth";

export type ApplicationStatus = "none" | "pending" | "approved" | "rejected";

export interface InstallerAccessResult {
  user: SessionUser | null;
  verified: boolean;
  applicationStatus: ApplicationStatus;
}

export interface InstallerStatusResult {
  verified: boolean;
  applicationStatus: ApplicationStatus;
}

export interface CreateApplicationParams {
  userId: string;
  businessName: string;
  businessType: string;
  licenseNumber: string;
  yearsInBusiness: number;
  phone: string;
  serviceArea: string;
}

/** 20% wholesale discount applied to all verified installer accounts. */
export const WHOLESALE_DISCOUNT = 0.2;

/** Returns the wholesale price for a given retail price. */
export function wholesalePrice(retailPrice: number): number {
  return parseFloat((retailPrice * (1 - WHOLESALE_DISCOUNT)).toFixed(2));
}

/**
 * Resolves the current session user and their installer verification status.
 * Used at the top of gated pages — no userId needed from the caller.
 */
export async function checkInstallerAccess(): Promise<InstallerAccessResult> {
  const user = await getSessionUser();
  if (!user) {
    return { user: null, verified: false, applicationStatus: "none" };
  }
  const status = await getInstallerStatusForUser(user.id);
  return { user, ...status };
}

/**
 * Queries the installer_profiles table for a given user's verification status.
 * Returns { verified: false, applicationStatus: "none" } when no row exists or
 * when the table has not yet been migrated.
 */
export async function getInstallerStatusForUser(
  userId: string,
): Promise<InstallerStatusResult> {
  const db = buildDb();
  let rows: Array<{ installer_verified: boolean; status: string }> = [];

  try {
    rows = await db.query<{ installer_verified: boolean; status: string }>(
      `SELECT installer_verified, status
         FROM installer_profiles
        WHERE user_id = $1::uuid
        ORDER BY created_at DESC
        LIMIT 1`,
      userId,
    );
  } catch {
    return { verified: false, applicationStatus: "none" };
  }

  if (rows.length === 0) {
    return { verified: false, applicationStatus: "none" };
  }

  const row = rows[0];
  const knownStatuses: ApplicationStatus[] = ["pending", "approved", "rejected"];
  const applicationStatus: ApplicationStatus = knownStatuses.includes(
    row.status as ApplicationStatus,
  )
    ? (row.status as ApplicationStatus)
    : "none";

  return {
    verified: row.installer_verified === true,
    applicationStatus,
  };
}

/**
 * Writes a pending installer application to installer_profiles.
 * The admin-console surfaces pending rows for human review before approval.
 */
export async function createInstallerApplication(
  params: CreateApplicationParams,
): Promise<{ id: string }> {
  const db = buildDb();
  const id = crypto.randomUUID();

  await db.execute(
    `INSERT INTO installer_profiles
       (id, user_id, business_name, business_type, license_number,
        years_in_business, phone, service_area,
        status, installer_verified, created_at, updated_at)
     VALUES
       ($1::uuid, $2::uuid, $3, $4, $5,
        $6, $7, $8,
        'pending', false, NOW(), NOW())
     ON CONFLICT (user_id) DO UPDATE
       SET business_name    = EXCLUDED.business_name,
           business_type    = EXCLUDED.business_type,
           license_number   = EXCLUDED.license_number,
           years_in_business = EXCLUDED.years_in_business,
           phone            = EXCLUDED.phone,
           service_area     = EXCLUDED.service_area,
           status           = 'pending',
           updated_at       = NOW()
       WHERE installer_profiles.status = 'rejected'`,
    id,
    params.userId,
    params.businessName,
    params.businessType,
    params.licenseNumber,
    params.yearsInBusiness,
    params.phone,
    params.serviceArea,
  );

  return { id };
}
