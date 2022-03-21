import {mock, unmock} from './mock.mjs'

const main = async () => {
  let foo = await mock('./foo.mjs', {
    './bar.mjs': {
      // 'bar space': 'spacemock',
      bar: 'mockbar',
    },
  })
  console.log(foo)
}
main()
