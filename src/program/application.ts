import {app, BrowserWindow, ipcMain} from 'electron'
import {DataEngine} from '../common/engine';
import {AppStorage} from '../common/appStorage';

let mainWindow: BrowserWindow = null
let subWindows: Array<BrowserWindow> = new Array()

let storage: AppStorage = null
let engine: DataEngine = null

function applicationRun(defaultAuthenticate?: string) {
    registerSynchronousEvent()
    registerAppEvents()

    if(defaultAuthenticate) {
        let result = AppStorage.authenticate(defaultAuthenticate)
        if(result != null) {
            storage = result
        }
    }
}

function registerAppEvents() {
    app.on('ready', createMainWindow)
    app.on('activate', getMainWindow)
    app.on('window-all-closed', () => {
        if (process.platform !== 'darwin') {
            app.quit()
        }
    })
}
function registerSynchronousEvent() {
    ipcMain.on('goto', (e, arg) => {
        //指示主窗口进行页面跳转。
        //arg: string 跳转的目标页面路径。
        windowGoto(arg)
        e.returnValue = null
    })
    ipcMain.on('authenticate-status', (e, arg) => {
        //得到app当前的认证状态：未初始化、未认证、已认证。
        //return: string 标记认证状态的字符串。(not-init, not-auth, auth)
        if(storage != null) {
            e.returnValue = "auth"
        }else if(AppStorage.isInitialized()) {
            e.returnValue = "not-auth"
        }else{
            e.returnValue = "not-init"
        }
    })
    ipcMain.on('authenticate', (e, arg) => {
        //发起登陆认证。
        //arg: string 登录密码。
        //return: boolean 是否登录成功。
        let password = arg
        let result = AppStorage.authenticate(password)
        if(result != null) {
            storage = result
            e.returnValue = true
        }else{
            e.returnValue = false
        }
    })
    ipcMain.on('initialize', (e, arg) => {
        //发起初始化流程。
        //arg: {password: string, formula: Formula} 初始化参数。
        //return: boolean 是否初始化成功。在初始化参数校验错误时会返回否。
        let {password, formula} = arg
        let result = AppStorage.initialize(password, formula)
        if(result != null) {
            storage = result
            e.returnValue = true
        }else{
            e.returnValue = false
        }
    })
}

function loadMainEngine(): boolean {
    if(engine != null) {
        return true
    }
    let result: DataEngine = storage.loadMainEngine()
    if(result != null) {
        engine = result
        return true
    }else{
        return false
    }
}

function windowGoto(page: string): void {
    if(mainWindow != null) {
        mainWindow.loadFile(`view/${page}.html`)
    }
}
function getMainWindow(): BrowserWindow {
    if(mainWindow == null) {
        createMainWindow()
    }
    return mainWindow
}
function createMainWindow() {
    let win: BrowserWindow = new BrowserWindow({width: 1200, height: 800, minWidth: 640, minHeight: 480})
    win.setMenuBarVisibility(false)
    win.on('closed', function() {mainWindow = null})

    mainWindow = win
    if(storage != null) {
        windowGoto('main')
    }else{
        windowGoto('auth')
    }
    mainWindow.webContents.openDevTools()
}

export {applicationRun}