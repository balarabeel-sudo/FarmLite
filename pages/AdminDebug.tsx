import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'

// TEMPORARY diagnostic page - not gated, just prints raw query results as
// plain text so it's readable on a phone without needing DevTools.
// Visit /admin-debug while signed in, screenshot the page, then delete
// this file + its route once the /admin redirect bug is fixed.
export default function AdminDebug() {
  const [text, setText] = useState('Loading...')

  useEffect(() => {
    async function run() {
      const lines: string[] = []

      const { data: authData, error: authError } = await supabase.auth.getUser()
      const user = authData?.user
      lines.push('=== AUTH USER ===')
      lines.push('id: ' + (user?.id || 'null'))
      lines.push('email: ' + (user?.email || 'null'))
      lines.push('authError: ' + (authError ? JSON.stringify(authError) : 'none'))

      if (!user) {
        setText(lines.join('\n'))
        return
      }

      lines.push('')
      lines.push('=== STAFF QUERY ===')
      const { data: staff, error: staffError, status } = await supabase
        .from('staff')
        .select('id, user_id, full_name, email, status, role_id, roles(id, name)')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .maybeSingle()

      lines.push('http status: ' + status)
      lines.push('error: ' + (staffError ? JSON.stringify(staffError) : 'none'))
      lines.push('data: ' + JSON.stringify(staff, null, 2))

      if (staff?.role_id) {
        lines.push('')
        lines.push('=== ROLE_PERMISSIONS QUERY ===')
        const { data: perms, error: permsError, status: permsStatus } = await supabase
          .from('role_permissions')
          .select('permissions(key)')
          .eq('role_id', staff.role_id)

        lines.push('http status: ' + permsStatus)
        lines.push('error: ' + (permsError ? JSON.stringify(permsError) : 'none'))
        lines.push('data: ' + JSON.stringify(perms, null, 2))
      }

      setText(lines.join('\n'))
    }
    run()
  }, [])

  return (
    <pre style={{ padding: '16px', fontSize: '12px', whiteSpace: 'pre-wrap', wordBreak: 'break-word', background: '#F8FAF6', minHeight: '100vh' }}>
      {text}
    </pre>
  )
}
