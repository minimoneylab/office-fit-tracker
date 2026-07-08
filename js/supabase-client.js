// ─────────────────────────────────────────────────────────
// 1. Create a free project at https://supabase.com
// 2. Run schema.sql (in this repo) in the Supabase SQL Editor
// 3. Project Settings → API → copy your Project URL and anon public key
// 4. Paste them below
// ─────────────────────────────────────────────────────────
const SUPABASE_URL = "https://fgpqaduybtiposiltbiw.supabase.co"; // e.g. https://abcxyz.supabase.co
const SUPABASE_ANON_KEY = "sb_publishable_MDvxO4IfzHfAjQZMV44r2A_nzs-5XZc";

const isConfigured = !SUPABASE_URL.includes("YOUR_") && !SUPABASE_ANON_KEY.includes("YOUR_");

let db = null;
if (isConfigured) {
    db = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}

function requireConfig() {
    const warning = document.getElementById('config-warning');
    if (!isConfigured) {
        if (warning) warning.style.display = 'block';
        return false;
    }
    if (warning) warning.style.display = 'none';
    return true;
}
