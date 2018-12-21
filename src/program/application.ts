import {app, ipcMain, BrowserWindow} from 'electron'

interface ApplicationOption {
    debugMode?: boolean,
    defaultAuthentication?: string
}

const applicationRun: (ApplicationOption?) => void = (function () {
    let debug: boolean
    let platform: string

    let mainWindow: BrowserWindow = null

    let rendererCache: Object = {}
    
    function run(option?: ApplicationOption): void {
        debug = 'debugMode' in option ? option.debugMode : false
        platform = process.platform
        registerRendererEvents()
        registerAppEvents()
    }
    
    function registerAppEvents() {
        app.on('ready', activeMainWindow)
        app.on('activate', activeMainWindow)
        app.on('window-all-closed', () => {
            if(platform !== 'darwin') {
                app.quit()
            }
        })
    }
    function registerRendererEvents() {
        ipcMain.on('get-platform-info', (e, arg) => {
            //获得平台与设备等的基本信息。
            //return: {...}
            e.returnValue = {
                platform: platform,
                debug: debug
            }
        })
        ipcMain.on('save-cache', (e, arg) => {
            //按字典模式保存一组缓存信息。它们会按key覆盖之前的信息。
            //arg: {key: value}
            if(arg) {
                for(let key in arg) {
                    rendererCache[key] = arg[key]
                }
            }
            e.returnValue = null
        })
        ipcMain.on('load-cache', (e, arg) => {
            //从缓存加载一部分信息。
            //arg: [keys] 要加载的key的列表。此项为空则加载全部缓存。
            //return: {key: value}
            if(arg) {
                let ret = {}
                for(let key of arg) {
                    if(key in rendererCache) {
                        ret[key] = rendererCache[key]
                    }else{
                        ret[key] = undefined
                    }
                }
                e.returnValue = ret
            }else{
                e.returnValue = rendererCache
            }
        })
    }

    function activeMainWindow(): void {
        if(mainWindow == null) {
            let win: BrowserWindow = new BrowserWindow({
                minWidth: 640, minHeight: 480,
                width: 1200, height: 800,
                titleBarStyle: "hidden",
                title: "Photos"
            })
            win.setMenuBarVisibility(false)
            win.on('closed', () => {
                mainWindow = null
            })

            mainWindow = win
            win.loadFile('view/view.html')
            if(debug) {
                mainWindow.webContents.openDevTools()
            }
        }else if(!mainWindow.isVisible()) {
            mainWindow.show()
        }
    }

    return run
})()

export {applicationRun}