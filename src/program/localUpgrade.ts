/**将v0.1.0-Beta的localEngine存储结构升级到v0.2.0-Beta。
 * node target/localUpgrade.js <password> <save_path>
 */
import {decrypt, encrypt} from '../common/utils'
import {readFileSync, writeFileSync} from 'fs'

function decryptIt(key: string, filename: string): Object {
    let data: Buffer = readFileSync(filename, {encoding: null})
    return decrypt(key, data)
}

function encryptIt(key: string, filename: string, content: Object): void {
    let data: Buffer = encrypt(key, content)
    writeFileSync(filename, data, {encoding: null})
}

function updateV0_1_0toV0_2_0(key: string, filename: string): void {
    let data: Object = decryptIt(key, filename)
    //TODO 完成结构升级
}

const argv = process.argv.slice(2)
updateV0_1_0toV0_2_0(argv[0], argv[1])