import { createContext, useContext, useEffect, useMemo, useState, ReactNode } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from './supabaseClient'
import { detachPushFromAccount, syncPushSubscription } from './pushShared'

type AuthContextValue = {
  session: Session | null
  user: User | null
  loading: boolean
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue>({
  session: null,
  user: null,
  loading: true,
  signOut: async () => {},
})

// Supabase sends a fresh session object every time the app comes back to the foreground or a token is
// renewed in the background. If every one of those replaced `user`, every page that depends on `user`
// would reload its data and drop what was being typed. So the same person keeps the same object
// until something about them really changes.
function sameUser(a: User | null, b: User | null): boolean {
  if (a === b) return true
  if (!a || !b) return false
  return a.id === b.id && a.updated_at === b.updated_at && a.email === b.email
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const apply = (next: Session | null) => {
      setUser((prev) => (sameUser(prev, next?.user ?? null) ? prev : next?.user ?? null))
      // Only signing in or out changes the session seen by the app; renewed tokens are handled by Supabase itself.
      setSession((prev) => ((prev?.user?.id ?? null) === (next?.user?.id ?? null) && !!prev === !!next ? prev : next))
      setLoading(false)
    }

    supabase.auth.getSession().then(({ data }) => apply(data.session))

    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => apply(newSession))

    return () => listener.subscription.unsubscribe()
  }, [])

  // When someone signs in on a device that already allowed notifications, attach the device to that account.
  const userId = session?.user?.id
  useEffect(() => {
    if (userId) syncPushSubscription()
  }, [userId])

  const signOut = async () => {
    await detachPushFromAccount()
    await supabase.auth.signOut()
  }

  const value = useMemo(() => ({ session, user, loading, signOut }), [session, user, loading])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  return useContext(AuthContext)
}
