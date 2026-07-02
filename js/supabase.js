import { createClient } from '@supabase/supabase-js';

// Read from Vite env variables or fallback to dynamically configured ones stored in local storage
let supabaseUrl = import.meta.env.VITE_SUPABASE_URL || localStorage.getItem('FIN_SUPABASE_URL') || '';
let supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || localStorage.getItem('FIN_SUPABASE_ANON_KEY') || '';

export let supabase = null;

export function isSupabaseConfigured() {
    return !!(supabaseUrl && supabaseAnonKey);
}

if (isSupabaseConfigured()) {
    try {
        supabase = createClient(supabaseUrl, supabaseAnonKey);
    } catch (e) {
        console.error("Failed to initialize Supabase client:", e);
    }
}

export function saveSupabaseConfig(url, anonKey) {
    localStorage.setItem('FIN_SUPABASE_URL', url.trim());
    localStorage.setItem('FIN_SUPABASE_ANON_KEY', anonKey.trim());
    supabaseUrl = url.trim();
    supabaseAnonKey = anonKey.trim();
    supabase = createClient(supabaseUrl, supabaseAnonKey);
    return true;
}

export function clearSupabaseConfig() {
    localStorage.removeItem('FIN_SUPABASE_URL');
    localStorage.removeItem('FIN_SUPABASE_ANON_KEY');
    supabaseUrl = '';
    supabaseAnonKey = '';
    supabase = null;
}
