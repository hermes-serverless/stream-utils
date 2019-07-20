import getStream from 'get-stream'
import { StringStream } from '..'

test.each([
  '',
  'abc',
  '.'.repeat(10),
  '+'.repeat(20),
  '.'.repeat(40),
  '+'.repeat(80),
  '.'.repeat(160),
  '+'.repeat(320),
  '.'.repeat(640),
  '+'.repeat(1280),
  '.'.repeat(2560),
  '+'.repeat(5120),
  '.'.repeat(10240),
  '+'.repeat(20480),
  '.'.repeat(40960),
  '+'.repeat(81920),
])('Test %#', (str: string) => {
  const stream = new StringStream(str)
  return expect(getStream(stream)).resolves.toEqual(str)
})
