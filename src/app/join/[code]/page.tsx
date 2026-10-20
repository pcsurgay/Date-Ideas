"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Header from "@/components/Header";
import { createClient } from "@/lib/supabase/client";

export default function JoinPage(props: PageProps<"/join/[code]">) {
  const { code } = use(props.params);
  const router = useRouter();
  const [groupName, setGroupName] = useState<string | null | undefined>(
    undefined,
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await createClient().rpc("group_name_by_code", {
        code,
      });
      if (cancelled) return;
      if (error) setError(error.message);
      setGroupName((data as string | null) ?? null);
    })();
    return () => {
      cancelled = true;
    };
  }, [code]);

  async function join() {
    setBusy(true);
    setError(null);
    const { data, error } = await createClient().rpc("join_group_by_code", {
      code,
    });
    if (error || !data) {
      setBusy(false);
      setError(error?.message ?? "Could not join the group");
      return;
    }
    router.replace(`/g/${data as string}`);
  }

  return (
    <>
      <Header />
      <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-4 px-5 py-12 text-center">
        {groupName === undefined && <p className="text-stone-500">Checking invite…</p>}

        {groupName === null && (
          <p>This invite link isn&apos;t valid anymore. Ask your friend for a new one.</p>
        )}

        {groupName && (
          <>
            <p className="text-stone-600 dark:text-stone-400">You&apos;re invited to</p>
            <h1 className="text-3xl font-semibold tracking-tight">{groupName}</h1>
            <button
              onClick={join}
              disabled={busy}
              className="rounded-xl bg-accent px-4 py-3 font-medium text-white disabled:opacity-60 dark:text-stone-950"
            >
              {busy ? "Joining…" : "Join group"}
            </button>
          </>
        )}

        {error && (
          <p role="alert" className="text-sm text-red-600 dark:text-red-400">
            {error}
          </p>
        )}
      </main>
    </>
  );
}
