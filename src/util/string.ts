const cLowerA = 'a'.charCodeAt(0), cLowerZ = 'z'.charCodeAt(0)
const cUpperA = 'A'.charCodeAt(0), cUpperZ = 'Z'.charCodeAt(0)
const cNum0 = '0'.charCodeAt(0), cNum9 = '9'.charCodeAt(0)
const cSpace = ' '.charCodeAt(0)

/**
 * 生成uuid。
 * @param len
 * @param radix
 */
function uuid(len, radix): string {
    const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'.split('')
    let uuid = []
    radix = radix || chars.length

    if (len) {
        for (let i = 0; i < len; i++) {
            uuid[i] = chars[0 | Math.random() * radix]
        }
    } else {
        uuid[8] = uuid[13] = uuid[18] = uuid[23] = '-'
        uuid[14] = '4'
        for (let i = 0; i < 36; i++) {
            if (!uuid[i]) {
                let r = 0 | Math.random() * 16
                uuid[i] = chars[(i == 19) ? (r & 0x3) | 0x8 : r]
            }
        }
    }
    return uuid.join('')
}

class Strings {
    /**
     * 检查search的串在keys中是否存在至少一个匹配。
     * 匹配模式：不区分大小写，search中的空格分隔会导致查询词拆分。
     * @param search
     * @param keys
     */
    static findLikeIn(search: string, keys: string[]): boolean {
        let ss = search.split(' ')
        for(let key of keys) {
            if(key) {
                let flag = false
                for(let s of ss) {
                    if(key.indexOf(s) >= 0) {
                        flag = true
                        break
                    }
                }
                if(flag) {
                    return true
                }
            }
        }
        return false
    }
    /**
     * 检查目标字符串是否仅具有字母、数字、空格。
     * @param str
     */
    static containsOnlyWord(str: string): boolean {
        for(let i = 0; i < str.length; ++i) {
            let c = str.charCodeAt(i)
            if((c < cLowerA || c > cLowerZ)&&(c < cUpperA || c > cUpperZ)&&(c < cNum0 || c > cNum9)&& c !== cSpace) {
                return false
            }
        }
        return true
    }
}

class DateTimes {
    static format(date: Date, fmt: string): string {
        let o = {
            "M+" : date.getMonth() + 1,
            "d+" : date.getDate(),
            "h+" : date.getHours(),
            "m+" : date.getMinutes(),
            "s+" : date.getSeconds(),
            "q+" : Math.floor((date.getMonth() + 3) / 3),
            "S"  : date.getMilliseconds()
        }
        if(/(y+)/.test(fmt)) {
            fmt = fmt.replace(RegExp.$1, (date.getFullYear() + "").substr(4 - RegExp.$1.length))
        }
        for(let k in o) {
            if(new RegExp("("+ k +")").test(fmt)){
                fmt = fmt.replace(RegExp.$1, (RegExp.$1.length === 1) ? (o[k]) : (("00" + o[k]).substr(("" + o[k]).length)))
            }
        }
        return fmt
    }
}

export {uuid, Strings, DateTimes}