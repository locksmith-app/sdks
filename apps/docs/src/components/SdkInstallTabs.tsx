import React from 'react'
import Tabs from '@theme/Tabs'
import TabItem from '@theme/TabItem'

export function SdkInstallTabs({ pkg = '@getlocksmith/sdk' }: { pkg?: string }) {
  return (
    <Tabs>
      <TabItem value="npm" label="npm">
        <pre><code>{`npm install ${pkg}`}</code></pre>
      </TabItem>
      <TabItem value="pnpm" label="pnpm">
        <pre><code>{`pnpm add ${pkg}`}</code></pre>
      </TabItem>
      <TabItem value="yarn" label="yarn">
        <pre><code>{`yarn add ${pkg}`}</code></pre>
      </TabItem>
    </Tabs>
  )
}
