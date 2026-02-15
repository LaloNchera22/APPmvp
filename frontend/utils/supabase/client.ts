import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  // Access environment variables
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  // Fallback for build time or missing configuration
  if (!supabaseUrl || !supabaseKey) {
    console.warn('Supabase URL or Key is missing. Using placeholders for build.')
    return createBrowserClient(
      'https://placeholder-project.supabase.co',
      'placeholder-key'
    )
  }

  // Create the browser client with realtime configuration
  return createBrowserClient(
    supabaseUrl,
    supabaseKey,
    {
      realtime: {
        params: {
          eventsPerSecond: 10,
        },
      },
    }
  )
}
