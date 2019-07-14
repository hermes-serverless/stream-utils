import stream, { Readable, Writable } from 'stream'
import util from 'util'

interface FlowUntilLimitOptions {
  dest?: Writable
  limit?: number
  onData?: (data: Buffer | string) => void
  onLimit?: () => void
}

type Nullable<T> = T | null
interface NormalizedOptions {
  dest: Nullable<Writable>
  limit: Nullable<number>
  onData: Nullable<(data: Buffer | string) => void>
  onLimit: Nullable<() => void | null>
}

const normalizeOpts = (options: FlowUntilLimitOptions): NormalizedOptions => {
  return {
    dest: null,
    limit: null,
    onData: null,
    onLimit: null,
    ...options,
  } as NormalizedOptions
}

export const _canTransferData = (dataTransfered: number, limit: Nullable<number>) => {
  return limit == null || dataTransfered < limit
}

export const _willSurpassLimit = (
  dataToWrite: string | Buffer,
  dataTransfered: number,
  limit: Nullable<number>
) => {
  return limit != null && dataTransfered + dataToWrite.length > limit
}

export const flowUntilLimit = async (src: Readable, options?: FlowUntilLimitOptions) => {
  const { dest, onData: onDataCallback, onLimit: onLimitCallback, limit } = normalizeOpts(
    options || {}
  )

  let dataTransfered = 0
  let isDrained = true

  let closedSrc = false
  const closeSrc = () => {
    if (closedSrc) return
    closedSrc = true
    src.removeListener('data', onData)
    src.resume()
    if (isDrained && dest != null) dest.end()
  }

  const onData = (chunk: Buffer) => {
    let dataToWrite = chunk
    const exceedLimit = _willSurpassLimit(dataToWrite, dataTransfered, limit)
    if (limit <= 0 && onDataCallback) onDataCallback(Buffer.from(''))

    if (_canTransferData(dataTransfered, limit)) {
      if (exceedLimit) {
        const allowedSize = limit - dataTransfered
        dataToWrite = dataToWrite.slice(0, allowedSize)
      }

      const ret = dest != null ? dest.write(dataToWrite) : true
      dataTransfered += dataToWrite.length
      if (onDataCallback) onDataCallback(dataToWrite)
      if (!ret) {
        isDrained = false
        src.pause()
      }
    }

    if (exceedLimit) {
      if (onLimitCallback) onLimitCallback()
      closeSrc()
    }
  }

  const onDrain = () => {
    isDrained = true
    if (closedSrc) dest.end()
    src.resume()
  }

  src.on('data', onData)
  if (dest != null) dest.on('drain', onDrain)

  const finishSrc = util
    .promisify(stream.finished)(src)
    .finally(() => {
      src.removeListener('data', onData)
    })

  const finishDest =
    dest != null
      ? util
          .promisify(stream.finished)(dest)
          .finally(() => {
            dest.removeListener('drain', onDrain)
          })
      : Promise.resolve()

  let error
  try {
    await finishSrc
  } catch (err) {
    error = err
  }

  closeSrc()

  try {
    await finishDest
  } catch (err) {
    if (!error) error = err
  }

  if (error) throw error
  return dataTransfered
}
