const electron = require('electron')
const {getCurrentWindow} = electron.remote
const {ipcRenderer} = electron
const {AppStorage} = require('../target/common/appStorage')
window['$'] = window['jQuery'] = require('jquery')
window['Bootstrap'] = require('bootstrap')

//本窗口。
const win = getCurrentWindow()
//与vue模型相关的存储。
let vms = {}
let currentViewName = null
//本页面的公共数据库。
const db = {
    platform: {
        platform: 'darwin',
        debug: false
    },
    ui: {
        theme: 'white',
        fullscreen: false
    },
    password: null,
    storage: null,
    engine: null
}
//传递给vue模块进行初始化的通讯类。用于当前存储与vue模块交换存储。
const vueModel = {
    route: route,
    setTouchBar: setTouchBar,
    db: db
}

function registerWindowEvents() {
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
}
function registerVue(viewName, callback) {
    if(!(viewName in vms)) {
        $('#app').load(`${viewName}.html`, () => {
            let vm = require(`../view.js/${viewName}`)(vueModel)
            vms[viewName] = vm
            callback(vm)
        })
    }else{
        callback(vms[viewName])
    }
}

function route(viewName, options) {
    if(!(viewName in vms)) {
        registerVue(viewName, () => {
            route(viewName, options)
        })
    }else{
        if(currentViewName !== null) {
            vms[currentViewName].leave()
            setTouchBar(null)
        }
        currentViewName = viewName
        vms[viewName].load(options)
        updateTheme()
        updateTitleBarStatus()
    }
}

function updateTitleBarStatus() {
    if(db.platform.platform !== 'darwin' || db.ui.fullscreen) {
        $('#titleBar').hide()
        $('#app').css('top', '0')
    }else{
        $('#titleBar').show()
        $('#app').css('top', '14px')
    }
}
function updateTheme() {
    $('#titleBar').css('background', db.ui.theme === 'dark' ? '#222222' : '#FFFFFF')
    $('#titleBarText').css('color', db.ui.theme === 'dark' ? '#FFFFFF' : '#000000')
    if(db.ui.theme === 'white') $('#body').css('background', '#FFFFFF')
    else if(db.ui.theme === 'gray') $('#body').css('background', '#F0F0F0')
    else $('#body').css('background', '#1A1A1A')
}

function setTouchBar(touchBar) {
    if(db.platform.platform === 'darwin') {
        win.setTouchBar(touchBar)
    }
}


$(document).ready(function () {
    registerWindowEvents()
    updateTitleBarStatus()

    let {password} = ipcRenderer.sendSync('load-cache', ['password'])
    if(password) {
        let storage = AppStorage.authenticate(password)
        if(storage != null) {
            db.password = password
            db.storage = storage
            db.engine = storage.loadMainEngine()
            route('main')
        }else if(AppStorage.isInitialized()) {
            route('login')
        }else{
            route('register')
        }
    }else if(AppStorage.isInitialized()) {
        route('login')
    }else{
        route('register')
    }
})