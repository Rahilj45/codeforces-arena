import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://ogryahmyilfqglxezcus.supabase.co';
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_WXslkzAONWAYmIFUzCWf2w_SrGE5OTR'; // Real anon key provided by user

export const supabase = createClient(supabaseUrl, supabaseKey);
