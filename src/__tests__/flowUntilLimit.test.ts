import fs from 'fs'
import { PassThrough } from 'stream'
import { flowUntilLimit, normalizeToWritableWithEnd } from '../flowUntilLimit'
import { streamFinished } from '../streamFinished'
import { checkMD5, checkSize, getReadStream, TestFileManager } from './testUtils'

const MB = 1000

describe('Check normalizeToWritableWithEnd', () => {
  test('Only one writable', () => {
    const stream = new PassThrough()
    expect(normalizeToWritableWithEnd(stream)).toEqual([{ stream, end: true }])
  })

  test('Writable array', () => {
    const s1 = new PassThrough()
    expect(normalizeToWritableWithEnd([s1])).toEqual([{ stream: s1, end: true }])
  })

  test('Writable array', () => {
    const s1 = new PassThrough()
    const s2 = new PassThrough()
    expect(normalizeToWritableWithEnd([s1, s2])).toEqual([
      { stream: s1, end: true },
      { stream: s2, end: true },
    ])
  })

  test('Only one WritableWithEnd', () => {
    const s = { stream: new PassThrough(), end: false }
    expect(normalizeToWritableWithEnd(s)).toEqual([s])
  })

  test('Only one WritableWithEnd', () => {
    const s = { stream: new PassThrough(), end: true }
    expect(normalizeToWritableWithEnd(s)).toEqual([s])
  })

  test('Only one WritableWithEnd', () => {
    const s = { stream: new PassThrough() }
    expect(normalizeToWritableWithEnd(s)).toEqual([{ ...s, end: true }])
  })

  test('WritableWithEnd array', () => {
    const s1 = { stream: new PassThrough() }
    const s2 = { stream: new PassThrough(), end: false }
    const s3 = { stream: new PassThrough(), end: true }
    expect(normalizeToWritableWithEnd([s1, s2, s3])).toEqual([{ ...s1, end: true }, s2, s3])
  })

  test('Mixed WritableWithEnd and Writable array', () => {
    const s1 = new PassThrough()
    const s2 = { stream: new PassThrough() }
    const s3 = { stream: new PassThrough(), end: false }
    const s4 = { stream: new PassThrough(), end: true }
    expect(normalizeToWritableWithEnd([s1, s2, s3, s4])).toEqual([
      { stream: s1, end: true },
      { ...s2, end: true },
      s3,
      s4,
    ])
  })
})

const testFiles = new TestFileManager('flow-until-limit-tests')

testFiles.createStreamFile({ baseSizeKB: 1 })
testFiles.createStreamFile({ baseSizeKB: 10 })
testFiles.createStreamFile({ baseSizeKB: 100 })
testFiles.createStreamFile({ baseSizeKB: 1000 })
testFiles.createStreamFile({ baseSizeKB: 20 * MB })
testFiles.createStreamFile({ baseSizeKB: 30 * MB })
testFiles.createStreamFile({ baseSizeKB: 40 * MB })
testFiles.createStreamFile({ baseSizeKB: 50 * MB })
testFiles.createStreamFile({ baseSizeKB: 100 * MB })
testFiles.createTextFile({ text: 'ola eu sou o goku', testname: 'goku' })
testFiles.createTextFile({ text: 'a', repeats: 100, testname: '1e2a' })
testFiles.createTextFile({ text: 'a', repeats: 1000, testname: '1e3a' })
testFiles.createTextFile({ text: 'a', repeats: 10000, testname: '1e4a' })
testFiles.createTextFile({ text: 'a', repeats: 100000, testname: '1e5a' })
testFiles.createTextFile({ text: 'a', repeats: 1000000, testname: '1e6a' })
testFiles.createTextFile({ text: 'b', repeats: 1000000, testname: '1e6b' })
testFiles.createTextFile({ text: 'c', repeats: 1000000, testname: '1e6c' })
testFiles.createTextFile({ text: 'a', repeats: 10000000, testname: '1e7a' })
testFiles.createTextFile({ text: 'b', repeats: 10000000, testname: '1e7b' })
testFiles.createTextFile({ text: 'b', repeats: 100000000, testname: '1e8b' })

beforeAll(async () => {
  await testFiles.waitForFilesCreation()
}, 30 * 1000)

afterAll(() => {
  testFiles.cleanUpTestFiles()
}, 30 * 1000)

describe('Check if streaming for flowUntilLimit is working properly', () => {
  describe('One dest', () => {
    test.each(testFiles.files)('%s', async (_, bytes, testFile) => {
      const { file, filepath } = await testFiles.getWriteStream()
      const src = await getReadStream(testFile)

      const p = Promise.all([streamFinished(src), streamFinished(file)])
      await flowUntilLimit(src, {
        dest: file,
      })

      await p
      expect(checkSize(testFile, filepath)).toBe(true)
      expect(checkMD5(testFile, filepath)).toBe(true)
    })
  })

  describe('2 dests', () => {
    test.each(testFiles.files)('%s', async (_, bytes, testFile) => {
      const f = await Promise.all([testFiles.getWriteStream(), testFiles.getWriteStream()])
      const src = await getReadStream(testFile)

      const p = Promise.all([
        streamFinished(src),
        streamFinished(f[0].file),
        streamFinished(f[1].file),
      ])
      await flowUntilLimit(src, {
        dest: f.map(el => el.file),
      })

      await p
      f.forEach(el => {
        expect(checkSize(testFile, el.filepath)).toBe(true)
        expect(checkMD5(testFile, el.filepath)).toBe(true)
      })
    })
  })

  describe('Without emit end', () => {
    test.each(testFiles.files)('%s', async (_, bytes, testFile) => {
      const f = await Promise.all([testFiles.getWriteStream(), testFiles.getWriteStream()])
      const src = await getReadStream(testFile)

      const p = Promise.all([
        streamFinished(src),
        streamFinished(f[0].file),
        streamFinished(f[1].file),
      ])
      await flowUntilLimit(src, {
        dest: [f[0].file, { stream: f[1].file, end: false }],
      })

      f[1].file.end()
      await p

      f.forEach(el => {
        expect(checkSize(testFile, el.filepath)).toBe(true)
        expect(checkMD5(testFile, el.filepath)).toBe(true)
      })
    })
  })

  describe('Without dest stream', () => {
    test.each(testFiles.files)('%s', async (_, bytes, testFile) => {
      const src = await getReadStream(testFile)
      const p = Promise.all([streamFinished(src)])
      const dataTransfered = await flowUntilLimit(src)
      await p
      const { size } = fs.statSync(testFile)
      expect(dataTransfered).toBe(size)
    })
  })
})

describe('Check if limits for flowUntilLimit is working properly', () => {
  describe('One dest', () => {
    const setupPipeAndCheckStreamedData = async (
      testFile: string,
      expectedBufferSize: number,
      limit?: number
    ) => {
      const onLimit = jest.fn()
      const buffers: Buffer[] = []

      const onData = jest.fn((data: Buffer) => {
        buffers.push(data)
      })

      const src = await getReadStream(testFile)

      const { file: dest, filepath } = await testFiles.getWriteStream()
      const p = Promise.all([streamFinished(src), streamFinished(dest)])

      await flowUntilLimit(src, {
        limit,
        onLimit,
        onData,
        dest,
      })

      await p
      try {
        const allDataBuffer = Buffer.concat(buffers)
        const resBuffer = fs.readFileSync(filepath)
        expect(allDataBuffer.length).toBe(expectedBufferSize)
        expect(resBuffer.length).toBe(expectedBufferSize)
        expect(resBuffer.equals(allDataBuffer)).toBe(true)
        return {
          onData,
          onLimit,
        }
      } catch (err) {
        console.error(`Error reading file ${filepath}`, err)
        console.log(testFiles.getFilesOnDir())
        throw err
      }
    }

    test.each(testFiles.files)(
      'Should reach limit - Random Limits for: %s',
      async (_, bytes, testFile) => {
        let limit = Math.floor(Math.random() * bytes)
        if (limit === bytes) limit -= 1
        const { onLimit, onData } = await setupPipeAndCheckStreamedData(testFile, limit, limit)
        expect(onLimit).toBeCalledTimes(1)
        expect(onData).toBeCalled()
      }
    )

    test.each(testFiles.files)(
      'Should not reach limit - limit = size - %s',
      async (_, bytes, testFile) => {
        const limit = bytes
        const { onLimit, onData } = await setupPipeAndCheckStreamedData(testFile, bytes, limit)
        expect(onLimit).not.toBeCalled()
        expect(onData).toBeCalled()
      }
    )

    test.each(testFiles.files)(
      'Should not reach limit - limit = undefined - %s',
      async (_, bytes, testFile) => {
        const { onLimit, onData } = await setupPipeAndCheckStreamedData(testFile, bytes)
        expect(onLimit).not.toBeCalled()
        expect(onData).toBeCalled()
      }
    )

    test.each(testFiles.files)('Should reach limit - limit = 0', async (_, bytes, testFile) => {
      const limit = 0
      const { onLimit, onData } = await setupPipeAndCheckStreamedData(testFile, limit, limit)
      expect(onLimit).toBeCalledTimes(1)
      expect(onData).toBeCalledTimes(1)
    })
  })

  describe('2 dest', () => {
    const setupPipeAndCheckStreamedData = async (
      testFile: string,
      expectedBufferSize: number,
      limit?: number
    ) => {
      const onLimit = jest.fn()
      const buffers: Buffer[] = []

      const onData = jest.fn((data: Buffer) => {
        buffers.push(data)
      })

      const src = await getReadStream(testFile)
      const f = await Promise.all([testFiles.getWriteStream(), testFiles.getWriteStream()])
      const p = Promise.all([
        streamFinished(src),
        streamFinished(f[0].file),
        streamFinished(f[1].file),
      ])
      await flowUntilLimit(src, {
        limit,
        onLimit,
        onData,
        dest: f.map(el => el.file),
      })

      await p

      const allDataBuffer = Buffer.concat(buffers)
      expect(allDataBuffer.length).toBe(expectedBufferSize)

      f.forEach(el => {
        try {
          const resBuffer = fs.readFileSync(el.filepath)
          expect(resBuffer.length).toBe(expectedBufferSize)
          expect(resBuffer.equals(allDataBuffer)).toBe(true)
        } catch (err) {
          console.error(`Error reading file ${el.filepath}`, err)
          console.log(testFiles.getFilesOnDir())
          throw err
        }
      })

      return {
        onData,
        onLimit,
      }
    }

    test.each(testFiles.files)(
      'Should reach limit - Random Limits for: %s',
      async (_, bytes, testFile) => {
        let limit = Math.floor(Math.random() * bytes)
        if (limit === bytes) limit -= 1
        const { onLimit, onData } = await setupPipeAndCheckStreamedData(testFile, limit, limit)
        expect(onLimit).toBeCalledTimes(1)
        expect(onData).toBeCalled()
      }
    )

    test.each(testFiles.files)(
      'Should not reach limit - limit = size - %s',
      async (_, bytes, testFile) => {
        const limit = bytes
        const { onLimit, onData } = await setupPipeAndCheckStreamedData(testFile, bytes, limit)
        expect(onLimit).not.toBeCalled()
        expect(onData).toBeCalled()
      }
    )

    test.each(testFiles.files)(
      'Should not reach limit - limit = undefined - %s',
      async (_, bytes, testFile) => {
        const { onLimit, onData } = await setupPipeAndCheckStreamedData(testFile, bytes)
        expect(onLimit).not.toBeCalled()
        expect(onData).toBeCalled()
      }
    )

    test.each(testFiles.files)(
      'Should reach limit - limit = 0 - %s',
      async (_, bytes, testFile) => {
        const limit = 0
        const { onLimit, onData } = await setupPipeAndCheckStreamedData(testFile, limit, limit)
        expect(onLimit).toBeCalledTimes(1)
        expect(onData).toBeCalledTimes(1)
      }
    )
  })

  describe('Without emit end', () => {
    const setupPipeAndCheckStreamedData = async (
      testFile: string,
      expectedBufferSize: number,
      limit?: number
    ) => {
      const onLimit = jest.fn()
      const buffers: Buffer[] = []

      const onData = jest.fn((data: Buffer) => {
        buffers.push(data)
      })

      const src = await getReadStream(testFile)
      const f = await Promise.all([testFiles.getWriteStream(), testFiles.getWriteStream()])
      const p = Promise.all([
        streamFinished(src),
        streamFinished(f[0].file),
        streamFinished(f[1].file),
      ])

      await flowUntilLimit(src, {
        limit,
        onLimit,
        onData,
        dest: [f[0].file, { stream: f[1].file, end: false }],
      })

      f[1].file.end()
      await p

      const allDataBuffer = Buffer.concat(buffers)
      expect(allDataBuffer.length).toBe(expectedBufferSize)

      f.forEach(el => {
        try {
          const resBuffer = fs.readFileSync(el.filepath)
          expect(resBuffer.length).toBe(expectedBufferSize)
          expect(resBuffer.equals(allDataBuffer)).toBe(true)
        } catch (err) {
          console.error(`Error reading file ${el.filepath}`, err)
          console.log(testFiles.getFilesOnDir())
          throw err
        }
      })

      return {
        onData,
        onLimit,
      }
    }

    test.each(testFiles.files)(
      'Should reach limit - Random Limits for: %s',
      async (_, bytes, testFile) => {
        let limit = Math.floor(Math.random() * bytes)
        if (limit === bytes) limit -= 1
        const { onLimit, onData } = await setupPipeAndCheckStreamedData(testFile, limit, limit)
        expect(onLimit).toBeCalledTimes(1)
        expect(onData).toBeCalled()
      }
    )

    test.each(testFiles.files)(
      'Should not reach limit - limit = size - %s',
      async (_, bytes, testFile) => {
        const limit = bytes
        const { onLimit, onData } = await setupPipeAndCheckStreamedData(testFile, bytes, limit)
        expect(onLimit).not.toBeCalled()
        expect(onData).toBeCalled()
      }
    )

    test.each(testFiles.files)(
      'Should not reach limit - limit = undefined - %s',
      async (_, bytes, testFile) => {
        const { onLimit, onData } = await setupPipeAndCheckStreamedData(testFile, bytes)
        expect(onLimit).not.toBeCalled()
        expect(onData).toBeCalled()
      }
    )

    test.each(testFiles.files)(
      'Should reach limit - limit = 0 - %s',
      async (_, bytes, testFile) => {
        const limit = 0
        const { onLimit, onData } = await setupPipeAndCheckStreamedData(testFile, limit, limit)
        expect(onLimit).toBeCalledTimes(1)
        expect(onData).toBeCalledTimes(1)
      }
    )
  })

  describe('Without dest stream', () => {
    const setupPipeAndCheckStreamedData = async (
      testFile: string,
      expectedBufferSize: number,
      limit?: number
    ) => {
      const onLimit = jest.fn()
      const buffers: Buffer[] = []

      const onData = jest.fn((data: Buffer) => {
        buffers.push(data)
      })

      const src = await getReadStream(testFile)
      const p = Promise.all([streamFinished(src)])

      const dataTransfered = await flowUntilLimit(src, {
        limit,
        onLimit,
        onData,
      })

      await p

      const allDataBuffer = Buffer.concat(buffers)
      expect(allDataBuffer.length).toBe(expectedBufferSize)
      expect(dataTransfered).toBe(expectedBufferSize)
      return {
        onData,
        onLimit,
      }
    }

    test.each(testFiles.files)(
      'Should reach limit - Random Limits for: %s - %s',
      async (_, bytes, testFile) => {
        let limit = Math.floor(Math.random() * bytes)
        if (limit === bytes) limit -= 1
        const { onLimit, onData } = await setupPipeAndCheckStreamedData(testFile, limit, limit)
        expect(onLimit).toBeCalledTimes(1)
        expect(onData).toBeCalled()
      }
    )

    test.each(testFiles.files)(
      'Should not reach limit - limit = size - %s',
      async (_, bytes, testFile) => {
        const limit = bytes
        const { onLimit, onData } = await setupPipeAndCheckStreamedData(testFile, bytes, limit)
        expect(onLimit).not.toBeCalled()
        expect(onData).toBeCalled()
      }
    )

    test.each(testFiles.files)(
      'Should not reach limit - limit = undefined - %s',
      async (_, bytes, testFile) => {
        const { onLimit, onData } = await setupPipeAndCheckStreamedData(testFile, bytes)
        expect(onLimit).not.toBeCalled()
        expect(onData).toBeCalled()
      }
    )

    test.each(testFiles.files)(
      'Should reach limit - limit = 0 - %s',
      async (_, bytes, testFile) => {
        const limit = 0
        const { onLimit, onData } = await setupPipeAndCheckStreamedData(testFile, limit, limit)
        expect(onLimit).toBeCalledTimes(1)
        expect(onData).toBeCalledTimes(1)
      }
    )
  })
})
