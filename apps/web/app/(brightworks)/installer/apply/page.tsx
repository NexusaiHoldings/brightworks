import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { handleSession } from "@nexus/identity-and-access";
import { buildDb } from "@/lib/db";
import { buildEventBus } from "@/lib/events";

export const metadata = {
  title: "Apply for Installer Access | Brightworks",
  description:
    "Apply to become a Brightworks-certified installer and unlock exclusive wholesale pricing.",
};

async function submitInstallerApplication(formData: FormData): Promise<void> {
  "use server";

  const token = cookies().get("session_token")?.value;
  if (!token) {
    redirect("/api/auth/login?callbackUrl=/installer/apply");
  }

  const result = await handleSession({
    authorizationHeader: `Bearer ${token}`,
    ctx: { db: buildDb(), events: buildEventBus() },
  });

  if (
    result.status !== 200 ||
    typeof result.body !== "object" ||
    result.body === null
  ) {
    redirect("/api/auth/login?callbackUrl=/installer/apply");
  }

  const session = result.body as { user_id?: string; email?: string };
  if (!session.user_id || !session.email) {
    redirect("/api/auth/login?callbackUrl=/installer/apply");
  }

  const businessName = ((formData.get("business_name") as string | null) ?? "").trim();
  const contactName = ((formData.get("contact_name") as string | null) ?? "").trim();
  const phone = ((formData.get("phone") as string | null) ?? "").trim();
  const licenseNumber = ((formData.get("license_number") as string | null) ?? "").trim();
  const yearsRaw = ((formData.get("years_in_business") as string | null) ?? "0").trim();
  const yearsInBusiness = Math.max(0, parseInt(yearsRaw, 10) || 0);

  if (!businessName || !contactName || !phone || !licenseNumber) {
    redirect("/installer/apply?error=missing_fields");
  }

  const db = buildDb();

  // Insert pending application. On conflict (user already applied), update
  // the fields but preserve 'verified' status to avoid downgrading an
  // already-approved installer who is editing their profile.
  await db.execute(
    `INSERT INTO installer_profiles
       (id, user_id, status, business_name, contact_name, phone,
        license_number, years_in_business, created_at)
     VALUES
       (gen_random_uuid(), $1::uuid, 'pending', $2, $3, $4, $5, $6, NOW())
     ON CONFLICT (user_id)
       DO UPDATE SET
         business_name      = EXCLUDED.business_name,
         contact_name       = EXCLUDED.contact_name,
         phone              = EXCLUDED.phone,
         license_number     = EXCLUDED.license_number,
         years_in_business  = EXCLUDED.years_in_business,
         status             = CASE
                                WHEN installer_profiles.status = 'verified'
                                THEN 'verified'
                                ELSE 'pending'
                              END`,
    session.user_id,
    businessName,
    contactName,
    phone,
    licenseNumber,
    yearsInBusiness,
  );

  redirect("/installer/apply?status=submitted");
}

export default async function InstallerApplyPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const status = typeof searchParams.status === "string" ? searchParams.status : undefined;
  const error = typeof searchParams.error === "string" ? searchParams.error : undefined;

  if (status === "submitted") {
    return (
      <main>
        <h1>Application Received</h1>
        <p>
          Thank you for applying for Brightworks installer access. Our partner
          team reviews every application before granting wholesale credentials.
        </p>

        <div className="card">
          <h2>What happens next?</h2>
          <ul>
            <li>
              Our partner team reviews your application within{" "}
              <strong>2–3 business days</strong>.
            </li>
            <li>
              We verify your contractor license with the appropriate licensing
              authority.
            </li>
            <li>
              You will receive a confirmation email at the address on your
              account once a decision is made.
            </li>
            <li>
              Approved installers gain immediate access to the wholesale pricing
              portal with a flat 20% discount across the full catalog.
            </li>
          </ul>
        </div>

        <p>
          Questions? Email{" "}
          <a href="mailto:partners@usebrightworks.com">
            partners@usebrightworks.com
          </a>{" "}
          or call{" "}
          <a href="tel:+18005551234">1-800-555-1234</a>.
        </p>

        <a href="/" className="btn secondary">
          Back to Home
        </a>
      </main>
    );
  }

  return (
    <main>
      <h1>Apply for Installer Access</h1>
      <p>
        Brightworks-certified installers receive exclusive wholesale pricing — a
        flat 20% discount across the full product catalog. Complete the form
        below and our partner team will review your credentials within 2–3
        business days.
      </p>

      {error === "missing_fields" && (
        <div className="card" role="alert">
          <p>Please fill in all required fields before submitting.</p>
        </div>
      )}

      <form action={submitInstallerApplication}>
        <div>
          <label htmlFor="business_name">Business Name *</label>
          <input
            id="business_name"
            name="business_name"
            type="text"
            required
            placeholder="Acme Painting Co."
            autoComplete="organization"
          />
        </div>

        <div>
          <label htmlFor="contact_name">Primary Contact Name *</label>
          <input
            id="contact_name"
            name="contact_name"
            type="text"
            required
            placeholder="Jane Smith"
            autoComplete="name"
          />
        </div>

        <div>
          <label htmlFor="phone">Business Phone *</label>
          <input
            id="phone"
            name="phone"
            type="tel"
            required
            placeholder="(555) 000-0000"
            autoComplete="tel"
          />
        </div>

        <div>
          <label htmlFor="license_number">Contractor License Number *</label>
          <input
            id="license_number"
            name="license_number"
            type="text"
            required
            placeholder="CA-123456"
          />
        </div>

        <div>
          <label htmlFor="years_in_business">Years in Business</label>
          <input
            id="years_in_business"
            name="years_in_business"
            type="number"
            min="0"
            max="100"
            placeholder="5"
          />
        </div>

        <div>
          <button type="submit">Submit Application</button>
        </div>
      </form>

      <p className="muted">
        * Required fields. By submitting this form you authorize Brightworks to
        verify your credentials with the appropriate contractor licensing
        authority and agree to the{" "}
        <a href="/legal/installer-partner-terms">Installer Partner Terms</a>.
      </p>
    </main>
  );
}
