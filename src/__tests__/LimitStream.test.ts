import fs from 'fs'
import { pipeline } from 'stream'
import util from 'util'
import { LimitStream, _canTransferData, _willSurpassLimit } from '../LimitStream'
import { streamFinished } from '../streamFinished'
import { checkMD5, checkSize, getReadStream, TestFileManager } from './testUtils'

const MB = 1000

const testFiles = new TestFileManager('limit-stream-tests')

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

describe('Check _canTransferData', () => {
  test.each([[1, 2], [2, 3], [0, 1], [1000, null], [2000, null], [0, null]])(
    'Test if returns true',
    (dataTransfered: number, limit: null | number) => {
      expect(_canTransferData(dataTransfered, limit)).toBe(true)
    }
  )

  test.each([[2, 2], [3, 3], [4, 3], [10, 1], [0, 0], [1, 0]])(
    'Test if returns false',
    (dataTransfered: number, limit: null | number) => {
      expect(_canTransferData(dataTransfered, limit)).toBe(false)
    }
  )
})

describe('Check _willSurpassLimit', () => {
  test.each([['ab', 1, 2], ['abc', 1, 2], ['a', 0, 0], ['abcd', 1, 4]])(
    'Test if returns true',
    (dataToWrite: string, dataTransfered: number, limit: null | number) => {
      expect(_willSurpassLimit(dataToWrite, dataTransfered, limit)).toBe(true)
    }
  )

  test.each([
    ['', 1, 1],
    ['a', 1, 2],
    ['abc', 0, 3],
    ['abcd', 5, null],
    ['abcdefg', 5, null],
    ['abcdef', 2000000, null],
  ])(
    'Test if returns false',
    (dataToWrite: string, dataTransfered: number, limit: null | number) => {
      expect(_willSurpassLimit(dataToWrite, dataTransfered, limit)).toBe(false)
    }
  )
})

describe('Check if streaming for LimitStream is working properly', () => {
  test.each(testFiles.files)('%s', async (_, bytes, testFile) => {
    const { file, filepath } = await testFiles.getWriteStream()
    const src = await getReadStream(testFile)
    const pass = new LimitStream()
    const p = Promise.all([streamFinished(src), streamFinished(file)])
    await util.promisify(pipeline)(src, pass, file)
    await p
    expect(checkSize(testFile, filepath)).toBe(true)
    expect(checkMD5(testFile, filepath)).toBe(true)
  })

  test.each(testFiles.files)('Without dest stream: %s', async (_, bytes, testFile) => {
    const src = await getReadStream(testFile)
    const pass = new LimitStream()
    const promise = util.promisify(pipeline)(src, pass)
    const p = Promise.all([streamFinished(src), streamFinished(pass)])
    pass.resume()
    await promise
    await p
    const { size } = fs.statSync(testFile)
    expect(pass.getBytesTransfered()).toBe(size)
  })
})

describe('Check if limits for LimitStream is working properly', () => {
  beforeAll(async () => {
    await testFiles.waitForFilesCreation()
  })

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

      const p = Promise.all([streamFinished(src), streamFinished(pass), streamFinished(file)])
      await util.promisify(pipeline)(src, pass, file)
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
      'Should not reach limit - limit = size',
      async (_, bytes, testFile) => {
        const limit = bytes
        const { onLimit, onData } = await setupPipeAndCheckStreamedData(testFile, bytes, limit)
        expect(onLimit).not.toBeCalled()
        expect(onData).toBeCalled()
      }
    )

    test.each(testFiles.files)(
      'Should not reach limit - limit = undefined',
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
      const p = Promise.all([streamFinished(src), streamFinished(pass)])
      const promise = util.promisify(pipeline)(src, pass)
      pass.resume()
      await promise
      await p

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
      }
    )

    test.each(testFiles.files)(
      'Should not reach limit - limit = size',
      async (_, bytes, testFile) => {
        const limit = bytes
        const { onLimit, onData } = await setupPipeAndCheckStreamedData(testFile, bytes, limit)
        expect(onLimit).not.toBeCalled()
        expect(onData).toBeCalled()
      }
    )

    test.each(testFiles.files)(
      'Should not reach limit - limit = undefined',
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
})
