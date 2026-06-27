import { createClient } from "@supabase/supabase-js";


const supabaseUrl =
"https://doiwypvywdlchsscxsyt.supabase.co";


const supabaseKey =
"sb_publishable_3uY_y0K1kr2F468sqmMmhg_MowMC6Y7";


export const supabase =
createClient(
supabaseUrl,
supabaseKey
);