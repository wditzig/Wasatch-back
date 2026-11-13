extends RefCounted
## Global score walls (Supabase). Leave blank to keep the game fully offline.
## Fill in from Supabase -> Project Settings -> API:
##   SUPABASE_URL      e.g. "https://abcdefghijkl.supabase.co"
##   SUPABASE_ANON_KEY the "anon" / "publishable" key
## The anon key is designed to be public (it ships inside every web game);
## what players can do is limited by the row-level-security rules in
## online/supabase_setup.sql (insert + read only, validated values).
const SUPABASE_URL := ""
const SUPABASE_ANON_KEY := ""
