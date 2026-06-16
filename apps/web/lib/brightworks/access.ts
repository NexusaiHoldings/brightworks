import { buildDb } from "@/lib/db";
import { getSessionUser } from "@/lib/admin-auth";

export interface InstallerUser {
  id: string;
  email: string;
}

export type ApplicationStatus = "pending" | "approved" | "rejected" | "none";

export interface InstallerAccess {
  user: InstallerUser;
  isVerified: boolean;
  applicationStatus: ApplicationStatus;
}

export async function isInstallerVerified(userId: string): Promise<boolean> {
  const db = buildDb();
  try {
    const rows = await db.query<{ status: string }>(
      "SELECT status FROM installer_applications WHERE user_id = $1::uuid AND status = 'approved' LIMIT 1",
      userId,
    );
    return rows.length > 0;
  } catch {
    return false;
  }
}

export async function getApplicationStatus(userId: string): Promise<ApplicationStatus> {
  const db = buildDb();
  try {
    const rows = await db.query<{ status: string }>(
      "SELECT status FROM installer_applications WHERE user_id = $1::uuid ORDER BY created_at DESC LIMIT 1",
      userId,
    );
    if (rows.length === 0) return "none";
    const status = rows[0].status;
    if (status === "pending" || status === "approved" || status === "rejected") {
      return status;
    }
    return "none";
  } catch {
    return "none";
  }
}

export async function submitInstallerApplication(
  userId: string,
  companyName: string,
  phone: string,
  licenseNumber: string,
  yearsExperience: number,
): Promise<{ success: boolean; error?: string }> {
  const db = buildDb();
  try {
    await db.execute(
      `CREATE TABLE IF NOT EXISTS installer_applications (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL,
        company_name TEXT NOT NULL,
        phone TEXT NOT NULL,
        license_number TEXT NOT NULL,
        years_experience INTEGER NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`,
    );
    const existing = await db.query<{ id: string }>(
      "SELECT id FROM installer_applications WHERE user_id = $1::uuid LIMIT 1",
      userId,
    );
    if (existing.length > 0) {
      return { success: false, error: "An application has already been submitted for this account." };
    }
    await db.execute(
      "INSERT INTO installer_applications (user_id, company_name, phone, license_number, years_experience) " +
        "VALUES ($1::uuid, $2, $3, $4, $5)",
      userId,
      companyName,
      phone,
      licenseNumber,
      yearsExperience,
    );
    return { success: true };
  } catch {
    return { success: false, error: "Failed to submit application. Please try again." };
  }
}

export async function getInstallerAccess(): Promise<InstallerAccess | null> {
  const user = await getSessionUser();
  if (!user) return null;
  const applicationStatus = await getApplicationStatus(user.id);
  const isVerified = applicationStatus === "approved";
  return { user, isVerified, applicationStatus };
}
