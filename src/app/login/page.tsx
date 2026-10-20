"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { safeNext } from "@/lib/links";

// Email + one-time code. A magic *link* would open in Safari instead of the
// installed home-screen app on iPhone, so the session would end up in the
// wrong place. Typing the code keeps the login inside the app.
export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"email" | "code">("email");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function sendCode(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error } = await createClient().auth.signInWithOtp({
      email: email.trim(),
      options: { shouldCreateUser: true },
    });
    setBusy(false);
    if (error) {
      setError(error.message);
      return;
    }
    setStep("code");
  }

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error } = await createClient().auth.verifyOtp({
      email: email.trim(),
      token: code.trim(),
      type: "email",
    });
    if (error) {
      setBusy(false);
      setError(error.message);
      return;
    }
    const next = safeNext(new URLSearchParams(window.location.search).get("next"));
    router.replace(next);
    router.refresh();
  }

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6 px-5 py-12">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">IdeaBoard</h1>
        <p className="mt-2 text-stone-600 dark:text-stone-400">
          Collect places and trip ideas with your friends.
        </p>
      </div>

      {step === "email" ? (
        <form onSubmit={sendCode} className="flex flex-col gap-3">
          <label className="text-sm font-medium" htmlFor="email">
            Your email
          </label>
          <input
            id="email"
            type="email"
            required
            autoComplete="email"
            inputMode="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="rounded-xl border border-stone-300 bg-transparent px-4 py-3 text-base dark:border-stone-700"
          />
          <button
            disabled={busy}
            className="rounded-xl bg-accent px-4 py-3 font-medium text-white disabled:opacity-60 dark:text-stone-950"
          >
            {busy ? "Sending…" : "Send me a code"}
          </button>
        </form>
      ) : (
        <form onSubmit={verify} className="flex flex-col gap-3">
          <p className="text-sm text-stone-600 dark:text-stone-400">
            We sent a code to <strong>{email}</strong>. Enter it below.
          </p>
          <input
            type="text"
            required
            autoComplete="one-time-code"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={10}
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="123456"
            className="rounded-xl border border-stone-300 bg-transparent px-4 py-3 text-center text-2xl tracking-[0.3em] dark:border-stone-700"
          />
          <button
            disabled={busy}
            className="rounded-xl bg-accent px-4 py-3 font-medium text-white disabled:opacity-60 dark:text-stone-950"
          >
            {busy ? "Checking…" : "Sign in"}
          </button>
          <button
            type="button"
            onClick={() => {
              setStep("email");
              setCode("");
              setError(null);
            }}
            className="text-sm text-stone-500 underline"
          >
            Use a different email
          </button>
        </form>
      )}

      {error && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
    </main>
  );
}
