import stream, { Readable, Writable } from 'stream'
import util from 'util'

interface PipeUntilLimitArgs {
  src: Readable
  dest: Writable
  limit?: number
  onData?: (data: Buffer | string) => void
  onLimit?: () => void
}

export const _canTransferData = (dataTransfered: number, limit: null | number) => {
  return limit == null || dataTransfered < limit
}

export const _willSurpassLimit = (
  dataToWrite: string | Buffer,
  dataTransfered: number,
  limit: null | number
) => {
  return limit != null && dataTransfered + dataToWrite.length > limit
}

export const pipeUntilLimit = async (args: PipeUntilLimitArgs) => {
  const { src, dest, onData: onDataCallback, onLimit: onLimitCallback, limit } = {
    limit: null,
    ...args,
  } as PipeUntilLimitArgs

  let dataTransfered = 0
  let isDrained = true

  let closedSrc = false
  const closeSrc = () => {
    if (closedSrc) return
    closedSrc = true
    src.removeListener('data', onData)
    src.resume()
    if (isDrained) dest.end()
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

      const ret = dest.write(dataToWrite)
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
  dest.on('drain', onDrain)

  const finishSrc = util
    .promisify(stream.finished)(src)
    .finally(() => {
      src.removeListener('data', onData)
    })

  const finishDest = util
    .promisify(stream.finished)(dest)
    .finally(() => {
      dest.removeListener('drain', onDrain)
    })

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
