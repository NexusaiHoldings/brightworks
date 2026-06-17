import type { JSX } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/admin-auth";
import {
  createInstallerApplication,
  getInstallerApplicationStatus,
  type InstallerStatus,
} from "@/lib/brightworks/access";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

async function submitApplication(formData: FormData): Promise<void> {
  "use server";

  const user = await getSessionUser();
  if (!user) {
    redirect("/login?next=/installer/apply");
  }

  const existing = await getInstallerApplicationStatus(user.id);
  if (existing !== null) {
    redirect("/installer/apply?error=already_applied");
  }

  const businessName = ((formData.get("business_name") as string | null) ?? "").trim();
  const licenseNumber = ((formData.get("license_number") as string | null) ?? "").trim();
  const contactPhone = ((formData.get("contact_phone") as string | null) ?? "").trim();
  const serviceArea = ((formData.get("service_area") as string | null) ?? "").trim();
  const yearsRaw = (formData.get("years_experience") as string | null) ?? "0";
  const yearsExperience = Math.max(0, parseInt(yearsRaw, 10) || 0);

  if (!businessName || !licenseNumber || !contactPhone || !serviceArea) {
    redirect("/installer/apply?error=missing_fields");
  }

  await createInstallerApplication({
    userId: user.id,
    businessName,
    licenseNumber,
    contactPhone,
    yearsExperience,
    serviceArea,
  });

  redirect("/installer/apply?submitted=true");
}

const ERROR_MESSAGES: Record<string, string> = {
  missing_fields: "Please fill in all required fields.",
  already_applied: "An application already exists for your account.",
  server_error: "Something went wrong. Please try again.",
};

export default async function InstallerApplyPage({
  searchParams,
}: {
  searchParams?: { submitted?: string; error?: string };
}): Promise<JSX.Element> {
  const user = await getSessionUser();
  if (!user) {
    redirect("/login?next=/installer/apply");
  }

  const applicationStatus: InstallerStatus | null =
    await getInstallerApplicationStatus(user.id);
  const submitted = searchParams?.submitted === "true";
  const errorCode = searchParams?.error;
  const errorMessage = errorCode ? (ERROR_MESSAGES[errorCode] ?? ERROR_MESSAGES.server_error) : undefined;

  if (submitted || applicationStatus === "pending") {
    return (
      <main>
        <h1>Application Under Review</h1>
        <p>
          Your installer application has been received and is pending review.
          We will notify you by email once a decision has been made, typically
          within 2 business days.
        </p>
        <div className="card">
          <h2>What Happens Next</h2>
          <p>
            Our team will verify your business license and installer
            credentials. Upon approval, the <strong>installer</strong> role
            will be added to your account and you will gain access to wholesale
            pricing.
          </p>
          <Link href="/" className="btn secondary">
            Return Home
          </Link>
        </div>
      </main>
    );
  }

  if (applicationStatus === "approved") {
    redirect("/installer");
  }

  if (applicationStatus === "rejected") {
    return (
      <main>
        <h1>Application Not Approved</h1>
        <p>
          Your previous installer application was not approved. Please contact
          support if you believe this was made in error or to discuss next
          steps.
        </p>
        <Link href="/support" className="btn secondary">
          Contact Support
        </Link>
      </main>
    );
  }

  return (
    <main>
      <h1>Apply for Installer Access</h1>
      <p>
        Verified installers receive a 20% volume discount on all SKUs in our
        wholesale catalog. Your credentials will be reviewed by our team before
        access is granted.
      </p>

      {errorMessage ? (
        <div className="card">
          <p>{errorMessage}</p>
        </div>
      ) : null}

      <form action={submitApplication}>
        <label htmlFor="business_name">Business Name *</label>
        <input
          type="text"
          id="business_name"
          name="business_name"
          required
          placeholder="Acme Roofing LLC"
          maxLength={200}
        />

        <label htmlFor="license_number">Contractor License Number *</label>
        <input
          type="text"
          id="license_number"
          name="license_number"
          required
          placeholder="LIC-123456"
          maxLength={100}
        />

        <label htmlFor="contact_phone">Business Phone *</label>
        <input
          type="tel"
          id="contact_phone"
          name="contact_phone"
          required
          placeholder="(555) 000-0000"
          maxLength={30}
        />

        <label htmlFor="service_area">Service Area *</label>
        <input
          type="text"
          id="service_area"
          name="service_area"
          required
          placeholder="e.g. Greater Phoenix, AZ"
          maxLength={200}
        />

        <label htmlFor="years_experience">Years of Experience</label>
        <input
          type="number"
          id="years_experience"
          name="years_experience"
          min="0"
          max="100"
          defaultValue="0"
        />

        <button type="submit">Submit Application</button>
      </form>
    </main>
  );
}
