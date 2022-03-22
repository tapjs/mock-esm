import {mock} from './mock.mjs'

const main = async () => {
  let foo = await mock('./foo.mjs', {
    './notexist.mjs': 'if you will it, then it is no dream',
    './bar.mjs': {
      // 'bar space': 'spacemock',
      bar: 'mockbar',
    },
  })
  console.log({foo})
}
main()
