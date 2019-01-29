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
    routeBack: (refresh?: boolean) => void,
    setTouchBar: (touchBar: TouchBar) => void,
    setTitle: (title: string) => void,
    db: CommonDB
}

export {CommonDB, CommonModel}