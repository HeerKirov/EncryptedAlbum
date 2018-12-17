import {app, BrowserWindow, ipcMain, globalShortcut} from 'electron'
import {DataEngine, ImageSpecification} from '../common/engine'
import {AppStorage} from '../common/appStorage'

let mainWindow: BrowserWindow = null
let subWindows: Array<BrowserWindow> = []

let storage: AppStorage = null
let engine: DataEngine = null

let mainPageCache: Object = {}
let temps: number[] = []

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
        let passwd = arg
        let result = AppStorage.authenticate(passwd)
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

    ipcMain.on('load-engine', (e, arg) => {
        //发起引擎初始化流程。
        //return: boolean 引擎是否可用。交给前端做一些判断。
        e.returnValue = loadMainEngine()
    })
    ipcMain.on('get-next-id', (e, arg) => {
        //获得下一个可用的id。id总是递增的，因此可以接续此序号连续使用。
        //return: number
        e.returnValue = engine.getNextId()
    })
    ipcMain.on('create-image', (e, arg) => {
        //调用创建image的库api。
        //arg: Image[]形式的结构体。
        //return: null | {...} 是否发生了不可预见的异常。返回null时表示无异常。
        try {
            //根据转换需要，这里将arg内的buf项目从string转码为buffer。
            for(let item of arg) {
                if(item.buffer) {
                    item.buffer = Buffer.from(item.buffer, 'base64')
                }
            }
            //然后传入存储引擎
            engine.createImage(arg)
            engine.save()
            e.returnValue = null
        }catch (err) {
            e.returnValue = err
        }
    })
    ipcMain.on('find-image', (e, arg) => {
        //调用查询image列表的api。
        //arg：ImageFindOption
        //return: Image[]. 这个列表不包含任何图像信息，如果需要请凭ID自己提取。
        e.returnValue = engine.findImage(arg)
    })
    ipcMain.on('load-image-url', (e, arg) => {
        //调用获取image图像信息的api。
        //arg: {id: number, specification: string}
        //return: string. DataURL.
        let specification;
        if(arg['specification'] === 'Exhibition') specification = ImageSpecification.Exhibition
        else if(arg['specification'] === 'Thumbnail') specification = ImageSpecification.Thumbnail
        else specification = ImageSpecification.Origin
        let id = arg['id']
        let ret = engine.loadImageURL(id, specification)
        e.returnValue = ret
    })
    ipcMain.on('load-image-url-async', (e, arg) => {
        //调用获取image图像信息的api。异步函数版。
        //arg: {id: number, specification: string, awaitId: number}
        //return: string. DataURL.
        let specification;
        if(arg['specification'] === 'Exhibition') specification = ImageSpecification.Exhibition
        else if(arg['specification'] === 'Thumbnail') specification = ImageSpecification.Thumbnail
        else specification = ImageSpecification.Origin
        let id = arg['id']
        let awaitId = ('awaitId' in arg) ? arg['awaitId'] : id
        engine.loadImageURL(id, specification, (ret) => {
            e.sender.send('load-image-url-await-' + awaitId, ret)
        })
    })

    ipcMain.on('load-main-cache', (e, arg) => {
        //从主线程调用包含所有option的缓存列表。
        //return: {filter: {...}, sort: {...}, search: string, view: {...}, folder: string}
        e.returnValue = mainPageCache
    })
    ipcMain.on('save-main-cache', (e, arg) => {
        //有选择地将一部分main页面的内容缓存下来。
        //arg: {filter?: {...}, sort?: {...}, search?: string, view?: {...}}
        for(let i in arg) {
            mainPageCache[i] = arg[i]
        }
        e.returnValue = undefined
    })
    ipcMain.on('load-main-temps', (e, arg) => {
        //加载对临时文件夹的缓存。
        //在确认返回之前，需要确认这之中每一个id是否仍然可达。
        //arg: {findImage: boolean} 是否直接返回已经查询完成的结果。
        //return: number[] | Image[]
        let ret = engine.findImage({id_in: temps})
        if(ret.length !== temps.length) {
            temps = []
            for(let i = 0; i < ret.length; ++i) temps[i] = ret[i].id
        }
        if('findImage' in arg && arg.findImage) {
            e.returnValue = ret
        }else{
            e.returnValue = temps
        }
    })
    ipcMain.on('save-main-temps', (e, arg) => {
        //保存一个临时文件夹内的id列表。
        //arg: number[]
        temps = arg
    })
}

function loadMainEngine(): boolean {
    if(engine != null) {
        return true
    }
    let result: DataEngine = storage.loadMainEngine()
    if(result != null) {
        engine = result
        return result.connect()
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