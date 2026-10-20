"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function Header({ back }: { back?: boolean }) {
  const router = useRouter();

  async function signOut() {
    await createClient().auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  return (
    <header className="sticky top-0 z-10 flex items-center justify-between border-b border-stone-200 bg-background/90 px-4 py-3 backdrop-blur dark:border-stone-800">
      <div className="flex items-center gap-3">
        {back && (
          <Link href="/" aria-label="Back to groups" className="text-xl leading-none">
            ←
          </Link>
        )}
        <Link href="/" className="font-semibold tracking-tight">
          IdeaBoard
        </Link>
      </div>
      <button
        onClick={signOut}
        className="text-sm text-stone-500 underline-offset-2 hover:underline"
      >
        Sign out
      </button>
    </header>
  );
}
