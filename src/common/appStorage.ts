import { DataEngine } from "./engine";

/**
 * app本地存储data的存储类。
 */
class AppStorage {
    private authenticated: boolean = false
    private initialized: boolean = null

    private mainFormula: Formula = null
    private secondaryFormula: Array<Formula> = new Array()

    authenticate(loginPassword: String): boolean {
        if(!this.authenticated) {
            //TODO
        }else{
            return true
        }
    }
    isAuthenticated(): boolean {
        return this.authenticated
    }

    /**
     * 初始化本地存储。使用于第一次打开app和重置后。
     * 初始化存储需要密码和主存方案。
     * 初始化后会自动认证。
     */
    initialize(password: string, formula: Formula): void {
        if(!this.isInitialized()) {

        }
    }
    /**
     * 存储是否已经初始化过。
     */
    isInitialized(): boolean {
        if(this.initialized != null) {
            return this.initialized
        }else {

            //TODO set initialized
        }
    }

    loadMainEngine(): DataEngine {
        return this.mainFormula.buildEngine()
    }
    loadSecondaryEngine(id: string): DataEngine {
        this.secondaryFormula.forEach(element => {
            if(element.id == id) {
                return element.buildEngine()
            }
        })
        return null
    }
}

interface Formula {
    readonly type: string
    id: string
    key: string,
    config: Object
    buildEngine(): DataEngine
}

function encrypt(key: string, json: Object): string {
    let passwd = turnToPasswordSequence(key)
    let flag = turnToFlagSequence(key)
    let passwdBuf = turnToBinary(passwd)
    let data = 'DATA:' + flag + ':' + JSON.stringify(json)
    let dataBuf = loopChange(turnToBinary(data), 8, 1)
    let finalBuf = xor(dataBuf, passwdBuf)
    return turnToString(finalBuf)
}

function turnToPasswordSequence(key: string): string {
    throw new Error()
}
function turnToFlagSequence(key: string): string {
    throw new Error()
}
function turnToBinary(key: string): number[] {
    throw new Error()
}
function turnToString(binary: number[]): string {
    throw new Error()
}
function loopChange<T>(arr: T[], groupSize: number, step: number): T[] {
    throw new Error()
}
function xor(data: number[], key: number[]): number[] {
    throw new Error()
}
/**
 * 存储使用的方案：
 * 以json为数据结构。
 * {
 *      mainFormula: {
 *          id: <string>, type: <string>, key: <string>, ...
 *      },
 *      secondaryFormulas: [...]
 * }
 * 这个结构会被加密后，写入appDataFolder下的data.dat文件中。
 * 加密方案：
 * 1. 将用户密码的string通过加盐转换后，转换为字节序列，随后平铺至二进制序列。
 * 2. 将密码串通过另一个加盐转换，得到一个标记序列。标记序列的长度必须超过密码串。
 * 2. 将json结构转换为string，在前面追加“DATA:标记序列:”标记，然后转换为二进制序列。二进制序列以8位为一组，组内位循环向右推1位。
 * 3. 使密码串和数据串异或，并循环密码串，得到结果。
 * 解密：
 * 1. 同样方式处理用户密码，得到密码串和标记序列。
 * 2. 取得加密串。将二者异或，并循环密码串，得到解密的二进制序列。
 * 3. 二进制序列以8位为一组，组内位循环向左推1位。
 * 4. 转换为string。如果string的前几位是"DATA:标记序列:"则解密成功，剩下的部分转换为json。
 */
export {AppStorage, Formula}