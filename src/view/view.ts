import {ipcRenderer, TouchBar, BrowserWindow, remote} from 'electron'
import {AppStorage} from '../common/appStorage'
import {Arrays} from "../util/collection"
import {CommonDB, CommonModel} from './model'
const {getCurrentWindow} = remote
const $ = window['$'] = window['jQuery'] = require('jquery')
window['Bootstrap'] = require('bootstrap')

//本窗口。
const win: BrowserWindow = getCurrentWindow()
//与vue模型相关的存储。
let vms = {}
let currentViewName: string = null
let viewHistory: string[] = []
//本页面的公共数据库。
const db: CommonDB = {
    platform: {
        platform: 'darwin',
        debug: false,
        userData: '.'
    },
    ui: {
        theme: 'white',
        fullscreen: false
    },
    currentWindow: win,
    password: null,
    storage: null,
    engine: null
}
//传递给vue模块进行初始化的通讯类。用于当前存储与vue模块交换存储。
const vueModel: CommonModel = {
    route, routeBack,
    setTouchBar,
    setTitle,
    db
}

function registerWindowEvents(): void {
    win.on('enter-full-screen', () => {
        db.ui.fullscreen = true
        updateTitleBarStatus()
        for(let i in vms) {
            let vm = vms[i]
            if('enterFullScreen' in vm && typeof vm.enterFullScreen === 'function') {
                vm.enterFullScreen()
            }
        }
    })
    win.on('leave-full-screen', () => {
        db.ui.fullscreen = false
        updateTitleBarStatus()
        for(let i in vms) {
            let vm = vms[i]
            if('leaveFullScreen' in vm && typeof vm.leaveFullScreen === 'function') {
                vm.leaveFullScreen()
            }
        }
    })
    ipcRenderer.on('route', (event, arg) => {
        if(arg instanceof Object) {
            let {view, options} = arg
            route(view, options)
        }else{
            route(arg)
        }
    })
}
function registerVue(viewName: string, callback: (vm: any) => void): void {
    if(!(viewName in vms)) {
        let container = $('<div></div>')
        $('#body').append(container)
        container.load(`${viewName}.html`, () => {
            let vm = require(`./${viewName}`)(vueModel)
            vms[viewName] = vm
            callback(vm)
        })
    }else{
        callback(vms[viewName])
    }
}

function route(viewName: string, options?: any, refresh?: boolean): void {
    if(refresh == undefined) refresh = true
    if(!(viewName in vms)) {
        registerVue(viewName, () => {
            route(viewName, options, refresh)
        })
    }else{
        if(currentViewName !== null) {
            vms[currentViewName].leave()
            setTouchBar(null)
        }
        setTitle(null)
        currentViewName = viewName
        vms[viewName].load(options, refresh)
        updateTheme()
        updateTitleBarStatus()
        if(Arrays.contains(viewHistory, viewName)) {
            Arrays.remove(viewHistory, viewName)
        }
        Arrays.append(viewHistory, viewName)
    }
}
function routeBack(refresh: boolean = false): void {
    if(viewHistory.length >= 2) {
        Arrays.removeAt(viewHistory, viewHistory.length - 1)
        route(Arrays.last(viewHistory), undefined, refresh)
    }
}

function updateTitleBarStatus(): void {
    if(db.platform.platform !== 'darwin' || db.ui.fullscreen) {
        $('#titleBar').hide()
        $('#app').css('top', '0')
    }else{
        $('#titleBar').show()
        $('#app').css('top', '14px')
    }
}
function updateTheme(): void {
    $('#titleBar')
        .css('background', db.ui.theme === 'dark' ? '#222222' : '#FFFFFF')
        .css('color', db.ui.theme === 'dark' ? '#FFFFFF' : '#000000')
    if(db.ui.theme === 'white') $('#body').css('background', '#FFFFFF')
    else if(db.ui.theme === 'gray') $('#body').css('background', '#F0F0F0')
    else $('#body').css('background', '#1A1A1A')
}
function setTouchBar(touchBar: TouchBar): void {
    if(db.platform.platform === 'darwin') {
        win.setTouchBar(touchBar)
    }
}
function setTitle(title: string): void {
    if(!title) title = 'Encrypted Album'
    win.setTitle(title)
    $('#titleBar').text(title)
}

$(document)['ready'](function () {
    registerWindowEvents()
    updateTitleBarStatus()
    db.platform = ipcRenderer.sendSync('get-platform-info')
    if(db.platform.debug) {
        AppStorage.setBaseFolder('.')
    }else{
        AppStorage.setBaseFolder(db.platform.userData)
    }
    if(AppStorage.isInitialized()) {
        let {password} = ipcRenderer.sendSync('load-cache', ['password'])
        if(!password) password = ''
        let storage = AppStorage.authenticate(password)
        if(storage != null) {
            db.password = password
            db.storage = storage
            db.engine = storage.loadMainEngine()
            db.engine.connect()

            let customPage = ipcRenderer.sendSync('first-page')
            if(customPage) {
                route(customPage)
            }else{
                route('main')
            }
        }else{
            route('login')
        }
    }else{
        route('register')
    }
})