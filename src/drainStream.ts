import { Readable } from 'stream'

export const drainStream = (stream: Readable) => {
  stream.on('readable', stream.read.bind(stream))
}
