import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(url, key);

export type Course = {
  id: string;
  title: string;
  description: string | null;
  cover_image_url: string | null;
  visibility: "private" | "unlisted" | "public";
  created_at: string;
  deleted_at: string | null;
};
