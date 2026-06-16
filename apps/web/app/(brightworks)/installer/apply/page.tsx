/**
 * /installer/apply — Installer partner application flow.
 *
 * Collects company details and submits a pending installer profile for human
 * review via the admin-console queue. Per liability_assessor requirement,
 * all installer partners must be vetted before they represent the brand.
 * Approved accounts receive the 'installer' RBAC role via
 * @nexus/organizations-and-teams and gain access to /installer wholesale pricing.
 */

import type { JSX } from "react";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/admin-auth";
import {
  getInstallerProfile,
  createInstallerApplication,
} from "@/lib/brightworks/access";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

async function handleApply(formData: FormData): Promise<void> {
  "use server";

  const { getSessionUser: resolveUser } = await import("@/lib/admin-auth");
  const {
    createInstallerApplication: createApp,
  } = await import("@/lib/brightworks/access");

  const user = await resolveUser();
  if (!user) redirect("/login");

  const companyName = (formData.get("company_name") as string | null)?.trim() ?? "";
  const licenseNumber = (formData.get("license_number") as string | null)?.trim() ?? "";
  const yearsRaw = (formData.get("years_in_business") as string | null)?.trim() ?? "0";
  const contactName = (formData.get("contact_name") as string | null)?.trim() ?? "";
  const phone = (formData.get("phone") as string | null)?.trim() ?? "";

  if (!companyName || !contactName || !phone) {
    redirect("/installer/apply?error=missing_fields");
  }

  const yearsInBusiness = Math.max(0, parseInt(yearsRaw, 10) || 0);

  await createApp(user.id, {
    companyName,
    licenseNumber,
    yearsInBusiness,
    contactName,
    phone,
  });

  redirect("/installer/apply?submitted=true");
}

interface ApplyPageProps {
  searchParams: { submitted?: string; error?: string };
}

export default async function InstallerApplyPage({
  searchParams,
}: ApplyPageProps): Promise<JSX.Element> {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const profile = await getInstallerProfile(user.id);
  if (profile?.status === "approved") redirect("/installer");

  const submitted = searchParams.submitted === "true" || profile?.status === "pending";
  const errorKey = searchParams.error;

  if (submitted || profile?.status === "pending") {
    return (
      <main>
        <h1>Application Submitted</h1>
        <p>Thank you for applying to become a Brightworks installer partner.</p>
        <div className="card">
          <h2>What happens next?</h2>
          <ul>
            <li>Our partner team will review your application within 2 business days.</li>
            <li>You will receive an email at <strong>{user.email}</strong> with the decision.</li>
            <li>
              Once approved, you will have immediate access to wholesale pricing at
              /installer with a 20% volume discount across our full catalog.
            </li>
          </ul>
          {profile?.companyName && (
            <p className="muted">Application filed for: {profile.companyName}</p>
          )}
        </div>
        <p>
          Questions? Email{" "}
          <a href="mailto:partners@usebrightworks.com">partners@usebrightworks.com</a>.
        </p>
      </main>
    );
  }

  return (
    <main>
      <h1>Apply for Installer Account</h1>
      <p>
        Join the Brightworks Installer Partner Program for exclusive wholesale pricing,
        priority stock access, and dedicated account support. All applications are
        reviewed by our team to ensure brand quality standards.
      </p>

      {errorKey === "missing_fields" && (
        <div className="card" role="alert" style={{ borderColor: "var(--color-error, #c00)" }}>
          <p>Please fill in all required fields before submitting.</p>
        </div>
      )}

      <form action={handleApply}>
        <fieldset>
          <legend>Company Information</legend>

          <label htmlFor="company_name">
            Company Name <span aria-hidden="true">*</span>
          </label>
          <input
            id="company_name"
            name="company_name"
            type="text"
            required
            autoComplete="organization"
            placeholder="Acme Installation Services LLC"
          />

          <label htmlFor="license_number">Contractor License Number</label>
          <input
            id="license_number"
            name="license_number"
            type="text"
            autoComplete="off"
            placeholder="e.g. C-123456"
          />

          <label htmlFor="years_in_business">Years in Business</label>
          <input
            id="years_in_business"
            name="years_in_business"
            type="number"
            min="0"
            max="100"
            defaultValue="1"
          />
        </fieldset>

        <fieldset>
          <legend>Primary Contact</legend>

          <label htmlFor="contact_name">
            Full Name <span aria-hidden="true">*</span>
          </label>
          <input
            id="contact_name"
            name="contact_name"
            type="text"
            required
            autoComplete="name"
            placeholder="Jane Smith"
          />

          <label htmlFor="phone">
            Phone Number <span aria-hidden="true">*</span>
          </label>
          <input
            id="phone"
            name="phone"
            type="tel"
            required
            autoComplete="tel"
            placeholder="(555) 000-0000"
          />

          <p className="muted">
            Application email: <strong>{user.email}</strong> (your account email)
          </p>
        </fieldset>

        <p className="muted" style={{ marginTop: "1rem" }}>
          By submitting this application you confirm that your business holds all
          applicable licenses and insurance required to perform installations in
          your area of operation. Brightworks reserves the right to approve or
          decline any application at its discretion.
        </p>

        <button type="submit">Submit Application</button>
      </form>
    </main>
  );
}
