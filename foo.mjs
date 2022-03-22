import bar from './bar.mjs'
import notexistImported from './notexist.mjs'
console.error({notexistImported})

export const barInFoo = bar.bar
console.log({bar})
