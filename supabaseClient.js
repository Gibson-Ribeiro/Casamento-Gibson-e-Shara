const SUPABASE_URL = "COLE_AQUI_A_URL";
const SUPABASE_ANON_KEY = "COLE_AQUI_A_ANON_KEY";

// Nunca coloque a service_role key no front-end.
// Use a service_role key somente em scripts locais, via .env, fora do Git.
let supabaseClientPromise = null;

export function isSupabaseConfigured() {
  return (
    SUPABASE_URL.startsWith("https://") &&
    SUPABASE_ANON_KEY.length > 20 &&
    !SUPABASE_URL.includes("COLE_AQUI") &&
    !SUPABASE_ANON_KEY.includes("COLE_AQUI")
  );
}

export async function getSupabaseClient() {
  if (!isSupabaseConfigured()) return null;

  if (!supabaseClientPromise) {
    supabaseClientPromise = import(
      "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm"
    ).then(({ createClient }) => createClient(SUPABASE_URL, SUPABASE_ANON_KEY));
  }

  return supabaseClientPromise;
}
