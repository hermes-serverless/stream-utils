import { Waiter } from '@hermes-project/custom-promises'
import fs from 'fs'
import md5 from 'md5-file'
import os from 'os'
import path from 'path'

export const getTestFilesPath = (subfolder: string) => {
  return path.join(os.tmpdir(), 'stream-utils-test-files', subfolder)
}

export const checkMD5 = (originalFile: string, createdFile: string) => {
  const md5Original = md5.sync(originalFile)
  const md5Created = md5.sync(createdFile)
  return md5Original === md5Created
}

export const checkSize = (originalFile: string, createdFile: string) => {
  const original = fs.statSync(originalFile)
  const created = fs.statSync(createdFile)
  return original.size === created.size
}

export const getReadStream = async (testFile: string) => {
  const ready = new Waiter()
  const stream = fs.createReadStream(testFile)
  stream.on('open', () => {
    ready.resolve()
  })

  stream.on('error', err => {
    console.error('[getReadStream] Error', err)
    ready.reject()
  })

  await ready

  return stream
}

export { TestFileManager } from './TestFileManager'
