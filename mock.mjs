import {randomBytes} from 'crypto'
import StackUtils from 'stack-utils'
import {pathToFileURL, fileURLToPath} from 'url'
import {resolve, dirname} from 'path'

const stack = new StackUtils()
const loader = `${pathToFileURL(
  resolve(dirname(fileURLToPath(import.meta.url)), 'loader.mjs')
)}`

const getStack = fn => {
  const obj = {}
  Error.captureStackTrace(obj, mock)
  return obj.stack.split('\n').slice(1).join('\n')
}

export const mock = async (module, mocks) => {
  const at = Object.freeze(stack.at(mock))
  const {file} = at

  const path = file.startsWith('file:///') ? fileURLToPath(file)
    : resolve(file)
  const dir = dirname(path)
  const url = file.startsWith('file:///') ? file
    : pathToFileURL(resolve(file))

  if (global.__tapmockLoader !== loader) {
    const msg = `Cannot mock ESM. Run with --loader=${loader} to enable.`
    const er = Object.assign(new Error(msg), {
      found: global.__tapmockLoader,
      wanted: loader,
    })
    Error.captureStackTrace(er, mock)
    throw er
  }

  const key = randomBytes(8).toString('hex')

  mocks = Object.entries(mocks).map(([k, m]) => {
    if (/^(node:|file:\/\/\/|https?:\/\/)/.test(k)) {
      return [k, m]
    } else if (/^\.\.?\//.test(k)) {
      return [pathToFileURL(resolve(dir, k)), m]
    }
  }).reduce((o, kv) => {
    o[kv[0]] = kv[1]
    return o
  }, Object.create(null))

  Object.defineProperty(global, `__tapmock${key}`, {
    value: Object.freeze({
      mocks,
      key,
      caller: Object.freeze({
        path,
        dir,
        url,
        at,
        stack: getStack(mock),
      }),
    }),
    enumerable: false,
    configurable: false,
    writable: false,
  })

  const start = new URL(module, url)
  start.searchParams.set('tapmock', key)
  const result = await import(`${start}`)
  registry.set(result, key)
  return result
}
