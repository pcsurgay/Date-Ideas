import type { Source } from "./links";

export type Group = {
  id: string;
  name: string;
  invite_code: string;
  created_by: string;
  created_at: string;
};

export type Member = {
  user_id: string;
  role: "owner" | "member";
  profiles: { display_name: string } | null;
};

export type Idea = {
  id: string;
  group_id: string;
  added_by: string;
  url: string;
  title: string | null;
  image_url: string | null;
  source: Source;
  place_name: string | null;
  note: string | null;
  created_at: string;
  profiles?: { display_name: string } | null;
};

export type LinkPreview = {
  url: string;
  title: string | null;
  image: string | null;
  source: Source;
  placeName: string | null;
};
