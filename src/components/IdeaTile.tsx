import { SOURCE_LABEL, type Source } from "@/lib/links";
import type { Idea } from "@/lib/types";

const SOURCE_STYLE: Record<Source, string> = {
  google_maps: "bg-blue-100 text-blue-900 dark:bg-blue-950 dark:text-blue-200",
  apple_maps: "bg-stone-200 text-stone-900 dark:bg-stone-800 dark:text-stone-200",
  tripadvisor: "bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200",
  booking: "bg-indigo-100 text-indigo-900 dark:bg-indigo-950 dark:text-indigo-200",
  airbnb: "bg-rose-100 text-rose-900 dark:bg-rose-950 dark:text-rose-200",
  getyourguide: "bg-orange-100 text-orange-900 dark:bg-orange-950 dark:text-orange-200",
  other: "bg-stone-100 text-stone-800 dark:bg-stone-900 dark:text-stone-300",
};

function hostname(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

export default function IdeaTile({
  idea,
  canDelete,
  onDelete,
}: {
  idea: Idea;
  canDelete: boolean;
  onDelete: (idea: Idea) => void;
}) {
  const label = SOURCE_LABEL[idea.source] ?? SOURCE_LABEL.other;
  const style = SOURCE_STYLE[idea.source] ?? SOURCE_STYLE.other;
  const title = idea.place_name ?? idea.title ?? hostname(idea.url);

  return (
    <li className="relative overflow-hidden rounded-2xl border border-stone-200 dark:border-stone-800">
      <a
        href={idea.url}
        target="_blank"
        rel="noopener noreferrer"
        className="block transition active:scale-[0.99]"
      >
        {idea.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={idea.image_url}
            alt=""
            loading="lazy"
            referrerPolicy="no-referrer"
            className="h-36 w-full object-cover"
          />
        ) : (
          <div
            className={`flex h-36 w-full items-center justify-center text-lg font-semibold ${style}`}
          >
            {label}
          </div>
        )}
        <div className="flex flex-col gap-1 p-3">
          <span className="line-clamp-2 font-medium leading-snug">{title}</span>
          <span className="flex flex-wrap items-center gap-x-2 text-xs text-stone-500">
            <span className={`rounded-full px-2 py-0.5 font-medium ${style}`}>
              {idea.source === "other" ? "Open link" : `Open in ${label}`} ↗
            </span>
            {idea.profiles?.display_name && (
              <span>by {idea.profiles.display_name}</span>
            )}
          </span>
        </div>
      </a>
      {canDelete && (
        <button
          onClick={() => onDelete(idea)}
          aria-label={`Remove ${title}`}
          className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-black/55 text-white"
        >
          ×
        </button>
      )}
    </li>
  );
}
