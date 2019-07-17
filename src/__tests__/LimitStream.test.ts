import fs from 'fs'
import { pipeline } from 'stream'
import util from 'util'
import { LimitStream } from '../LimitStream'
import { checkMD5, checkSize, getReadStream, TestFileManager } from './testUtils'

const TIMEOUT = 30 * 1000
const MB = 1000

describe('Check if streaming for LimitStream is working properly', () => {
  const testFiles = new TestFileManager('LimitStream-basic')

  testFiles.createStreamFile({ baseSizeKB: 10 * MB })
  testFiles.createStreamFile({ baseSizeKB: 100 * MB })
  testFiles.createStreamFile({ baseSizeKB: 500 * MB, zero: true })
  testFiles.createStreamFile({ baseSizeKB: 1000 * MB, zero: true })
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

  beforeAll(async () => {
    await testFiles.waitForFilesCreation()
  }, TIMEOUT)

  afterAll(() => {
    testFiles.cleanUpTestFiles()
  }, TIMEOUT)

  test.each(testFiles.files)(
    '%s',
    async (_, bytes, testFile) => {
      const { file, filepath } = await testFiles.getWriteStream()
      const src = await getReadStream(testFile)
      const pass = new LimitStream()
      await util.promisify(pipeline)(src, pass, file)
      src.destroy()
      file.destroy()
      expect(checkSize(testFile, filepath)).toBe(true)
      expect(checkMD5(testFile, filepath)).toBe(true)
    },
    TIMEOUT
  )

  test.each(testFiles.files)(
    'Without dest stream: %s',
    async (_, bytes, testFile) => {
      const src = await getReadStream(testFile)
      const pass = new LimitStream()
      const promise = util.promisify(pipeline)(src, pass)
      pass.resume()
      await promise

      src.destroy()
      const { size } = fs.statSync(testFile)
      expect(pass.getBytesTransfered()).toBe(size)
    },
    TIMEOUT
  )
})

describe('Check if limits for LimitStream is working properly', () => {
  const testFiles = new TestFileManager('LimitStream-limit')

  testFiles.createStreamFile({ baseSizeKB: 1 })
  testFiles.createStreamFile({ baseSizeKB: 10 })
  testFiles.createStreamFile({ baseSizeKB: 100 })
  testFiles.createStreamFile({ baseSizeKB: 1000 })
  testFiles.createStreamFile({ baseSizeKB: 20 * MB })
  testFiles.createStreamFile({ baseSizeKB: 30 * MB })
  testFiles.createStreamFile({ baseSizeKB: 40 * MB })
  testFiles.createStreamFile({ baseSizeKB: 50 * MB })
  testFiles.createStreamFile({ baseSizeKB: 100 * MB })
  testFiles.createStreamFile({ baseSizeKB: 200 * MB })
  testFiles.createStreamFile({ baseSizeKB: 500 * MB, zero: true })
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
  }, TIMEOUT)

  afterAll(() => {
    testFiles.cleanUpTestFiles()
  })

  describe('Tests for limits with dest stream', () => {
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
      const { file, filepath } = await testFiles.getWriteStream()
      const pass = new LimitStream({
        limit,
        onData,
        onLimit,
      })

      await util.promisify(pipeline)(src, pass, file)

      src.destroy()
      file.destroy()

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
      },
      TIMEOUT
    )

    test.each(testFiles.files)(
      'Should not reach limit - limit = size',
      async (_, bytes, testFile) => {
        const limit = bytes
        const { onLimit, onData } = await setupPipeAndCheckStreamedData(testFile, bytes, limit)
        expect(onLimit).not.toBeCalled()
        expect(onData).toBeCalled()
      },
      TIMEOUT
    )

    test.each(testFiles.files)(
      'Should not reach limit - limit = undefined',
      async (_, bytes, testFile) => {
        const { onLimit, onData } = await setupPipeAndCheckStreamedData(testFile, bytes)
        expect(onLimit).not.toBeCalled()
        expect(onData).toBeCalled()
      },
      TIMEOUT
    )

    test.each(testFiles.files)(
      'Should reach limit - limit = 0',
      async (_, bytes, testFile) => {
        const limit = 0
        const { onLimit, onData } = await setupPipeAndCheckStreamedData(testFile, limit, limit)
        expect(onLimit).toBeCalledTimes(1)
        expect(onData).toBeCalledTimes(1)
      },
      TIMEOUT
    )
  })

  describe('Tests for limits without dest stream', () => {
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
      const pass = new LimitStream({
        limit,
        onData,
        onLimit,
      })
      const promise = util.promisify(pipeline)(src, pass)
      pass.resume()
      await promise

      src.destroy()

      const allDataBuffer = Buffer.concat(buffers)
      expect(allDataBuffer.length).toBe(expectedBufferSize)
      expect(pass.getBytesTransfered()).toBe(expectedBufferSize)
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
      },
      TIMEOUT
    )

    test.each(testFiles.files)(
      'Should not reach limit - limit = size',
      async (_, bytes, testFile) => {
        const limit = bytes
        const { onLimit, onData } = await setupPipeAndCheckStreamedData(testFile, bytes, limit)
        expect(onLimit).not.toBeCalled()
        expect(onData).toBeCalled()
      },
      TIMEOUT
    )

    test.each(testFiles.files)(
      'Should not reach limit - limit = undefined',
      async (_, bytes, testFile) => {
        const { onLimit, onData } = await setupPipeAndCheckStreamedData(testFile, bytes)
        expect(onLimit).not.toBeCalled()
        expect(onData).toBeCalled()
      },
      TIMEOUT
    )

    test.each(testFiles.files)(
      'Should reach limit - limit = 0',
      async (_, bytes, testFile) => {
        const limit = 0
        const { onLimit, onData } = await setupPipeAndCheckStreamedData(testFile, limit, limit)
        expect(onLimit).toBeCalledTimes(1)
        expect(onData).toBeCalledTimes(1)
      },
      TIMEOUT
    )
  })
})
