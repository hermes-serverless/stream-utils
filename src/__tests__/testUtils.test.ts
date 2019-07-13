import fs from 'fs'
import path from 'path'
import { checkMD5 } from './testUtils'
import { humanizeSize, TestFileManager } from './testUtils/TestFileManager'

const TIMEOUT = 30 * 1000
const MB = 1000

describe('Tests for test functions', () => {
  const tmpFolder = 'testUtils'

  test('Check MD5 different', () => {
    const f1 = path.join(__dirname, 'testUtils.test.ts')
    const f2 = path.join(__dirname, 'pipeUntilLimit.test.ts')
    expect(checkMD5(f1, f2)).toBe(false)
  })

  test('Check MD5 equal', () => {
    const f1 = path.join(__dirname, 'pipeUntilLimit.test.ts')
    expect(checkMD5(f1, f1)).toBe(true)
  })

  test(
    'Check create and delete random bits stream file',
    async () => {
      const testFiles = new TestFileManager(tmpFolder)
      testFiles.createStreamFile({
        baseSizeKB: 10 * MB,
        zero: false,
      })

      expect(testFiles.files.length).toBe(1)
      expect(testFiles.promisesPending.length).toBe(1)
      await testFiles.waitForFilesCreation()

      const [name, bytesize, file] = testFiles.files[0]
      expect(() => fs.accessSync(file)).not.toThrow()
      const { size } = fs.statSync(file)
      expect(size).toBe(bytesize)
      expect(name).toBe(`Random bits ${humanizeSize(bytesize)}`)
      testFiles.cleanUpTestFiles()
      expect(() => fs.accessSync(file)).toThrow()
    },
    TIMEOUT
  )

  test(
    'Check create and delete zero bits stream file',
    async () => {
      const testFiles = new TestFileManager(tmpFolder)
      testFiles.createStreamFile({
        baseSizeKB: 10 * MB,
        zero: true,
      })

      expect(testFiles.files.length).toBe(1)
      expect(testFiles.promisesPending.length).toBe(1)
      await testFiles.waitForFilesCreation()

      const [name, bytesize, file] = testFiles.files[0]
      expect(() => fs.accessSync(file)).not.toThrow()
      const { size } = fs.statSync(file)
      expect(size).toBe(bytesize)
      expect(name).toBe(`Zero bits ${humanizeSize(bytesize)}`)
      testFiles.cleanUpTestFiles()
      expect(() => fs.accessSync(file)).toThrow()
    },
    TIMEOUT
  )

  test(
    'Check create text files',
    async () => {
      const testFiles = new TestFileManager(tmpFolder)
      testFiles.createTextFile({
        text: 'a',
        repeats: 100,
        testname: '100a',
      })

      expect(testFiles.files.length).toBe(1)
      expect(testFiles.promisesPending.length).toBe(1)
      await testFiles.waitForFilesCreation()

      const [name, bytesize, file] = testFiles.files[0]
      expect(() => fs.accessSync(file)).not.toThrow()
      const { size } = fs.statSync(file)
      expect(size).toBe(bytesize)
      expect(name).toBe(`Text test: 100a - ${humanizeSize(bytesize)}`)
      testFiles.cleanUpTestFiles()
      expect(() => fs.accessSync(file)).toThrow()
    },
    TIMEOUT
  )

  test(
    'Check create text files without using repetition',
    async () => {
      const testFiles = new TestFileManager(tmpFolder)
      testFiles.createTextFile({
        text: 'a',
        testname: '1a',
      })

      expect(testFiles.files.length).toBe(1)
      expect(testFiles.promisesPending.length).toBe(1)
      await testFiles.waitForFilesCreation()

      const [name, bytesize, file] = testFiles.files[0]
      expect(() => fs.accessSync(file)).not.toThrow()
      const { size } = fs.statSync(file)
      expect(size).toBe(bytesize)
      expect(name).toBe(`Text test: 1a - ${humanizeSize(bytesize)}`)
      testFiles.cleanUpTestFiles()
      expect(() => fs.accessSync(file)).toThrow()
    },
    TIMEOUT
  )

  test(
    'Check mixed files',
    async () => {
      const testFiles = new TestFileManager(tmpFolder)
      testFiles.createTextFile({
        text: 'a',
        repeats: 100,
        testname: '100a',
      })

      testFiles.createStreamFile({
        baseSizeKB: 10 * MB,
        zero: true,
      })

      testFiles.createStreamFile({
        baseSizeKB: 10 * MB,
        zero: false,
      })

      expect(testFiles.files.length).toBe(3)
      expect(testFiles.promisesPending.length).toBe(3)
      await testFiles.waitForFilesCreation()

      testFiles.files.forEach(el => {
        const [_, bytesize, file] = el
        expect(() => fs.accessSync(file)).not.toThrow()
        const { size } = fs.statSync(file)
        expect(size).toBe(bytesize)
      })

      testFiles.cleanUpTestFiles()
      testFiles.files.forEach(el => expect(() => fs.accessSync(el[2])).toThrow())
    },
    TIMEOUT
  )
})
