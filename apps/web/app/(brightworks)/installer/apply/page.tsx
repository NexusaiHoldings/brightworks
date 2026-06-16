import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import Link from "next/link";
import { handleSession } from "@nexus/identity-and-access";
import { getSessionUser } from "@/lib/admin-auth";
import { getInstallerStatus, submitInstallerApplication } from "@/lib/brightworks/access";
import { buildDb } from "@/lib/db";
import { buildEventBus } from "@/lib/events";

async function handleApply(formData: FormData): Promise<void> {
  "use server";

  const token = cookies().get("session_token")?.value;
  if (!token) {
    redirect("/api/auth/login");
  }

  const result = await handleSession({
    authorizationHeader: `Bearer ${token}`,
    ctx: { db: buildDb(), events: buildEventBus() },
  });

  if (result.status !== 200 || typeof result.body !== "object" || result.body === null) {
    redirect("/api/auth/login");
  }

  const sessionBody = result.body as { user_id?: string; email?: string };
  const userId = sessionBody.user_id ?? "";
  if (!userId) {
    redirect("/api/auth/login");
  }

  const businessName = (formData.get("business_name") as string | null)?.trim() ?? "";
  const contactName = (formData.get("contact_name") as string | null)?.trim() ?? "";
  const contactEmail = (formData.get("contact_email") as string | null)?.trim() ?? "";
  const phone = (formData.get("phone") as string | null)?.trim() ?? "";
  const address = (formData.get("address") as string | null)?.trim() ?? "";
  const licenseNumber = (formData.get("license_number") as string | null)?.trim() ?? "";
  const yearsRaw = (formData.get("years_experience") as string | null)?.trim() ?? "0";
  const yearsExperience = Math.max(0, parseInt(yearsRaw, 10) || 0);
  const notes = (formData.get("notes") as string | null)?.trim() ?? "";

  if (!businessName || !contactName || !contactEmail || !phone || !address) {
    redirect("/installer/apply?error=missing_fields");
  }

  let submitFailed = false;
  try {
    await submitInstallerApplication({
      userId,
      businessName,
      contactName,
      contactEmail,
      phone,
      address,
      licenseNumber,
      yearsExperience,
      notes,
    });
  } catch {
    submitFailed = true;
  }

  if (submitFailed) {
    redirect("/installer/apply?error=submission_failed");
  }

  redirect("/installer?applied=1");
}

export default async function InstallerApplyPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const user = await getSessionUser();
  if (!user) {
    redirect("/api/auth/login");
  }

  const status = await getInstallerStatus(user.id);
  if (status.verified) {
    redirect("/installer");
  }

  const error = searchParams.error as string | undefined;
  const errorMessage =
    error === "missing_fields"
      ? "Please fill in all required fields before submitting."
      : error === "submission_failed"
        ? "We encountered an error saving your application. Please try again."
        : null;

  return (
    <main>
      <h1>Apply for Installer Access</h1>
      <p>
        Complete the form below to apply for a verified Brightworks installer account.
        Applications are reviewed within 1–2 business days. Once approved, you will receive
        20% wholesale pricing across the full catalog.
      </p>

      {errorMessage && (
        <div className="card" role="alert">
          <strong>Error:</strong> {errorMessage}
        </div>
      )}

      {status.hasPendingApplication && (
        <div className="card">
          <strong>Application already submitted</strong>
          <p>
            Your application is currently under review. You may update your details below and
            resubmit if needed.
          </p>
        </div>
      )}

      <form action={handleApply}>
        <fieldset>
          <legend>Business Information</legend>

          <label htmlFor="business_name">
            Business Name <span aria-hidden="true">*</span>
          </label>
          <input
            id="business_name"
            name="business_name"
            type="text"
            required
            placeholder="Acme Lighting Services LLC"
          />

          <label htmlFor="address">
            Business Address <span aria-hidden="true">*</span>
          </label>
          <input
            id="address"
            name="address"
            type="text"
            required
            placeholder="123 Main St, Springfield, IL 62701"
          />

          <label htmlFor="license_number">
            Contractor License Number
          </label>
          <input
            id="license_number"
            name="license_number"
            type="text"
            placeholder="IL-EC-123456 (optional)"
          />

          <label htmlFor="years_experience">
            Years of Holiday Lighting Experience
          </label>
          <input
            id="years_experience"
            name="years_experience"
            type="number"
            min="0"
            max="50"
            defaultValue="0"
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
            placeholder="Jane Smith"
          />

          <label htmlFor="contact_email">
            Email <span aria-hidden="true">*</span>
          </label>
          <input
            id="contact_email"
            name="contact_email"
            type="email"
            required
            defaultValue={user.email}
            placeholder="jane@acmelighting.com"
          />

          <label htmlFor="phone">
            Phone <span aria-hidden="true">*</span>
          </label>
          <input
            id="phone"
            name="phone"
            type="tel"
            required
            placeholder="(555) 555-5555"
          />
        </fieldset>

        <fieldset>
          <legend>Additional Information</legend>
          <label htmlFor="notes">
            Tell us about your business and typical install volume
          </label>
          <textarea
            id="notes"
            name="notes"
            rows={4}
            placeholder="E.g. residential installs, 30–50 homes per season, primarily in greater Chicago area..."
          />
        </fieldset>

        <p className="muted">
          Fields marked <span aria-hidden="true">*</span> are required. By submitting this
          form you agree to Brightworks installer partner terms.
        </p>

        <button type="submit">Submit Application</button>
        <Link href="/installer" className="btn secondary" style={{ marginLeft: "1rem" }}>
          Cancel
        </Link>
      </form>
    </main>
  );
}
