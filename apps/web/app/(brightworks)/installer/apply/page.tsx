/**
 * /installer/apply — installer partner application flow.
 *
 * Collects company name, license number, phone, and service area, then writes
 * a pending installer_profiles record for human review via @nexus/admin-console.
 * On success redirects to /installer?applied=true. Duplicate submissions (user
 * already has a record) surface the current application status instead of the
 * form.
 */

import type { JSX } from "react";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/admin-auth";
import {
  createInstallerApplication,
  getInstallerApplication,
} from "@/lib/brightworks/access";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

async function submitInstallerApplication(formData: FormData): Promise<void> {
  "use server";

  const session = await getSessionUser();
  if (!session) {
    redirect("/login?redirect=/installer/apply");
  }

  const companyName = ((formData.get("companyName") as string) ?? "").trim();
  const licenseNumber = ((formData.get("licenseNumber") as string) ?? "").trim();
  const phone = ((formData.get("phone") as string) ?? "").trim();
  const serviceArea = ((formData.get("serviceArea") as string) ?? "").trim();

  if (!companyName || !licenseNumber || !phone || !serviceArea) {
    redirect("/installer/apply?error=All+fields+are+required.");
  }

  const existing = await getInstallerApplication(session.id);
  if (existing) {
    redirect("/installer/apply?error=You+already+have+an+application+on+file.");
  }

  try {
    await createInstallerApplication({
      userId: session.id,
      companyName,
      licenseNumber,
      phone,
      serviceArea,
    });
  } catch {
    redirect("/installer/apply?error=Submission+failed.+Please+try+again.");
  }

  redirect("/installer?applied=true");
}

interface ApplyPageProps {
  searchParams: Record<string, string | string[] | undefined>;
}

export default async function InstallerApplyPage({
  searchParams,
}: ApplyPageProps): Promise<JSX.Element> {
  const user = await getSessionUser();
  if (!user) {
    redirect("/login?redirect=/installer/apply");
  }

  const existing = await getInstallerApplication(user.id);
  if (existing) {
    const statusLabel =
      existing.status === "approved"
        ? "approved"
        : existing.status === "rejected"
          ? "rejected"
          : "pending review";

    return (
      <main>
        <h1>Installer Partner Application</h1>
        <p>You have an existing application on file.</p>
        <div className="card">
          <p>
            Application status: <strong>{statusLabel}</strong>
          </p>
          <p className="muted">
            Company: {existing.company_name} &mdash; License:{" "}
            {existing.license_number}
          </p>
          {existing.status === "approved" ? (
            <a href="/installer" className="btn">
              Go to wholesale portal
            </a>
          ) : (
            <a href="/" className="btn secondary">
              Return home
            </a>
          )}
        </div>
      </main>
    );
  }

  const rawError = searchParams.error;
  const errorMessage =
    typeof rawError === "string" ? decodeURIComponent(rawError) : "";

  return (
    <main>
      <h1>Installer Partner Application</h1>
      <p>
        Apply to become a verified Brightworks installer partner and unlock 20%
        wholesale pricing across our full product catalog.
      </p>

      {errorMessage && (
        <div role="alert" className="card">
          <p style={{ color: "#b91c1c", margin: 0 }}>{errorMessage}</p>
        </div>
      )}

      <form action={submitInstallerApplication}>
        <label htmlFor="companyName">Company name</label>
        <input
          id="companyName"
          name="companyName"
          type="text"
          required
          autoComplete="organization"
          placeholder="Acme Flooring LLC"
        />

        <label htmlFor="licenseNumber">Contractor license number</label>
        <input
          id="licenseNumber"
          name="licenseNumber"
          type="text"
          required
          placeholder="e.g. C-12345678"
        />

        <label htmlFor="phone">Business phone</label>
        <input
          id="phone"
          name="phone"
          type="tel"
          required
          autoComplete="tel"
          placeholder="(555) 000-0000"
        />

        <label htmlFor="serviceArea">Primary service area</label>
        <input
          id="serviceArea"
          name="serviceArea"
          type="text"
          required
          placeholder="e.g. Austin, TX"
        />

        <p className="muted">
          Applications are reviewed by our partner team. You will receive an email
          once your account has been verified, typically within 2 business days.
        </p>

        <button type="submit" className="btn">
          Submit application
        </button>
      </form>
    </main>
  );
}
