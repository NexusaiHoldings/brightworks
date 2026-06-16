import type { JSX } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  getInstallerSessionUser,
  isInstallerVerified,
  getInstallerApplication,
  submitInstallerApplication,
} from "@/lib/brightworks/access";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

async function applyAction(formData: FormData): Promise<void> {
  "use server";

  const user = await getInstallerSessionUser();
  if (!user) {
    redirect("/login?redirect=/installer/apply");
  }

  const yearsRaw = formData.get("years_experience");
  const years = yearsRaw ? parseInt(String(yearsRaw), 10) : 0;

  const result = await submitInstallerApplication(user.id, {
    company_name: String(formData.get("company_name") ?? "").trim(),
    business_type: String(formData.get("business_type") ?? "").trim(),
    license_number: String(formData.get("license_number") ?? "").trim(),
    phone: String(formData.get("phone") ?? "").trim(),
    address: String(formData.get("address") ?? "").trim(),
    city: String(formData.get("city") ?? "").trim(),
    state: String(formData.get("state") ?? "").trim(),
    zip: String(formData.get("zip") ?? "").trim(),
    years_experience: isNaN(years) ? 0 : years,
    annual_volume: String(formData.get("annual_volume") ?? "").trim(),
    notes: String(formData.get("notes") ?? "").trim(),
  });

  if (result.success) {
    redirect("/installer/apply?submitted=true");
  } else {
    const msg = encodeURIComponent(result.error ?? "Submission failed.");
    redirect(`/installer/apply?error=${msg}`);
  }
}

interface PageProps {
  searchParams?: Record<string, string | string[] | undefined>;
}

export default async function InstallerApplyPage({
  searchParams,
}: PageProps): Promise<JSX.Element> {
  const submitted = searchParams?.submitted === "true";
  const errorMsg = typeof searchParams?.error === "string" ? searchParams.error : null;

  const user = await getInstallerSessionUser();

  if (!user) {
    return (
      <main>
        <h1>Apply for Installer Access</h1>
        <p>Become a certified Brightworks installer partner and unlock exclusive wholesale pricing.</p>
        <p>
          <Link href="/login?redirect=/installer/apply" className="btn">
            Sign in to apply
          </Link>
        </p>
      </main>
    );
  }

  const verified = await isInstallerVerified(user.id);
  if (verified) {
    return (
      <main>
        <h1>Already Verified</h1>
        <p>Your account already has verified installer access.</p>
        <p>
          <Link href="/installer" className="btn">
            Go to Wholesale Portal
          </Link>
        </p>
      </main>
    );
  }

  if (submitted) {
    return (
      <main>
        <h1>Application Submitted</h1>
        <div className="card">
          <p>
            Thank you! Your installer application has been received and is pending review by the
            Brightworks team.
          </p>
          <p>We typically review applications within 2–3 business days.</p>
          <p>
            Questions? Email{" "}
            <a href="mailto:partners@usebrightworks.com">partners@usebrightworks.com</a>
          </p>
        </div>
        <p>
          <Link href="/" className="btn secondary">
            Return to Home
          </Link>
        </p>
      </main>
    );
  }

  const existing = await getInstallerApplication(user.id);

  if (existing && existing.status === "pending") {
    return (
      <main>
        <h1>Application Under Review</h1>
        <div className="card">
          <p>
            Your application for <strong>{existing.company_name}</strong> was submitted on{" "}
            {new Date(existing.created_at).toLocaleDateString("en-US", {
              year: "numeric",
              month: "long",
              day: "numeric",
            })}{" "}
            and is currently <strong>pending review</strong>.
          </p>
          <p>
            Questions? Contact{" "}
            <a href="mailto:partners@usebrightworks.com">partners@usebrightworks.com</a>
          </p>
        </div>
        <p>
          <Link href="/" className="btn secondary">
            Return to Home
          </Link>
        </p>
      </main>
    );
  }

  if (existing && existing.status === "rejected") {
    return (
      <main>
        <h1>Application Not Approved</h1>
        <div className="card">
          <p>
            Your previous application was not approved. Please contact{" "}
            <a href="mailto:partners@usebrightworks.com">partners@usebrightworks.com</a> for
            more information.
          </p>
        </div>
        <p>
          <Link href="/" className="btn secondary">
            Return to Home
          </Link>
        </p>
      </main>
    );
  }

  return (
    <main>
      <h1>Apply for Installer Access</h1>
      <p>
        Complete this form to apply for the Brightworks installer program. Approved partners
        receive 20% wholesale pricing, dedicated account support, and co-marketing resources.
      </p>

      {errorMsg && (
        <div role="alert" style={{ padding: "0.75rem 1rem", background: "#fee2e2", color: "#991b1b", borderRadius: 6, marginBottom: "1rem" }}>
          {errorMsg}
        </div>
      )}

      <form action={applyAction}>
        <h2>Business Information</h2>

        <div className="card">
          <label htmlFor="company_name">Company Name *</label>
          <input
            id="company_name"
            name="company_name"
            type="text"
            required
            placeholder="Acme Irrigation & Landscaping"
          />

          <label htmlFor="business_type">Business Type *</label>
          <select id="business_type" name="business_type" required>
            <option value="">Select…</option>
            <option value="landscaping">Landscaping / Irrigation Contractor</option>
            <option value="general_contractor">General Contractor</option>
            <option value="hvac">HVAC / Electrical Contractor</option>
            <option value="distributor">Distributor / Reseller</option>
            <option value="other">Other</option>
          </select>

          <label htmlFor="license_number">Contractor License Number</label>
          <input
            id="license_number"
            name="license_number"
            type="text"
            placeholder="Optional"
          />

          <label htmlFor="phone">Business Phone *</label>
          <input
            id="phone"
            name="phone"
            type="tel"
            required
            placeholder="(555) 000-0000"
          />
        </div>

        <h2>Service Area</h2>

        <div className="card">
          <label htmlFor="address">Street Address *</label>
          <input
            id="address"
            name="address"
            type="text"
            required
            placeholder="123 Main St"
          />

          <label htmlFor="city">City *</label>
          <input
            id="city"
            name="city"
            type="text"
            required
            placeholder="Springfield"
          />

          <label htmlFor="state">State *</label>
          <input
            id="state"
            name="state"
            type="text"
            required
            maxLength={2}
            placeholder="CA"
          />

          <label htmlFor="zip">ZIP Code *</label>
          <input
            id="zip"
            name="zip"
            type="text"
            required
            placeholder="90210"
          />
        </div>

        <h2>Experience &amp; Volume</h2>

        <div className="card">
          <label htmlFor="years_experience">Years in Business *</label>
          <input
            id="years_experience"
            name="years_experience"
            type="number"
            required
            min={0}
            max={100}
            placeholder="5"
          />

          <label htmlFor="annual_volume">Estimated Annual Purchase Volume *</label>
          <select id="annual_volume" name="annual_volume" required>
            <option value="">Select…</option>
            <option value="under_5k">Under $5,000</option>
            <option value="5k_25k">$5,000 – $25,000</option>
            <option value="25k_100k">$25,000 – $100,000</option>
            <option value="over_100k">Over $100,000</option>
          </select>

          <label htmlFor="notes">Additional Notes</label>
          <textarea
            id="notes"
            name="notes"
            rows={4}
            placeholder="Tell us about your typical installation projects or any questions you have."
          />
        </div>

        <p className="muted">
          By submitting this form you agree to the{" "}
          <Link href="/terms">Terms of Service</Link> and confirm that the information
          provided is accurate. Applications are reviewed by the Brightworks partner team.
        </p>

        <button type="submit">Submit Application</button>
      </form>
    </main>
  );
}
