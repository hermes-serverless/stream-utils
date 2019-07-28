import { Transform, TransformOptions } from 'stream'

export interface LimitStreamOptions {
  limit?: number
  onData?: (data: Buffer | string) => void
  onLimit?: () => void
}

type Nullable<T> = T | null
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

export class LimitStream extends Transform {
  private bytesTransfered: number
  private limitReached: boolean
  private limit?: number
  private onData?: (data: Buffer | string) => void
  private onLimit?: () => void

  constructor(limiterOptions?: LimitStreamOptions, duplexOptions?: TransformOptions) {
    super(duplexOptions)
    const { limit, onData, onLimit }: LimitStreamOptions = limiterOptions || {}
    this.limit = limit
    this.onData = onData
    this.onLimit = onLimit

    this.limitReached = false
    this.bytesTransfered = 0
  }

  _transform = (chunk: Buffer | string, encoding: string, cb: any) => {
    if (this.limitReached) return cb(null)

    let dataToWrite = chunk
    this.limitReached = _willSurpassLimit(dataToWrite, this.bytesTransfered, this.limit)
    if (this.limit <= 0 && this.onData) this.onData(Buffer.from(''))

    if (_canTransferData(this.bytesTransfered, this.limit)) {
      if (this.limitReached) {
        const allowedSize = this.limit - this.bytesTransfered
        dataToWrite = dataToWrite.slice(0, allowedSize)
      }

      this.push(dataToWrite)
      this.bytesTransfered += dataToWrite.length
      if (this.onData) this.onData(dataToWrite)
    }

    if (this.limitReached && this.onLimit) this.onLimit()
    return cb(null)
  }

  public getBytesTransfered = () => {
    return this.bytesTransfered
  }
}
