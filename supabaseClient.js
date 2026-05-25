import { createClient } from '@supabase/supabase-js'

const supabaseUrl = "PROJECT_URL_KAMU"
const supabaseKey = "ANON_KEY_KAMU"

export const supabase = createClient(supabaseUrl, supabaseKey)