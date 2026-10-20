"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Header from "@/components/Header";
import { createClient } from "@/lib/supabase/client";
import type { Group } from "@/lib/types";

export default function HomePage() {
  const router = useRouter();
  const [groups, setGroups] = useState<Group[] | null>(null);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await createClient()
        .from("groups")
        .select("*")
        .order("created_at", { ascending: false });
      if (cancelled) return;
      if (error) setError(error.message);
      else setGroups(data as Group[]);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function createGroup(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    setBusy(true);
    setError(null);
    const { data, error } = await createClient()
      .from("groups")
      .insert({ name: trimmed })
      .select("id")
      .single();
    setBusy(false);
    if (error || !data) {
      setError(error?.message ?? "Could not create the group");
      return;
    }
    router.push(`/g/${data.id}`);
  }

  return (
    <>
      <Header />
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-6">
        <h1 className="mb-4 text-2xl font-semibold tracking-tight">Your groups</h1>

        {groups === null && !error && (
          <p className="text-stone-500">Loading…</p>
        )}

        {groups?.length === 0 && (
          <p className="mb-6 rounded-xl border border-dashed border-stone-300 p-4 text-stone-600 dark:border-stone-700 dark:text-stone-400">
            No groups yet. Create one below, then send the invite link to a
            friend.
          </p>
        )}

        <ul className="mb-8 grid gap-3 sm:grid-cols-2">
          {groups?.map((g) => (
            <li key={g.id}>
              <Link
                href={`/g/${g.id}`}
                className="block rounded-2xl border border-stone-200 p-4 font-medium transition hover:border-accent dark:border-stone-800"
              >
                {g.name}
              </Link>
            </li>
          ))}
        </ul>

        <form onSubmit={createGroup} className="flex gap-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={80}
            placeholder="New group, e.g. Lisbon trip"
            aria-label="New group name"
            className="min-w-0 flex-1 rounded-xl border border-stone-300 bg-transparent px-4 py-3 dark:border-stone-700"
          />
          <button
            disabled={busy || !name.trim()}
            className="rounded-xl bg-accent px-4 py-3 font-medium text-white disabled:opacity-50 dark:text-stone-950"
          >
            Create
          </button>
        </form>

        {error && (
          <p role="alert" className="mt-3 text-sm text-red-600 dark:text-red-400">
            {error}
          </p>
        )}
      </main>
    </>
  );
}
