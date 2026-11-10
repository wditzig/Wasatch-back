import Link from "next/link";
import { buttonClass } from "@municipalos/ui";

export default function NotFound() {
  return (
    <main
      id="main"
      className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-6 text-center"
    >
      <h1 className="text-2xl font-semibold tracking-tight">Page not found</h1>
      <p className="mt-2 text-sm text-ink-muted">
        This page does not exist, or your account does not have access to it.
      </p>
      <Link href="/" className={buttonClass("primary", "md", "mt-6")}>
        Go to your workspace
      </Link>
    </main>
  );
}
