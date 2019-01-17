import {BrowserWindow, TouchBar} from "electron";
import {AppStorage} from "../common/appStorage";
import {DataEngine} from "../common/engine";

interface CommonDB {
    platform: {
        platform: string,
        debug: boolean,
        userData: string
    },
    ui: {
        theme: string,
        fullscreen: boolean
    },
    currentWindow: BrowserWindow,
    password: string,
    storage: AppStorage,
    engine: DataEngine
}
interface CommonModel {
    route: (viewName: string, options?: any, refresh?: boolean) => void,
    routeBack: (viewName: string, refresh?: boolean) => void,
    setTouchBar: (touchBar: TouchBar) => void,
    setTitle: (title: string) => void,
    db: CommonDB
}

function getTagType(tag: string, prefix: string): Object {
    if(tag) {
        let flag = tag.slice(0, 1)
        let ret = {}
        ret[prefix + '-warning'] = flag === '@'
        ret[prefix + '-info'] = flag === '%'
        ret[prefix + '-success'] = flag === '#'
        return ret
    }else{
        return null
    }
}
function getTagName(tag: string): string {
    if(tag) return tag.slice(1)
    else return null
}

function calcDateTime(date: Date, fmt: string): string {
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
export {CommonDB, CommonModel, getTagName, getTagType, calcDateTime}