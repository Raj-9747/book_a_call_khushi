"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CheckCircle2, XCircle } from "lucide-react";
import { Spinner } from "@/components/ui";
import { connectGoogleCalendar } from "@/lib/api/googleCalendar";

export default function GoogleCalendarCallbackPage() {
  return (
    <Suspense>
      <GoogleCalendarCallbackContent />
    </Suspense>
  );
}

function GoogleCalendarCallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [state, setState] = useState<"connecting" | "success" | "error">("connecting");
  const [errorMessage, setErrorMessage] = useState("");

  // This effect's whole purpose is a one-time action on mount (read the
  // OAuth redirect's URL params, fire the token-exchange network call) — not
  // deriving state from props/state, so updating state here (including the
  // synchronous early-return branches) is the correct use of an effect, not
  // a case that should move to render.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    const code = searchParams.get("code");
    const oauthError = searchParams.get("error");

    if (oauthError) {
      setState("error");
      setErrorMessage(oauthError === "access_denied" ? "You didn't grant access, so nothing was connected." : oauthError);
      return;
    }
    if (!code) {
      setState("error");
      setErrorMessage("Missing authorization code from Google.");
      return;
    }

    const redirectUri = `${window.location.origin}/dashboard/calendar/callback`;
    connectGoogleCalendar(code, redirectUri)
      .then(() => {
        setState("success");
        setTimeout(() => router.push("/dashboard"), 1500);
      })
      .catch((err) => {
        setState("error");
        setErrorMessage(err instanceof Error ? err.message : "Failed to connect Google Calendar");
      });
    // Only run once on mount — re-running with the same `code` would fail
    // anyway since Google authorization codes are single-use.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface-muted px-4">
      <div className="flex flex-col items-center text-center">
        {state === "connecting" && (
          <>
            <Spinner className="h-8 w-8 text-brand-600" />
            <p className="mt-4 text-sm text-neutral-600">Connecting your Google Calendar...</p>
          </>
        )}
        {state === "success" && (
          <>
            <CheckCircle2 className="h-10 w-10 text-emerald-500" />
            <p className="mt-4 text-sm font-medium text-neutral-900">Google Calendar connected!</p>
            <p className="mt-1 text-sm text-neutral-500">Redirecting you back...</p>
          </>
        )}
        {state === "error" && (
          <>
            <XCircle className="h-10 w-10 text-danger-500" />
            <p className="mt-4 text-sm font-medium text-neutral-900">Couldn&apos;t connect Google Calendar</p>
            <p className="mt-1 max-w-sm text-sm text-neutral-500">{errorMessage}</p>
            <button
              onClick={() => router.push("/dashboard")}
              className="mt-4 text-sm font-medium text-brand-600 hover:underline"
            >
              Back to dashboard
            </button>
          </>
        )}
      </div>
    </div>
  );
}
