import type { Metadata } from "next";
import { Alert, Card } from "@municipalos/ui";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ expired?: string }>;
}) {
  const { expired } = await searchParams;
  return (
    <main
      id="main"
      className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-6 py-12"
    >
      <p className="text-sm font-semibold tracking-wide text-brand-700">MunicipalOS</p>
      <h1 className="mt-1 text-2xl font-semibold tracking-tight">Staff sign in</h1>
      <p className="mt-1 text-sm text-ink-muted">
        For municipal employees. Residents do not need an account.
      </p>
      {expired ? (
        <Alert tone="info" className="mt-5">
          Your session ended. Sign in again to continue.
        </Alert>
      ) : null}
      <Card className="mt-6 p-6">
        <LoginForm />
      </Card>
      <p className="mt-8 border-t border-line pt-4 text-xs text-ink-muted">
        This is a government information system for authorized municipal staff only. Activity is
        recorded and reviewed. Unauthorized use is prohibited and may be reported to the
        municipality.
      </p>
    </main>
  );
}
