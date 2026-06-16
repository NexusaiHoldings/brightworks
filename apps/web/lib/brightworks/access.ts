/**
 * Installer tier predicate — enforces the wholesale portal gate.
 *
 * Accounts with an approved installer application (installer_verified=true)
 * gain access to wholesale pricing at a 20% volume discount per ceo_briefing
 * MVP scope. Human reviewers approve applications via @nexus/admin-console.
 */

import { buildDb } from "@/lib/db";

export const INSTALLER_DISCOUNT_RATE = 0.2;

export interface InstallerProfile {
  id: string;
  userId: string;
  companyName: string;
  licenseNumber: string;
  yearsInBusiness: number;
  contactName: string;
  phone: string;
  status: "pending" | "approved" | "rejected";
  createdAt: string;
}

async function ensureSchema(): Promise<void> {
  const db = buildDb();
  await db.execute(`
    CREATE TABLE IF NOT EXISTS installer_applications (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id TEXT NOT NULL,
      company_name TEXT NOT NULL,
      license_number TEXT NOT NULL DEFAULT '',
      years_in_business INTEGER NOT NULL DEFAULT 0,
      contact_name TEXT NOT NULL DEFAULT '',
      phone TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'pending',
      notes TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
}

export async function getInstallerProfile(
  userId: string
): Promise<InstallerProfile | null> {
  if (!userId) return null;
  await ensureSchema();
  const db = buildDb();
  const rows = await db.query<{
    id: string;
    user_id: string;
    company_name: string;
    license_number: string;
    years_in_business: number;
    contact_name: string;
    phone: string;
    status: string;
    created_at: string;
  }>(
    `SELECT id, user_id, company_name, license_number, years_in_business,
            contact_name, phone, status, created_at
     FROM installer_applications
     WHERE user_id = $1
     ORDER BY created_at DESC
     LIMIT 1`,
    userId
  );
  if (rows.length === 0) return null;
  const row = rows[0];
  return {
    id: row.id,
    userId: row.user_id,
    companyName: row.company_name,
    licenseNumber: row.license_number,
    yearsInBusiness: row.years_in_business,
    contactName: row.contact_name,
    phone: row.phone,
    status: row.status as "pending" | "approved" | "rejected",
    createdAt: row.created_at,
  };
}

export async function isInstallerVerified(userId: string): Promise<boolean> {
  const profile = await getInstallerProfile(userId);
  return profile?.status === "approved";
}

export async function createInstallerApplication(
  userId: string,
  data: {
    companyName: string;
    licenseNumber: string;
    yearsInBusiness: number;
    contactName: string;
    phone: string;
  }
): Promise<string> {
  await ensureSchema();
  const db = buildDb();

  const existing = await getInstallerProfile(userId);
  if (existing && existing.status === "pending") {
    return existing.id;
  }

  const rows = await db.query<{ id: string }>(
    `INSERT INTO installer_applications
       (user_id, company_name, license_number, years_in_business, contact_name, phone, status)
     VALUES ($1, $2, $3, $4, $5, $6, 'pending')
     RETURNING id`,
    userId,
    data.companyName,
    data.licenseNumber,
    data.yearsInBusiness,
    data.contactName,
    data.phone
  );
  return rows[0].id;
}

export function applyInstallerDiscount(msrp: number): number {
  return Math.round(msrp * (1 - INSTALLER_DISCOUNT_RATE) * 100) / 100;
}
