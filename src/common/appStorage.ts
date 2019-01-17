import {DataEngine} from "./engine"
import {readFileSync, existsSync, writeFileSync, mkdirSync} from "fs"
import {encrypt, decrypt} from "./utils"
import {LocalFormula} from "./localEngine"

const STORAGE = "data.dat"
let base: string = ''
function APP_FOLDER() {
    return `${base}/data`
}

/**
 * app本地存储data的存储类。
 */
class AppStorage {
    static setBaseFolder(basePath: string) {
        base = basePath
    }
    static authenticate(loginPassword: string): AppStorage {
        let buf = readFileSync(`${APP_FOLDER()}/${STORAGE}`)
        let data = decrypt(loginPassword, buf)
        if(data != null) {
            return new AppStorage(data, loginPassword)
        }else{
            return null
        }
    }
    static initialize(password: string, formula: Formula): AppStorage {
        let data = {
            mainFormula: formula,
            secondaryFormulas: []
        }
        let storage = new AppStorage(data, password)
        storage.save()
        return storage
    }
    static isInitialized(): boolean {
        return existsSync(`${APP_FOLDER()}/${STORAGE}`)
    }

    private mainFormula: Formula = null
    private secondaryFormula: Formula[] = []

    private constructor(json: Object, private password: string) {
        this.mainFormula = createFormula(json['mainFormula'])
        this.secondaryFormula = []
        if(json['secondFormulas']) {
            for(let i in json['secondFormulas']) {
                this.secondaryFormula[i] = createFormula(json['secondaryFormulas'][i])
            }
        }
    }

    getPassword(): string {
        return this.password
    }
    setPassword(password: string): void {
        this.password = password
    }
    save() {
        let buf = encrypt(this.password, {
            mainFormula: this.mainFormula,
            secondFormulas: this.secondaryFormula
        })
        try {
            mkdirSync(APP_FOLDER()) //该方法并不可以递归创建文件夹。
        }catch (e) {
            //resume
        }
        writeFileSync(`${APP_FOLDER()}/${STORAGE}`, buf)
    }

    getMainFormula(): Formula {
        return this.mainFormula
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
    loadAllSecondaryEngine(): DataEngine[] {
        let ret = []
        for(let i in this.secondaryFormula) {
            ret[i] = this.secondaryFormula[i].buildEngine()
        }
        return ret
    }
}

interface Formula {
    readonly type: string
    id: string
    key: string
    buildEngine(): DataEngine
}

function createFormula(data: Object): Formula {
    let type = data['type']
    switch(type) {
        case 'local': return new LocalFormula(data['id'], data['key'], data['storage'])
        default: return null
    }
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
export {AppStorage, Formula, encrypt, decrypt}