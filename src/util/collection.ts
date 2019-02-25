
class Arrays {
    static contains<T>(arr: T[], ele: T): boolean {
        for(let i of arr) {
            if(i === ele) return true
        }
        return false
    }
    static containsAll<T>(arr: T[], elements: T[]): boolean {
        for(let c of arr) {
            let flag = true
            for(let m of elements) {
                if(m === c) {
                    flag = false
                    break
                }
            }
            if(flag) return false
        }
        return true
    }
    static clone<T>(arr: T[]): T[] {
        if(arr) {
            let ret = []
            for(let i in arr) {
                ret[i] = arr[i]
            }
            return ret
        }else{
            return []
        }
    }
    static append<T>(arr: T[], ele: T): T[] {
        if(arr) {
            arr[arr.length] = ele
        }
        return arr
    }
    static insert<T>(arr: T[], index: number, ele: T): void {
        if(arr) {
            if(index < 0) index = 0
            else if(index >= arr.length) index = arr.length
            arr.splice(index, 0, ele)
        }
    }
    static join<T>(arr: T[], elements: T[]): T[] {
        if(arr && elements) {
            for(let i = 0, first = arr.length; i < elements.length; ++i) {
                arr[first + i] = elements[i]
            }
        }
        return arr
    }
    static remove<T>(arr: T[], ele: T): boolean {
        if(arr) {
            let index = arr.indexOf(ele)
            if(index >= 0) {
                arr.splice(index, 1)
                return true
            }
        }
        return false
    }
    static removeAt<T>(arr: T[], index: number): boolean {
        if(arr && index < arr.length) {
            arr.splice(index, 1)
            return true
        }
        return false
    }
    static popAt<T>(arr: T[], index: number): T {
        if(arr && index < arr.length) {
            return arr.splice(index, 1)[0]
        }
        return undefined
    }
    static equal<T>(a: T[], b: T[]): boolean {
        if(a && b) {
            if(a.length !== b.length) return false
            for(let i = 0; i < a.length; ++i) {
                if(a[i] !== b[i]) return false
            }
            return true
        }
        return false
    }
    static isEmpty<T>(arr: T[]): boolean {
        return (!arr) || arr.length <= 0
    }
    static isNotEmpty<T>(arr: T[]): boolean {
        return arr && arr.length > 0
    }

    static last<T>(arr: T[], lastIndex: number = 1): T {
        if(arr && arr.length >= lastIndex) {
            return arr[arr.length - lastIndex]
        }
        return null
    }

    static map<T, R>(from: T[], by: (t: T) => R): R[] {
        if(from && by) {
            let ret: R[] = []
            for(let i in from) {
                ret[i] = by(from[i])
            }
            return ret
        }
        return null
    }
    static filter<T>(from: T[], condition: (t: T) => boolean): T[] {
        if(from && condition) {
            let ret = []
            for(let i of from) {
                if(condition(i)) {
                    Arrays.append(ret, i)
                }
            }
            return ret
        }
        return null
    }
    static filterMap<T, R>(from: T[], translate: (t: T, index: number) => R): R[] {
        if(from && translate) {
            let ret: R[] = []
            for(let i = 0; i < from.length; ++i) {
                let result = translate(from[i], i)
                if(result !== undefined) {
                    Arrays.append(ret, result)
                }
            }
            return ret
        }
        return null
    }
    static indexOf<T>(arr: T[], condition: (t: T) => boolean): number {
        if(arr && condition) {
            for(let i = 0; i < arr.length; ++i) {
                if(condition(arr[i])) {
                    return i
                }
            }
        }
        return -1
    }
    static find<T>(arr: T[], condition: (t: T) => boolean): T {
        if(arr && condition) {
            for(let i = 0; i < arr.length; ++i) {
                if(condition(arr[i])) {
                    return arr[i]
                }
            }
        }
        return undefined
    }

    static concatString(arr: string[], mid: string = ''): string {
        if(arr) {
            let ret = ''
            let first = true
            for(let s of arr) {
                if(first) first = false
                else ret += mid
                ret += s
            }
            return ret
        }
        return null
    }
    static zip<T, R>(arr: T[], method: (last: T | R, next: T | R) => R): R[] {
        let ret = []
        let last = undefined
        for(let i of arr) {
            if(last == undefined) last = i
            else{
                let result = method(last, i)
                if(result != undefined) {
                    last = result
                }else{
                    ret[ret.length] = last
                    last = i
                }
            }
        }
        if(last != undefined) {
            ret[ret.length] = last
        }
        return ret
    }
}

class Sets {
    static contains<T>(set: T[], ele: T): boolean {
        return Arrays.contains(set, ele)
    }
    static put<T>(set: T[], ele: T): boolean {
        if(!this.contains(set, ele)) {
            Arrays.append(set, ele)
            return true
        }
        return false
    }
    static remove<T>(set: T[], ele: T): boolean {
        return Arrays.remove(set, ele)
    }
}

class Maps {
    static remove(obj: Object, key: any): boolean {
        if(obj && key in obj) {
            obj[key] = undefined
            return true
        }
        return false
    }

    static map<V, R>(from: Object, by: (k: string, v: V) => R): Object {
        if(from && by) {
            let ret: Object = {}
            for(let k in from) {
                ret[k] = by(k, from[k])
            }
            return ret
        }
        return null
    }
}

export {Arrays, Sets, Maps}