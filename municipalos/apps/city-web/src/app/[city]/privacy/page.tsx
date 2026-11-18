import { getSite } from "@/lib/api";

export const metadata = { title: "Privacy" };

export default async function PrivacyPage({ params }: { params: Promise<{ city: string }> }) {
  const site = await getSite((await params).city);
  const { name } = site.municipality;
  return (
    <article className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-3xl font-semibold tracking-tight text-ink">Privacy</h1>
      <p className="text-ink">
        This page explains what information this website collects and how {name} uses it.
      </p>

      <section aria-labelledby="collect" className="space-y-2">
        <h2 id="collect" className="text-xl font-semibold text-ink">
          What we collect
        </h2>
        <ul className="list-disc space-y-1 pl-6 text-ink">
          <li>
            <strong>When you report a problem:</strong> the description, location and any photos you
            provide.{" "}
            {site.allowAnonymousRequests
              ? "Your name, email and phone number are optional."
              : "Your name and email are required by city policy; a phone number is optional."}
          </li>
          <li>
            <strong>Photos:</strong> location and device details stored inside a photo file are
            removed before the photo is saved.
          </li>
          <li>
            <strong>Technical records:</strong> the time of each request and the network address it
            came from, kept for security and to prevent abuse.
          </li>
        </ul>
        <p className="text-ink">
          This website does not use advertising or analytics trackers and does not load content from
          other companies.
        </p>
      </section>

      <section aria-labelledby="use" className="space-y-2">
        <h2 id="use" className="text-xl font-semibold text-ink">
          How it is used
        </h2>
        <ul className="list-disc space-y-1 pl-6 text-ink">
          <li>
            City staff use your report to fix the problem and, if you gave an email, to send you
            updates.
          </li>
          <li>
            Your contact details are visible only to authorized city staff. They are not shown on
            the public tracking page.
          </li>
          <li>Your information is not sold and is not used for advertising.</li>
          <li>
            Anyone who has your tracking number can see the request's status, description, location
            and photos. Keep it private if that matters to you, and avoid putting personal details
            in the description.
          </li>
        </ul>
      </section>

      <section aria-labelledby="records" className="space-y-2">
        <h2 id="records" className="text-xl font-semibold text-ink">
          Public records
        </h2>
        <p className="text-ink">
          Information you send to {name} may be a public record under state law and may be kept for
          the period the law requires. Some records must be released if someone asks for them, and
          some cannot be deleted on request.
        </p>
      </section>

      <section aria-labelledby="contact" className="space-y-2">
        <h2 id="contact" className="text-xl font-semibold text-ink">
          Questions
        </h2>
        <p className="text-ink">
          Contact City Hall at{" "}
          <a className="underline" href={`mailto:${site.contact.email}`}>
            {site.contact.email}
          </a>{" "}
          or{" "}
          <a className="underline" href={`tel:${site.contact.phone.replace(/[^0-9+]/g, "")}`}>
            {site.contact.phone}
          </a>
          .
        </p>
      </section>
    </article>
  );
}
