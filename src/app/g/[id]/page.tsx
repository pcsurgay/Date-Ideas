"use client";

import { use, useEffect, useState } from "react";
import Header from "@/components/Header";
import IdeaTile from "@/components/IdeaTile";
import { createClient } from "@/lib/supabase/client";
import { extractFirstUrl } from "@/lib/links";
import type { Group, Idea, LinkPreview, Member } from "@/lib/types";

const IDEA_SELECT = "*, profiles:added_by(display_name)";

export default function GroupPage(props: PageProps<"/g/[id]">) {
  const { id } = use(props.params);

  const [me, setMe] = useState<string | null>(null);
  const [group, setGroup] = useState<Group | null | undefined>(undefined);
  const [members, setMembers] = useState<Member[]>([]);
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [link, setLink] = useState("");
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Initial load, then live updates when a friend adds or removes a tile.
  useEffect(() => {
    const supabase = createClient();
    let cancelled = false;

    (async () => {
      const [{ data: userData }, groupRes, memberRes, ideaRes] =
        await Promise.all([
          supabase.auth.getUser(),
          supabase.from("groups").select("*").eq("id", id).maybeSingle(),
          supabase
            .from("group_members")
            .select("user_id, role, profiles(display_name)")
            .eq("group_id", id),
          supabase
            .from("ideas")
            .select(IDEA_SELECT)
            .eq("group_id", id)
            .order("created_at", { ascending: false }),
        ]);
      if (cancelled) return;
      setMe(userData.user?.id ?? null);
      setGroup((groupRes.data as Group | null) ?? null);
      setMembers((memberRes.data as unknown as Member[]) ?? []);
      setIdeas((ideaRes.data as unknown as Idea[]) ?? []);
      if (groupRes.error) setError(groupRes.error.message);
    })();

    const channel = supabase
      .channel(`ideas:${id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "ideas",
          filter: `group_id=eq.${id}`,
        },
        async (payload) => {
          // The realtime row has no joined profile, so fetch it in full.
          const { data } = await supabase
            .from("ideas")
            .select(IDEA_SELECT)
            .eq("id", (payload.new as { id: string }).id)
            .maybeSingle();
          if (!data || cancelled) return;
          setIdeas((prev) =>
            prev.some((i) => i.id === (data as unknown as Idea).id)
              ? prev
              : [data as unknown as Idea, ...prev],
          );
        },
      )
      .on(
        "postgres_changes",
        // Supabase can't filter DELETE events by column, so no filter here;
        // the handler only removes a tile if its id is in this group's list.
        { event: "DELETE", schema: "public", table: "ideas" },
        (payload) => {
          const removed = (payload.old as { id?: string }).id;
          if (removed) setIdeas((prev) => prev.filter((i) => i.id !== removed));
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [id]);

  async function addLink(e: React.FormEvent) {
    e.preventDefault();
    const url = extractFirstUrl(link);
    if (!url) {
      setError("Paste a link, for example from Google Maps or TripAdvisor.");
      return;
    }
    setAdding(true);
    setError(null);
    try {
      const res = await fetch("/api/link-preview", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const preview = (await res.json()) as LinkPreview & { error?: string };
      if (!res.ok) throw new Error(preview.error ?? "Could not read that link");

      const { data, error: insertError } = await createClient()
        .from("ideas")
        .insert({
          group_id: id,
          url: preview.url,
          title: preview.title,
          image_url: preview.image,
          source: preview.source,
          place_name: preview.placeName,
        })
        .select(IDEA_SELECT)
        .single();
      if (insertError) throw insertError;

      const added = data as unknown as Idea;
      setIdeas((prev) =>
        prev.some((i) => i.id === added.id) ? prev : [added, ...prev],
      );
      setLink("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setAdding(false);
    }
  }

  async function removeIdea(idea: Idea) {
    if (!window.confirm("Remove this tile from the group?")) return;
    const { error } = await createClient().from("ideas").delete().eq("id", idea.id);
    if (error) {
      setError(error.message);
      return;
    }
    setIdeas((prev) => prev.filter((i) => i.id !== idea.id));
  }

  async function invite() {
    if (!group) return;
    const url = `${window.location.origin}/join/${group.invite_code}`;
    try {
      if (navigator.share) {
        await navigator.share({
          title: `Join ${group.name} on IdeaBoard`,
          url,
        });
        return;
      }
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Share sheet dismissed or clipboard blocked; nothing to do.
    }
  }

  if (group === undefined) {
    return (
      <>
        <Header back />
        <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-6 text-stone-500">
          Loading…
        </main>
      </>
    );
  }

  if (group === null) {
    return (
      <>
        <Header back />
        <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-6">
          <p>This group doesn&apos;t exist, or you&apos;re not a member of it.</p>
        </main>
      </>
    );
  }

  const isOwner = group.created_by === me;

  return (
    <>
      <Header back />
      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-6">
        <div className="mb-5 flex items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{group.name}</h1>
            <p className="mt-1 text-sm text-stone-500">
              {members
                .map((m) => m.profiles?.display_name ?? "Friend")
                .join(", ")}
            </p>
          </div>
          <button
            onClick={invite}
            className="shrink-0 rounded-xl border border-stone-300 px-3 py-2 text-sm font-medium dark:border-stone-700"
          >
            {copied ? "Link copied" : "Invite"}
          </button>
        </div>

        <form onSubmit={addLink} className="mb-6 flex gap-2">
          <input
            value={link}
            onChange={(e) => setLink(e.target.value)}
            placeholder="Paste a Google Maps, Apple Maps or TripAdvisor link"
            aria-label="Link to add"
            inputMode="url"
            autoCapitalize="none"
            autoCorrect="off"
            className="min-w-0 flex-1 rounded-xl border border-stone-300 bg-transparent px-4 py-3 dark:border-stone-700"
          />
          <button
            disabled={adding || !link.trim()}
            className="rounded-xl bg-accent px-4 py-3 font-medium text-white disabled:opacity-50 dark:text-stone-950"
          >
            {adding ? "Adding…" : "Add"}
          </button>
        </form>

        {error && (
          <p role="alert" className="mb-4 text-sm text-red-600 dark:text-red-400">
            {error}
          </p>
        )}

        {ideas.length === 0 ? (
          <p className="rounded-xl border border-dashed border-stone-300 p-4 text-stone-600 dark:border-stone-700 dark:text-stone-400">
            No ideas yet. Paste a link above, or use the Invite button to bring
            a friend in.
          </p>
        ) : (
          <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {ideas.map((idea) => (
              <IdeaTile
                key={idea.id}
                idea={idea}
                canDelete={idea.added_by === me || isOwner}
                onDelete={removeIdea}
              />
            ))}
          </ul>
        )}
      </main>
    </>
  );
}
