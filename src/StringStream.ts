import { Readable } from 'stream'

export class StringStream extends Readable {
  str: string

  constructor(str: string, options?: any) {
    super(options)
    this.str = str
  }

  _read() {
    this.push(this.str)
    this.push(null)
  }
}
