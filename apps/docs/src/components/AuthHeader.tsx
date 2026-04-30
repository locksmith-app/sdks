import React from 'react'

export function AuthHeader() {
  return (
    <table>
      <thead>
        <tr>
          <th>Header</th>
          <th>Value</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td><code>X-API-Key</code></td>
          <td><code>lsm_live_…</code> or <code>lsm_sbx_…</code></td>
        </tr>
        <tr>
          <td><code>Authorization</code></td>
          <td><code>Bearer &lt;access_token&gt;</code> (for <code>/me</code> and bearer-only routes)</td>
        </tr>
      </tbody>
    </table>
  )
}
