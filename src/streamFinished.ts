import { Waiter } from '@hermes-serverless/custom-promises'
import { finished, Readable, Writable } from 'stream'

export interface StreamFinishedOptions {
  readable?: boolean
  writable?: boolean
}

export const streamFinished = (stream: Readable | Writable, options?: StreamFinishedOptions) => {
  const waiter = new Waiter()
  // @ts-ignore
  const clearListeners = finished(stream, options || {}, (err: any) => {
    clearListeners()
    if (err) return waiter.reject(err)
    waiter.resolve()
  })
  return waiter.finish()
}
