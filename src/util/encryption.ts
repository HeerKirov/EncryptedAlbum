import {sha256, sha224} from "js-sha256"

/**
 * 将image的二进制信息加密到buffer。
 * 加密步骤为：
 *      从key生成加密串passwdBuf。
 *      从key生成分组用的size和offset。
 *      将buf按{size}位一组，组内循环向右推{offset}位，然后和passwdBuf异或，并输出。
 * @param key
 * @param buf
 */
function encryptBuffer(key: string, buf: Buffer): Buffer {
    let passwd = turnToPasswordSequence(key)
    let passwdBuf = turnToBinary(passwd)
    let groupSize = calculateNumeric(key, 1024)
    let groupOffset = calculateNumeric(key, 128)
    return xor(loopChange(buf, groupSize, groupOffset), passwdBuf)
}

/**
 * 将image的二进制信息从buffer解密。
 * 解密步骤为：
 *      从key生成解密串passwdBuf。
 *      用解密串和buf异或，得到decodeBuf。
 *      从key生成分组用的size和offset。
 *      将decodeBuf按{size}位一组，组内循环向左推{offset}位，并输出。
 * @param key 解密使用的key。
 * @param buf 要解密的buffer。
 */
function decryptBuffer(key: string, buf: Buffer): Buffer {
    let passwd = turnToPasswordSequence(key)
    let passwdBuf = turnToBinary(passwd)
    let decodeBuf = xor(buf, passwdBuf)
    let groupSize = calculateNumeric(key, 1024)
    let groupOffset = calculateNumeric(key, 128)
    return loopChange(decodeBuf, groupSize, -groupOffset)
}

/**
 * 将存储结构化信息用的json解构加密至buffer。
 * 加密步骤为：
 *      从key生成加密串passwdBuf。
 *      从key生成flag标记。再用flag生成prefix标记。
 *      将json序列化，前面接prefix构成data。
 *      将data转换为buffer，然后按8位一组，循环向右推1，然后将得到的dataBuf和passwdBuf异或，得到输出。
 * @param key 加密使用的key。
 * @param json 要加密的json结构。
 */
function encrypt(key: string, json: Object): Buffer {
    let passwd = turnToPasswordSequence(key)
    let flag = turnToFlagSequence(key)
    let passwdBuf = turnToBinary(passwd)
    let data = `DATA:${flag}:${JSON.stringify(json)}`
    let dataBuf = loopChange(turnToBinary(data), 8, 1)
    return xor(dataBuf, passwdBuf)
}

/**
 * 将存储结构化信息用的json结构从buffer解密。
 * 解密步骤为：
 *      从key生成解密串passwdBuf。
 *      从key生成flag标记。再用flag生成prefix标记。
 *      用解密串passwdBuf和buf异或，得到decodeBuf。
 *      将decodeBuf的位按8位一组，循环向左推1，并转换到字符串，得到解密后的数据data。
 *      判断data的首位是否是prefix。如果是，那么解密成功，将剩下的部分作为json解构。
 * @param key 解密使用的key。
 * @param buf 要解密的buffer。
 */
function decrypt(key: string, buf: Buffer): Object {
    let passwd = turnToPasswordSequence(key)
    let flag = turnToFlagSequence(key)
    let passwdBuf = turnToBinary(passwd)
    let decodeBuf = xor(buf, passwdBuf)
    let data = turnToString(loopChange(decodeBuf, 8, -1))
    let prefix = `DATA:${flag}:`
    if(data.length >= prefix.length && data.slice(0, prefix.length) == prefix) {
        return JSON.parse(data.slice(prefix.length))
    }else{
        return null
    }
}

function turnToPasswordSequence(key: string): string {
    return sha224(`photos.${key}.heerkirov.com`)
}
function turnToFlagSequence(key: string): string {
    return sha256(`photos.${key}.heerkirov.com`)
}
/**
 * 将字符串转换为buffer。
 * @param key
 */
function turnToBinary(key: string): Buffer {
    return Buffer.from(key)
}
/**
 * 将buffer转换回字符串。
 * @param binary
 */
function turnToString(binary: Buffer): string {
    return binary.toString()
}
/**
 * 对buffer进行循环更替。每最多groupSize个字节位一组，组内进行循环移位。
 * @param arr buffer。
 * @param groupSize 组的大小。
 * @param step 向右循环移位的位移。为负数时向左。
 */
function loopChange(arr: Buffer, groupSize: number, step: number): Buffer {
    let length = arr.length
    let ret = Buffer.alloc(length)
    for(let i = 0; i < length; ++i) {
        let head = Math.floor(i / groupSize) * groupSize
        let tail = head + groupSize
        if(tail > length) tail = length
        let goal = i - step
        while(goal < head) goal += tail - head
        while(goal >= tail) goal -= tail - head
        ret[i] = arr[goal]
    }
    return ret
}
/**
 * 异或两个buffer。这个异或以data为基准，key会循环使用。
 * @param data
 * @param key
 */
function xor(data: Buffer, key: Buffer): Buffer {
    let ret = Buffer.alloc(data.length)
    for(let i = 0, j = 0; i < data.length; ++i, ++j) {
        if(j >= key.length) j = 0
        let byte = data[i], byte1 = key[j]
        ret[i] = byte ^ byte1
    }
    return ret
}
/**
 * 将一个字符串计算为一个整数。这只是一个普通的单向映射整数，其数值很小，且完全不保证不重复。
 * @param key
 * @param limit
 */
function calculateNumeric(key: string, limit: number=256): number {
    let n = 0
    for(let i = 0; i < key.length; ++i) {
        n += key.charCodeAt(i)
    }
    if(limit < 1) limit = 1
    while(n > limit) {
        n >>= 1
    }
    return n
}


export {turnToBinary, turnToString, loopChange, xor,
    encrypt, decrypt, encryptBuffer, decryptBuffer,
    calculateNumeric}