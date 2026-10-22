import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers.js";
import { getSupabaseConfig } from "./config.ts";

export async function createClient() {
  const { url, key } = getSupabaseConfig();
  const cookieStore = await cookies();

  return createServerClient(url, key, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Server Components cannot write cookies; proxy.ts refreshes sessions.
        }
      },
    },
  });
}
