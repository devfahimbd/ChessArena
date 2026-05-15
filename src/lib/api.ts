/**
 * API Fetch Helper
 *
 * Development: সরাসরি /api/* কল হবে (Next.js API routes)
 * Production: Render.com এর URL এ কল হবে
 */

const API_BASE = process.env.NEXT_PUBLIC_API_URL || ''

export async function apiFetch<T>(
  endpoint: string,
  options?: RequestInit
): Promise<T> {
  const url = `${API_BASE}${endpoint}`

  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  })

  const data = await response.json()

  if (!response.ok) {
    throw new Error(data.error || 'API request failed')
  }

  return data as T
}

// Auth token সহ request
export function authHeaders(token: string): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
  }
}
