/**
 * /installer/apply — Installer partner application flow.
 *
 * Collects business credentials and writes a pending installer_profiles row
 * for human review via the admin-console. On approval, @nexus/organizations-and-teams
 * RBAC assigns the 'installer' role and sets installer_verified=true.
 */

import type { JSX } from "react";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/admin-auth";
import {
  createInstallerApplication,
  getInstallerStatusForUser,
} from "@/lib/brightworks/access";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

async function submitApplication(formData: FormData): Promise<void> {
  "use server";

  const user = await getSessionUser();
  if (!user) {
    redirect("/login?next=/installer/apply");
  }

  const businessName = ((formData.get("businessName") as string) ?? "").trim();
  const businessType = ((formData.get("businessType") as string) ?? "").trim();
  const licenseNumber = ((formData.get("licenseNumber") as string) ?? "").trim();
  const yearsStr = ((formData.get("yearsInBusiness") as string) ?? "0").trim();
  const phone = ((formData.get("phone") as string) ?? "").trim();
  const serviceArea = ((formData.get("serviceArea") as string) ?? "").trim();

  if (!businessName || !businessType || !licenseNumber || !phone || !serviceArea) {
    redirect("/installer/apply?error=missing_fields");
  }

  const yearsInBusiness = Math.max(0, parseInt(yearsStr, 10) || 0);

  await createInstallerApplication({
    userId: user.id,
    businessName,
    businessType,
    licenseNumber,
    yearsInBusiness,
    phone,
    serviceArea,
  });

  redirect("/installer/apply?submitted=1");
}

interface PageProps {
  searchParams: Record<string, string | string[] | undefined>;
}

export default async function InstallerApplyPage({
  searchParams,
}: PageProps): Promise<JSX.Element> {
  const user = await getSessionUser();

  if (!user) {
    return (
      <main>
        <h1>Apply for Installer Account</h1>
        <p>Join our network of verified installer partners and access exclusive wholesale pricing.</p>
        <div className="empty">
          <p>
            Please{" "}
            <a href="/login?next=/installer/apply">log in</a> to apply for
            wholesale installer access.
          </p>
        </div>
      </main>
    );
  }

  const { verified, applicationStatus } = await getInstallerStatusForUser(user.id);

  if (verified || applicationStatus === "approved") {
    return (
      <main>
        <h1>Apply for Installer Account</h1>
        <p>Your installer account is already active.</p>
        <div className="card">
          <p>
            Your wholesale access is enabled.{" "}
            <a href="/installer">View wholesale pricing →</a>
          </p>
        </div>
      </main>
    );
  }

  if (applicationStatus === "pending") {
    return (
      <main>
        <h1>Application Under Review</h1>
        <p>Your installer application is pending approval.</p>
        <div className="card">
          <p>
            Our partner team will contact you within 2–3 business days to
            verify your credentials and activate your wholesale account.
          </p>
          <p className="muted">
            Questions?{" "}
            <a href="mailto:partners@usebrightworks.com">
              partners@usebrightworks.com
            </a>
          </p>
        </div>
      </main>
    );
  }

  const submitted = searchParams.submitted === "1";
  const hasError = searchParams.error === "missing_fields";

  if (submitted) {
    return (
      <main>
        <h1>Application Submitted</h1>
        <p>Thank you for applying to become a Brightworks installer partner.</p>
        <div className="card">
          <p>
            Your application has been received and is pending review. Our
            partner team will reach out within 2–3 business days.
          </p>
          <p className="muted">
            Questions?{" "}
            <a href="mailto:partners@usebrightworks.com">
              partners@usebrightworks.com
            </a>
          </p>
        </div>
      </main>
    );
  }

  return (
    <main>
      <h1>Apply for Installer Account</h1>
      <p>
        Join our network of verified installer partners and unlock{" "}
        <strong>20% below retail</strong> on all Brightworks products.
        All applications are reviewed by our partner team.
      </p>

      {hasError && (
        <div role="alert" style={{ color: "var(--color-error, #b91c1c)", marginBottom: "1rem" }}>
          Please fill in all required fields before submitting.
        </div>
      )}

      {applicationStatus === "rejected" && (
        <div className="card" style={{ marginBottom: "1.5rem" }}>
          <p>
            Your previous application was not approved. You may reapply below
            or contact{" "}
            <a href="mailto:partners@usebrightworks.com">
              partners@usebrightworks.com
            </a>{" "}
            to discuss eligibility.
          </p>
        </div>
      )}

      <form action={submitApplication}>
        <div>
          <label htmlFor="businessName">Business Name *</label>
          <input
            id="businessName"
            name="businessName"
            type="text"
            required
            placeholder="ABC Roofing LLC"
            autoComplete="organization"
          />
        </div>

        <div>
          <label htmlFor="businessType">Business Type *</label>
          <select id="businessType" name="businessType" required>
            <option value="">Select a business type</option>
            <option value="roofing_contractor">Roofing Contractor</option>
            <option value="general_contractor">General Contractor</option>
            <option value="siding_installer">Siding Installer</option>
            <option value="window_door_dealer">Window &amp; Door Dealer</option>
            <option value="gutter_specialist">Gutter Specialist</option>
            <option value="home_improvement_dealer">
              Home Improvement Dealer
            </option>
            <option value="other">Other</option>
          </select>
        </div>

        <div>
          <label htmlFor="licenseNumber">
            Contractor License / Registration Number *
          </label>
          <input
            id="licenseNumber"
            name="licenseNumber"
            type="text"
            required
            placeholder="State-issued license or registration number"
          />
        </div>

        <div>
          <label htmlFor="yearsInBusiness">Years in Business</label>
          <input
            id="yearsInBusiness"
            name="yearsInBusiness"
            type="number"
            min="0"
            max="150"
            placeholder="5"
          />
        </div>

        <div>
          <label htmlFor="phone">Business Phone *</label>
          <input
            id="phone"
            name="phone"
            type="tel"
            required
            placeholder="(555) 555-5555"
            autoComplete="tel"
          />
        </div>

        <div>
          <label htmlFor="serviceArea">Primary Service Area *</label>
          <input
            id="serviceArea"
            name="serviceArea"
            type="text"
            required
            placeholder="e.g. Dallas–Fort Worth Metro, TX"
          />
        </div>

        <button type="submit">Submit Application</button>
      </form>

      <p className="muted" style={{ marginTop: "1.5rem" }}>
        By submitting, you confirm that the information provided is accurate and
        that you hold a valid contractor license in your jurisdiction.
        Approval typically takes 2–3 business days.
      </p>
    </main>
  );
}
