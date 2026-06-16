import type { JSX } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getInstallerAccess, submitInstallerApplication } from "@/lib/brightworks/access";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface PageProps {
  searchParams: { submitted?: string | string[]; error?: string | string[] };
}

export default async function InstallerApplyPage({ searchParams }: PageProps): Promise<JSX.Element> {
  const access = await getInstallerAccess();

  if (!access) {
    return (
      <main>
        <h1>Apply for Installer Access</h1>
        <p>Submit an application to become a verified Brightworks installer partner.</p>
        <div className="empty">
          <p>Please log in to submit an installer application.</p>
          <Link href="/login?redirect=/installer/apply" className="btn">Log In</Link>
        </div>
      </main>
    );
  }

  if (access.applicationStatus !== "none") {
    return (
      <main>
        <h1>Apply for Installer Access</h1>
        <p>Submit an application to become a verified Brightworks installer partner.</p>
        <div className="card">
          {access.applicationStatus === "pending" && (
            <p>Your application is currently under review. We will notify you at <strong>{access.user.email}</strong> once a decision has been made.</p>
          )}
          {access.applicationStatus === "approved" && (
            <p>Your installer access is already approved.</p>
          )}
          {access.applicationStatus === "rejected" && (
            <p>Your previous application was not approved. Please contact support for assistance.</p>
          )}
          <Link href="/installer" className="btn secondary">Go to Installer Portal</Link>
        </div>
      </main>
    );
  }

  const submittedParam = Array.isArray(searchParams.submitted)
    ? searchParams.submitted[0]
    : searchParams.submitted;
  const errorParam = Array.isArray(searchParams.error)
    ? searchParams.error[0]
    : searchParams.error;

  if (submittedParam === "1") {
    return (
      <main>
        <h1>Application Submitted</h1>
        <p>Your application to join the Brightworks Installer Program has been received.</p>
        <div className="card">
          <h2>What Happens Next</h2>
          <p>Our partner relations team will review your credentials within 2–3 business days. A decision will be sent to <strong>{access.user.email}</strong>.</p>
          <Link href="/" className="btn secondary">Return Home</Link>
        </div>
      </main>
    );
  }

  async function applyAction(formData: FormData): Promise<void> {
    "use server";

    const sessionAccess = await getInstallerAccess();
    if (!sessionAccess) redirect("/login?redirect=/installer/apply");

    const companyName = ((formData.get("company_name") as string) ?? "").trim();
    const phone = ((formData.get("phone") as string) ?? "").trim();
    const licenseNumber = ((formData.get("license_number") as string) ?? "").trim();
    const yearsRaw = ((formData.get("years_experience") as string) ?? "0").trim();
    const yearsExperience = parseInt(yearsRaw, 10);

    if (!companyName || !phone || !licenseNumber || Number.isNaN(yearsExperience) || yearsExperience < 0) {
      redirect("/installer/apply?error=missing_fields");
    }

    const result = await submitInstallerApplication(
      sessionAccess.user.id,
      companyName,
      phone,
      licenseNumber,
      yearsExperience,
    );

    if (!result.success) {
      redirect("/installer/apply?error=submit_failed");
    }

    redirect("/installer/apply?submitted=1");
  }

  const errorMessage =
    errorParam === "missing_fields"
      ? "Please fill in all required fields."
      : errorParam === "submit_failed"
      ? "There was a problem submitting your application. Please try again."
      : null;

  return (
    <main>
      <h1>Apply for Installer Access</h1>
      <p>Become a verified Brightworks installer partner and unlock 20% wholesale pricing on our full product catalog.</p>
      {errorMessage && (
        <div className="card">
          <p>{errorMessage}</p>
        </div>
      )}
      <form action={applyAction}>
        <label htmlFor="company_name">Company Name *</label>
        <input
          type="text"
          id="company_name"
          name="company_name"
          required
          placeholder="Acme Roofing & Siding LLC"
        />
        <label htmlFor="phone">Business Phone *</label>
        <input
          type="tel"
          id="phone"
          name="phone"
          required
          placeholder="(555) 000-0000"
        />
        <label htmlFor="license_number">Contractor License Number *</label>
        <input
          type="text"
          id="license_number"
          name="license_number"
          required
          placeholder="CGC-123456"
        />
        <label htmlFor="years_experience">Years of Experience *</label>
        <input
          type="number"
          id="years_experience"
          name="years_experience"
          min="0"
          max="60"
          required
          placeholder="5"
        />
        <button type="submit">Submit Application</button>
      </form>
      <p className="muted">Applications are reviewed manually by our partner relations team. By submitting, you confirm that the information provided is accurate.</p>
    </main>
  );
}
