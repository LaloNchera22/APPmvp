import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url || !key) {
    console.warn('Supabase URL or Key is missing. Using placeholders for build.')
    return createBrowserClient(
      'https://placeholder-project.supabase.co',
      'placeholder-key'
    )
  }

  return createBrowserClient(
    url,
    key,
    {
      realtime: {
        params: {
          eventsPerSecond: 10,
        },
      },
    }
  )
}
