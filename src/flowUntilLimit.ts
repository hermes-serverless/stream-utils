import makeArray from 'make-array'
import stream, { Readable, Writable } from 'stream'
import util from 'util'

interface FlowUntilLimitOptions {
  dest?: Writable | Writable[]
  limit?: number
  onData?: (data: Buffer | string) => void
  onLimit?: () => void
}

type Nullable<T> = T | null
interface NormalizedOptions {
  dest: Nullable<Writable | Writable[]>
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
  let flooded = 0

  const onDrain = (index: number) => () => {
    if (destArr[index].flooded) {
      destArr[index].flooded = false
      flooded -= 1
    }
    if (closedSrc) destArr[index].stream.end()
    src.resume()
  }

  const destArr = (makeArray(dest) as Writable[]).map((el, index) => ({
    flooded: false,
    stream: el,
    onDrain: onDrain(index),
  }))

  let closedSrc = false
  const closeSrc = () => {
    if (closedSrc) return
    closedSrc = true
    src.removeListener('data', onData)
    src.resume()
    destArr.forEach(el => {
      if (!el.flooded) el.stream.end()
    })
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

      destArr.forEach(el => {
        const res = el.stream.write(dataToWrite)
        if (!res && !el.flooded) {
          el.flooded = true
          flooded += 1
        }
      })

      dataTransfered += dataToWrite.length
      if (onDataCallback) onDataCallback(dataToWrite)
      if (flooded > 0) src.pause()
    }

    if (exceedLimit) {
      if (onLimitCallback) onLimitCallback()
      closeSrc()
    }
  }

  src.on('data', onData)
  destArr.forEach(el => el.stream.on('drain', el.onDrain))

  const finishSrc = util
    .promisify(stream.finished)(src)
    .finally(() => {
      src.removeListener('data', onData)
    })

  const finishDestArr = Promise.all(
    destArr.map(el => {
      return util
        .promisify(stream.finished)(el.stream)
        .catch(closeSrc)
    })
  )

  let error
  try {
    await finishSrc
  } catch (err) {
    error = err
  }

  closeSrc()

  try {
    await finishDestArr
  } catch (err) {
    if (!error) error = err
  }

  if (error) throw error
  return dataTransfered
}
