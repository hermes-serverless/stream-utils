import makeArray from 'make-array'
import { Readable, Writable } from 'stream'
import { LimitStream, LimitStreamOptions } from './LimitStream'
import { streamFinished } from './streamFinished'

export interface WritableWithEnd {
  stream: Writable
  end?: boolean
}

interface FlowUntilLimitOptions extends LimitStreamOptions {
  dest?: Writable | Writable[] | (Writable | WritableWithEnd)[]
}

export const normalizeToWritableWithEnd = (
  obj: Writable | WritableWithEnd | (Writable | WritableWithEnd)[]
) => {
  return (makeArray(obj) as (Writable | WritableWithEnd)[]).map(
    (el): WritableWithEnd => {
      if (el.hasOwnProperty('stream')) return { end: true, ...(el as WritableWithEnd) }
      return { stream: el as Writable, end: true }
    }
  )
}

export const flowUntilLimit = async (src: Readable, options?: FlowUntilLimitOptions) => {
  const { dest, onData, onLimit, limit }: FlowUntilLimitOptions = options || {}

  const limitcb = () => {
    src.unpipe(limiter)
    src.resume()
    limiter.end()
    if (onLimit) onLimit()
  }

  const destArr = normalizeToWritableWithEnd(dest)
  const limiter = new LimitStream({ onData, limit, onLimit: limitcb })
  src.pipe(limiter)
  destArr.forEach(el =>
    limiter.pipe(
      el.stream,
      { end: el.end }
    )
  )

  if (destArr.length === 0) limiter.resume()

  const errors = []
  const limiterPromise = streamFinished(limiter)
  const destPromise = Promise.all(
    destArr.map(el =>
      el.end ? streamFinished(el.stream).catch(err => errors.push(err)) : limiterPromise
    )
  )
  try {
    await limiterPromise
  } catch (err) {
    errors.push(err)
  }

  try {
    await destPromise
  } catch (err) {
    errors.push(err)
  }

  if (errors.length > 0) throw errors
  return limiter.getBytesTransfered()
}
