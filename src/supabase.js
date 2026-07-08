import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://doiwypvywdlchsscxsyt.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_3uY_y0K1kr2F468sqmMmhg_MowMC6Y7";

export let supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Called after wallet-signature auth succeeds (or with null on disconnect)
// to make every subsequent Supabase request carry the signed-in wallet's JWT,
// which our new RLS policies check against the `wallet` column.
export function setAuthToken(jwt) {
  supabase = jwt
    ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { global: { headers: { Authorization: "Bearer " + jwt } } })
    : createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}
