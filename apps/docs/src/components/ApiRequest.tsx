import React from 'react'
import Tabs from '@theme/Tabs'
import TabItem from '@theme/TabItem'

export function ApiRequest({
  method,
  path,
  children,
}: {
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  path: string
  children?: React.ReactNode
}) {
  return (
    <div className="margin-bottom--md">
      <div>
        <strong>{method}</strong> <code>{path}</code>
      </div>
      {children ? (
        <Tabs>
          <TabItem value="body" label="Body">
            {children}
          </TabItem>
        </Tabs>
      ) : null}
    </div>
  )
}
