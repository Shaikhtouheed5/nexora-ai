import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://oyvyeutjidgafipmgixz.supabase.co';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im95dnlldXRqaWRnYWZpcG1naXh6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUxNTEzNTUsImV4cCI6MjA5MDcyNzM1NX0.xrkl4iRMc7kjfOkPIZr6xF06izPr-0ysqaruAOP7kwg';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
