import { createBrowserClient } from "@supabase/ssr";

const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const hasSupabaseConfig =
  Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL) && Boolean(supabaseKey);

export function createSupabaseClient() {
  if (!hasSupabaseConfig) return null;

  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    supabaseKey!
  );
}

export async function signInWithGoogle() {
  const supabase = createSupabaseClient();
  if (!supabase) return { error: new Error("Supabase no esta configurado") };

  return supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: typeof window === "undefined" ? undefined : `${window.location.origin}/auth/callback`
    }
  });
}

export async function signOut() {
  const supabase = createSupabaseClient();
  if (!supabase) return;
  await supabase.auth.signOut();
}
