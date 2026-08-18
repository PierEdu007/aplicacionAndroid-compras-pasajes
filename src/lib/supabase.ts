import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

export const SUPABASE_URL = 'https://ybnenttufdztznupgigk.supabase.co';
export const SUPABASE_ANON_KEY = 'sb_publishable_Mdx2PoPGjjz1S7FtJpSucw__QkNvuMF';

export const API_BASE_URL = 'https://www.turismotunkychasky.com.pe';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
