// Server-side Supabase client for use in API route handlers.
// This is different from the browser client (supabase.ts) because
// API routes run on the server and need to read auth from cookies,
// not from localStorage (which doesn't exist server-side).

import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createServerSupabaseClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          // In Route Handlers the cookie store may be read-only,
          // so we wrap this in a try/catch to avoid crashing.
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Safe to ignore — only matters for middleware session refresh
          }
        },
      },
    }
  )
}
