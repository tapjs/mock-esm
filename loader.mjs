try {
  Object.defineProperty(global, '__tapmockLoader', {
    value: import.meta.url,
    writable: false,
    configurable: false,
    enumerable: false,
  })
} catch (er) {
  if (global.__tapmockLoader !== import.meta.url) {
    throw Object.assign(new Error('Multiple tapMock loaders detected'), {
      found: global.__tapmockLoader,
      wanted: import.meta.url,
    })
  }
}

const { hasOwnProperty } = Object.prototype
const hasOwn = (o, k) => hasOwnProperty.call(o, k)
const [_, ...version] =
  process.version.match(/v([0-9]+)\.([0-9]+)\.([0-9]+)/).map(n => +n)
if (version[0] < 12) {
  throw new Error('not supported on node 10 and earlier')
}
const stringExports = version[0] >= 16

const buildSrc = (m, key, url) => {
  const mock = m.mocks[url]
  let hasDefault = false
  const keySrc = `__tapmock${key}`
  const mockSrc = `global.${keySrc}.mocks[${JSON.stringify(url)}]`
  let i = 0
  const src = Object.keys(mock).map(k => {
    if (k === 'default') {
      hasDefault = true
      return `const defExp = ${mockSrc}.default
export default defExp\n`
    } else {
      const kSrc = JSON.stringify(k)
      // older node versions can't rename exports, oh well.
      // means mock keys must all be valid identifiers.
      if (stringExports) {
        return `const exp${i} = ${mockSrc}[${kSrc}]
export {exp${i++} as ${kSrc}}\n`
      } else {
        try {
          new Function(`let ${k}`)
        } catch (_) {
          // make it throw from where the user actually called this
          const er = new Error(`invalid identifier in mock object: ${kSrc}`)
          er.stack = er.message + '\n' + m.caller.stack
          throw er
        }
        return `export const ${k} = ${mockSrc}[${kSrc}]\n`
      }
    }
  })
  if (!hasDefault) {
    src.push(`const defExp = ${mockSrc}
export default defExp\n`)
  }
  console.error(src)
  return src.join('\n')
}

// for node 14
export const getFormat = async (url, context, defaultFn) =>
  url.startsWith('tapmock://') ? { format: 'module' }
    : defaultFn(url, context, defaultFn)
export const getSource = async (url, context, defaultFn) =>
  load(url, context, defaultFn)

export const load = async (url, context, defaultFn) => {
  if (url.startsWith('tapmock://')) {
    const u = new URL(url)
    const key = u.host
    const mockURL = u.searchParams.get('url')
    if (!key || !mockURL) {
      return defaultFn(url, context, defaultFn)
    }

    const m = global[`__tapmock${key}`]
    if (!m || !hasOwn(m.mocks, mockURL)) {
      return defaultFn(mockURL, context, defaultFn)
    }

    const source = buildSrc(m, key, mockURL)
    return {
      format: 'module',
      source,
    }
  }
  const res = defaultFn(url, context, defaultFn)
  return res
}

export const resolve = async (url, context, defaultFn) => {
  if (!context.parentURL) {
    return defaultFn(url, context, defaultFn)
  }
  const p = new URL(context.parentURL)
  const key = p.searchParams.get('tapmock')
  if (!key) {
    return defaultFn(url, context, defaultFn)
  }
  const m = global[`__tapmock${key}`]
  if (!m || !m.mocks || typeof m.mocks !== 'object' || m.key !== key) {
    return defaultFn(url, context, defaultFn)
  }

  const resolvedURL = String(new URL(url, context.parentURL))
  if (!hasOwn(m.mocks, resolvedURL)) {
    // parent is mocked, but this module isn't, so the things IT loads
    // should be loaded from the mock, even though it isn't.
    const mocker = new URL(resolvedURL)
    mocker.searchParams.set('tapmock', key)
    return defaultFn(mocker, context, defaultFn)
  }

  const mockRes = new URL(`tapmock://${key}/`)
  mockRes.searchParams.set('url', resolvedURL)
  return { url: `${mockRes}`, format: 'module' }
}
