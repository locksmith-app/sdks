import React from 'react'
import Tabs from '@theme/Tabs'
import TabItem from '@theme/TabItem'

export function CodeSampleTabs({
  ts,
  py,
  go,
}: {
  ts: string
  py?: string
  go?: string
}) {
  return (
    <Tabs groupId="sdk-lang">
      <TabItem value="ts" label="TypeScript">
        <pre><code className="language-typescript">{ts}</code></pre>
      </TabItem>
      {py ? (
        <TabItem value="py" label="Python">
          <pre><code className="language-python">{py}</code></pre>
        </TabItem>
      ) : null}
      {go ? (
        <TabItem value="go" label="Go">
          <pre><code className="language-go">{go}</code></pre>
        </TabItem>
      ) : null}
    </Tabs>
  )
}
