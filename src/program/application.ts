import {app, BrowserWindow} from 'electron'
import {DataEngine} from '../common/engine';
import {AppStorage} from '../common/appStorage';

class Application {
    private mainWindow: BrowserWindow = null
    private subWindows: Array<BrowserWindow> = new Array()

    private storage: AppStorage = null
    private engine: DataEngine = null

    constructor() {
        this.registerAppEvents()
    }


    loadMainEngine(): boolean {
        if(this.engine != null) {
            return true
        }
        let engine: DataEngine = this.storage.loadMainEngine()
        if(engine != null) {
            this.engine = engine
            return true
        }else{
            return false
        }
    }

    registerAppEvents() {
        app.on('ready', this.createMainWindow)
        app.on('activate', this.getMainWindow)
        app.on('window-all-closed', this.EventWindowAllClosed)
    }

    getMainWindow(): BrowserWindow {
        if(this.mainWindow == null) {
            this.createMainWindow()
        }
        return this.mainWindow
    }

    private createMainWindow() {
        let win: BrowserWindow = new BrowserWindow({width: 1200, height: 800})
        win.setMenuBarVisibility(false)
        win.on('closed', function() {this.mainWindow = null})

        win.loadFile('view/index.html')

        this.mainWindow = win
        this.mainWindow.webContents.openDevTools()
    }

    private EventWindowAllClosed() {
        if (process.platform !== 'darwin') {
            app.quit()
        }
    }
}

let current = null

function currentApplication(): Application {
    return current
}

function applicationRun() {
    current = new Application()
}

export {currentApplication, applicationRun}