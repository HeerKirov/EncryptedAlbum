/**用于手动构造加密文件的工具。
 * 使用一串密钥和加密字符串，共同构成所需要的内容。
 * node target/program/encrypt.js <password> <filepath> <content.filepath>
 */

import {encrypt} from '../util/encryption'
import {readFileSync, writeFileSync} from 'fs'

function encryptIt(key: string, filename: string, contentFilename: string): void {
    let data: string = readFileSync(contentFilename).toString()
    let content = encrypt(key, JSON.parse(data))
    writeFileSync(filename, content)
}


const argv = process.argv.slice(2)
encryptIt(argv[0], argv[1], argv[2])