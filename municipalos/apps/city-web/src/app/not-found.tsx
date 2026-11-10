import Link from "next/link";
import { buttonClass } from "@municipalos/ui";

export default function NotFound() {
  return (
    <main id="main" className="mx-auto max-w-xl px-4 py-24 text-center">
      <h1 className="text-2xl font-semibold text-ink">Page not found</h1>
      <p className="mt-2 text-ink-muted">
        We couldn&rsquo;t find that page. It may have moved, or the address may be mistyped.
      </p>
      <Link href="/" className={buttonClass("primary", "md", "mt-6")}>
        Choose your city
      </Link>
    </main>
  );
}
