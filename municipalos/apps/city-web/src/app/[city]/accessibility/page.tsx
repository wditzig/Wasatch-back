import { getSite } from "@/lib/api";

export const metadata = { title: "Accessibility" };

export default async function AccessibilityPage({ params }: { params: Promise<{ city: string }> }) {
  const site = await getSite((await params).city);
  const { name } = site.municipality;
  const phone = site.contact.phone;
  return (
    <article className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-3xl font-semibold tracking-tight text-ink">Accessibility</h1>
      <p className="text-ink">
        {name} wants everyone to be able to use this website and its online services, including
        people who use screen readers, keyboard navigation, magnification or voice control.
      </p>

      <section aria-labelledby="standard" className="space-y-2">
        <h2 id="standard" className="text-xl font-semibold text-ink">
          Our standard
        </h2>
        <p className="text-ink">
          This website is designed and tested against the Web Content Accessibility Guidelines
          (WCAG) 2.2, Level AA. Every page is checked with automated accessibility tests, and pages
          are reviewed for keyboard use, colour contrast and small screens. Automated tests cannot
          find every barrier, so we also rely on your feedback.
        </p>
      </section>

      <section aria-labelledby="help" className="space-y-2">
        <h2 id="help" className="text-xl font-semibold text-ink">
          If something does not work for you
        </h2>
        <p className="text-ink">
          Tell us what you were trying to do and what went wrong. We will help you complete your
          request another way and work to fix the problem.
        </p>
        <ul className="list-disc space-y-1 pl-6 text-ink">
          <li>
            Phone:{" "}
            <a className="underline" href={`tel:${phone.replace(/[^0-9+]/g, "")}`}>
              {phone}
            </a>
          </li>
          <li>
            Email:{" "}
            <a className="underline" href={`mailto:${site.contact.email}`}>
              {site.contact.email}
            </a>
          </li>
          <li>In person or by mail: {site.contact.address}</li>
        </ul>
        <p className="text-ink">Office hours: {site.contact.hours}.</p>
      </section>

      <section aria-labelledby="alternatives" className="space-y-2">
        <h2 id="alternatives" className="text-xl font-semibold text-ink">
          Other ways to reach city services
        </h2>
        <p className="text-ink">
          Anything you can do on this website you can also do by phone or in person at City Hall.
          You can ask for information in another format.
        </p>
      </section>
    </article>
  );
}
