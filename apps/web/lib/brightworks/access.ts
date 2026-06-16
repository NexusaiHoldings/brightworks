import { buildDb } from "@/lib/db";

export interface InstallerStatus {
  verified: boolean;
  hasPendingApplication: boolean;
  applicationId: string | null;
}

export interface InstallerApplicationData {
  userId: string;
  businessName: string;
  contactName: string;
  contactEmail: string;
  phone: string;
  address: string;
  licenseNumber: string;
  yearsExperience: number;
  notes: string;
}

/**
 * Returns true only when the user has an approved installer application
 * (installer_verified predicate per ceo_briefing MVP scope).
 */
export async function isInstallerVerified(userId: string): Promise<boolean> {
  const db = buildDb();
  const rows = await db.query<{ id: string }>(
    "SELECT id FROM installer_applications WHERE user_id = $1 AND status = 'approved' LIMIT 1",
    userId,
  );
  return rows.length > 0;
}

/**
 * Returns the full installer tier status for a user including pending state.
 */
export async function getInstallerStatus(userId: string): Promise<InstallerStatus> {
  const db = buildDb();
  const rows = await db.query<{ id: string; status: string }>(
    "SELECT id, status FROM installer_applications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1",
    userId,
  );
  if (rows.length === 0) {
    return { verified: false, hasPendingApplication: false, applicationId: null };
  }
  const row = rows[0];
  return {
    verified: row.status === "approved",
    hasPendingApplication: row.status === "pending",
    applicationId: row.id,
  };
}

/**
 * Writes or updates a pending installer application for human review via the
 * admin console. Returns the application ID. Already-approved accounts are
 * returned as-is without overwriting their status.
 */
export async function submitInstallerApplication(
  data: InstallerApplicationData,
): Promise<string> {
  const db = buildDb();

  const existing = await db.query<{ id: string; status: string }>(
    "SELECT id, status FROM installer_applications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1",
    data.userId,
  );

  if (existing.length > 0 && existing[0].status === "approved") {
    return existing[0].id;
  }

  if (existing.length > 0) {
    await db.execute(
      `UPDATE installer_applications
       SET business_name = $1, contact_name = $2, contact_email = $3, phone = $4,
           address = $5, license_number = $6, years_experience = $7, notes = $8,
           status = 'pending', updated_at = NOW()
       WHERE user_id = $9`,
      data.businessName,
      data.contactName,
      data.contactEmail,
      data.phone,
      data.address,
      data.licenseNumber,
      data.yearsExperience,
      data.notes,
      data.userId,
    );
    return existing[0].id;
  }

  const newId = crypto.randomUUID();
  await db.execute(
    `INSERT INTO installer_applications
       (id, user_id, business_name, contact_name, contact_email, phone,
        address, license_number, years_experience, notes, status, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'pending', NOW(), NOW())`,
    newId,
    data.userId,
    data.businessName,
    data.contactName,
    data.contactEmail,
    data.phone,
    data.address,
    data.licenseNumber,
    data.yearsExperience,
    data.notes,
  );
  return newId;
}
