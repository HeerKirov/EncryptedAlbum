/**用于外部解密本地存储文件的工具。
 * 前提是你知道你要解密的文件在哪里，以及你的密码是什么。
 * node target/decrypt.js <password> <filepath>
 */

import {decrypt} from './common/utils'
import {readFileSync} from 'fs'

function decryptIt(key: string, filename: string): void {
    let data: Buffer = readFileSync(filename, {encoding: null})
    let content: Object = decrypt(key, data)
    console.log(JSON.stringify(content, null, 4))
}


const argv = process.argv.slice(2)
decryptIt(argv[0], argv[1])