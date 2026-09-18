import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://mkzrhjlkqowmmuxlvijx.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1renJoamxrcW93bW11eGx2aWp4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk2ODk1MDgsImV4cCI6MjEwNTI2NTUwOH0.h92r6hnqWnRkbR91u_xM5AvS3zU1lTrj2VS-d6Ia6J8'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
})
