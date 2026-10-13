import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const sanitizeSupabaseUrl = (url?: string): string => {
  if (!url) return 'http://127.0.0.1:54321';
  let cleaned = url.trim();
  // Automatically strip trailing /rest/v1 or /rest/v1/ or trailing slashes
  cleaned = cleaned.replace(/\/rest\/v1\/?$/i, '').replace(/\/+$/, '');
  return cleaned;
};

export const supabaseUrl = sanitizeSupabaseUrl(process.env.EXPO_PUBLIC_SUPABASE_URL);
export const supabaseAnonKey = (
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJpYXQiOjE2ODAwMDAwMDAsImV4cCI6MjAwMDAwMDAwMH0.MOCK_ANON_KEY_FOR_LOCAL_DEV'
).trim();

// Use AsyncStorage for native & web token storage
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: Platform.OS === 'web',
  },
});
