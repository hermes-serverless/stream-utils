import { createFsWriteStream } from '@hermes-serverless/fs-utils'
import { randomBytes } from 'crypto'
import execa from 'execa'
import fs from 'fs'
import os from 'os'
import path from 'path'
import { PassThrough } from 'stream'
import { streamFinished } from '..'
import { StringStream } from '../StringStream'

const tmpPath = path.join(os.tmpdir(), 'stream-finished-tests')

describe('Readable streams', () => {
  test('Finished on success', async done => {
    const s = new StringStream('a')
    const p = streamFinished(s)
    s.resume()
    await p
    done()
  })

  test('Finish on destroy', () => {
    const s = new StringStream('a')
    const p = streamFinished(s)
    s.destroy()
    return expect(p).rejects.toThrow('Premature close')
  })

  test('Finish on error', () => {
    const s = new StringStream('a')
    const p = streamFinished(s)
    s.emit('error', new Error('Custom error'))
    return expect(p).rejects.toThrow('Custom error')
  })

  test('Finish on pipe', async done => {
    const s1 = new StringStream('a')
    const s2 = new PassThrough()
    s1.pipe(s2)
    const p = streamFinished(s1)
    await p
    done()
  })
})

describe('Writable streams', () => {
  beforeEach(() => {
    execa.sync('rm', ['-rf', tmpPath])
    if (!fs.existsSync(tmpPath)) fs.mkdirSync(tmpPath, { recursive: true })
  })

  test('Finished on success', async done => {
    const filePath = path.join(tmpPath, randomBytes(8).toString('hex'))
    const s = await createFsWriteStream(filePath)
    const p = streamFinished(s)
    s.end('abc')
    await p
    done()
  })

  test('Finish on destroy', async () => {
    const filePath = path.join(tmpPath, randomBytes(8).toString('hex'))
    const s = await createFsWriteStream(filePath)
    const p = streamFinished(s)
    s.destroy()
    await expect(p).rejects.toThrow('Premature close')
  })

  test('Finish on error', async () => {
    const filePath = path.join(tmpPath, randomBytes(8).toString('hex'))
    const s = await createFsWriteStream(filePath)
    const p = streamFinished(s)
    s.emit('error', new Error('Custom error'))
    await expect(p).rejects.toThrow('Custom error')
  })

  test('Finish on pipe', async done => {
    const filePath = path.join(tmpPath, randomBytes(8).toString('hex'))
    const s1 = new PassThrough()
    const s2 = await createFsWriteStream(filePath)
    s1.pipe(s2)
    s1.end('asdf')
    const p = streamFinished(s1)
    await p
    done()
  })
})

describe('Duplex streams', () => {
  test('Finished on success', async done => {
    const s = new PassThrough()
    const p = streamFinished(s)
    s.end('aaa')
    s.resume()
    await p
    done()
  })

  test('Finish when writable false', async done => {
    const s = new PassThrough()
    const p = streamFinished(s, { writable: false })
    s.push(null)
    s.resume()
    await p
    done()
  })

  test('Finish when readable false', async done => {
    const s = new PassThrough()
    const p = streamFinished(s, { readable: false })
    s.end('aaa')
    await p
    done()
  })

  test('Finish on destroy', () => {
    const s = new PassThrough()
    const p = streamFinished(s)
    s.destroy()
    return expect(p).rejects.toThrow('Premature close')
  })

  test('Finish on error', () => {
    const s = new PassThrough()
    const p = streamFinished(s)
    s.emit('error', new Error('Custom error'))
    return expect(p).rejects.toThrow('Custom error')
  })

  test('Finish on pipe', async done => {
    const s1 = new PassThrough()
    const s2 = new PassThrough()
    s1.pipe(s2)
    s1.end('aaa')
    const p = streamFinished(s1)
    await p
    done()
  })
})
