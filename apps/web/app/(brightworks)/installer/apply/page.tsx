import type { JSX } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/admin-auth";
import {
  createInstallerApplication,
  getInstallerProfile,
} from "@/lib/brightworks/access";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function InstallerApplyPage({
  searchParams,
}: {
  searchParams: { success?: string };
}): Promise<JSX.Element> {
  const user = await getSessionUser();

  if (!user) {
    return (
      <main>
        <h1>Apply for Installer Access</h1>
        <p>
          Become a verified Brightworks installer partner and unlock wholesale
          pricing on our full product catalog.
        </p>
        <div className="empty">
          <p>
            Please <Link href="/login">sign in</Link> before applying.
          </p>
        </div>
      </main>
    );
  }

  const profile = await getInstallerProfile(user.id);

  if (profile?.installer_verified) {
    return (
      <main>
        <h1>Apply for Installer Access</h1>
        <p>
          Become a verified Brightworks installer partner and unlock wholesale
          pricing on our full product catalog.
        </p>
        <div className="card">
          <strong>Your account is already verified.</strong>
          <p>
            You have full installer access.{" "}
            <Link href="/installer">View wholesale pricing →</Link>
          </p>
        </div>
      </main>
    );
  }

  const alreadyApplied =
    searchParams.success === "1" || profile?.status === "pending";

  if (alreadyApplied) {
    return (
      <main>
        <h1>Apply for Installer Access</h1>
        <p>
          Become a verified Brightworks installer partner and unlock wholesale
          pricing on our full product catalog.
        </p>
        <div className="card">
          <strong>Application received — thank you!</strong>
          <p>
            Our team will review your installer application within 2–3 business
            days. You&apos;ll receive an email confirmation at{" "}
            <strong>{user.email}</strong> once approved.
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

  async function submitApplication(formData: FormData): Promise<void> {
    "use server";

    const companyName = (formData.get("companyName") ?? "").toString().trim();
    const contactName = (formData.get("contactName") ?? "").toString().trim();
    const phone = (formData.get("phone") ?? "").toString().trim();
    const message = (formData.get("message") ?? "").toString().trim();

    if (!companyName || !contactName || !phone) {
      redirect("/installer/apply?error=missing-fields");
    }

    await createInstallerApplication({
      userId: user!.id,
      companyName,
      contactName,
      phone,
      message,
    });

    redirect("/installer/apply?success=1");
  }

  const hasError = searchParams.success === undefined && "error" in searchParams;

  return (
    <main>
      <h1>Apply for Installer Access</h1>
      <p>
        Become a verified Brightworks installer partner and unlock wholesale
        pricing on our full product catalog.
      </p>

      {hasError && (
        <p className="muted">
          Please fill in all required fields and try again.
        </p>
      )}

      <form action={submitApplication}>
        <label htmlFor="companyName">Company name *</label>
        <input
          id="companyName"
          name="companyName"
          type="text"
          required
          placeholder="Acme Installations LLC"
        />

        <label htmlFor="contactName">Contact name *</label>
        <input
          id="contactName"
          name="contactName"
          type="text"
          required
          placeholder="Jane Smith"
        />

        <label htmlFor="phone">Phone number *</label>
        <input
          id="phone"
          name="phone"
          type="tel"
          required
          placeholder="+1 555 000 0000"
        />

        <label htmlFor="message">
          Tell us about your installation business
        </label>
        <textarea
          id="message"
          name="message"
          rows={4}
          placeholder="Years in business, typical project types, service area…"
        />

        <button type="submit">Submit Application</button>
      </form>

      <p className="muted">
        Already have access?{" "}
        <Link href="/installer">View wholesale pricing →</Link>
      </p>
    </main>
  );
}
