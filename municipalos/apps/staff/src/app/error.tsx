"use client";

import { useEffect } from "react";
import { Alert, Button } from "@municipalos/ui";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <main id="main" className="mx-auto flex min-h-[60vh] max-w-md flex-col justify-center px-6">
      <h1 className="text-2xl font-semibold tracking-tight">Something went wrong</h1>
      <Alert tone="error" live className="mt-4">
        We could not load this page. Your work has not been lost; try again in a moment.
        {error.digest ? (
          <span className="mt-1 block text-xs">Reference: {error.digest}</span>
        ) : null}
      </Alert>
      <div className="mt-6">
        <Button onClick={reset}>Try again</Button>
      </div>
    </main>
  );
}
