import { Waiter } from '@hermes-project/custom-promises'
import { randomBytes } from 'crypto'
import execa from 'execa'
import fs from 'fs'
import path from 'path'
import { getTestFilesPath } from '.'

const getScriptPath = (scriptName: string) => {
  return path.join(__dirname, 'scripts', scriptName)
}

export const humanizeSize = (size: number) => {
  let reduced: number = size
  let res: string = 'Bytes'
  if (reduced >= 1000) {
    reduced /= 1000
    res = `KB`
  }

  if (reduced >= 1000) {
    reduced /= 1000
    res = `MB`
  }

  return `${reduced.toFixed(2)} ${res}`
}

interface InitFileArgs {
  baseSizeKB: number
  zero?: boolean
}

interface CreateTextFileArgs {
  text: string
  repeats?: number
  testname: string
}

export class TestFileManager {
  private subfolder: string
  public promisesPending: Promise<any>[]
  public files: [string, number, string][]

  constructor(testName: string) {
    this.subfolder = getTestFilesPath(`${testName}-${randomBytes(16).toString('hex')}`)
    this.files = []
    this.promisesPending = []
  }

  public cleanUpTestFiles = () => {
    try {
      execa.sync('rm', ['-rf', this.subfolder])
    } catch (err) {
      console.error('[cleanUpTestFiles]', err)
      throw err
    }
  }

  public createTextFile = ({ text, repeats, testname }: CreateTextFileArgs) => {
    const rep = repeats ? repeats : 1
    const filePath = path.join(this.subfolder, `${testname}.txt.test.tmp`)

    const proc = execa.sync(getScriptPath('generateStringFile.sh'), [
      '-r',
      `${rep}`,
      filePath,
      text,
    ])
    this.promisesPending.push(Promise.resolve())

    const sizeInBytes = text.length * rep
    const name = `Text test: ${testname} - ` + humanizeSize(sizeInBytes)
    this.files.push([name, sizeInBytes, filePath])
  }

  public createStreamFile = ({ baseSizeKB, zero }: InitFileArgs) => {
    const max = baseSizeKB * 1.3
    const min = baseSizeKB * 0.7

    const sizeKB = Math.ceil(Math.random() * (max - min) + min)
    const sizeMB = sizeKB / 1000
    const sizeBytes = sizeKB * 1000
    const filePath = path.join(this.subfolder, `${sizeMB}.test.tmp`)
    const proc = execa.sync(getScriptPath('generateStreamFile.sh'), [
      ...(zero ? ['-z'] : []),
      filePath,
      `${sizeKB}`,
    ])
    this.promisesPending.push(Promise.resolve())

    const name = (zero ? `Zero bits ` : `Random bits `) + humanizeSize(sizeBytes)
    this.files.push([name, sizeBytes, filePath])
  }

  public waitForFilesCreation = () => {
    return Promise.all(this.promisesPending)
  }

  public getWriteStream = async () => {
    const ready = new Waiter()
    const filepath = path.join(this.subfolder, randomBytes(16).toString('hex'))
    const file = fs.createWriteStream(filepath)
    file.on('error', err => {
      console.error(`[TestFileManager] Error on write stream ${filepath}`, err)
      ready.reject(err)
      throw err
    })

    file.on('open', () => {
      ready.resolve()
    })

    await ready.finish()
    return {
      filepath,
      file,
    }
  }

  public getFilesOnDir = () => {
    try {
      return fs.readdirSync(this.subfolder)
    } catch (err) {
      console.error('[getFilesOnDir]', err)
      throw err
    }
  }
}
