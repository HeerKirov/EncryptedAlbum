import {CommonModel} from "./model"
import {remote, ipcRenderer} from 'electron'
const {TouchBar, dialog} = remote
const {TouchBarButton, TouchBarSpacer} = TouchBar
const Vue = require('vue/dist/vue')
const $ = window['$']


function mainModel(vueModel: CommonModel) {
    let db = vueModel.db
    let vm = new Vue({
        el: '#mainView',
        data: {
            visible: false,
            fullscreen: false,
            
        },
        computed: {
            isNoTitleBar: function() {
                return this.fullscreen || db.platform.platform !== 'darwin'
            },
        },
        methods: {
            load: function (options?: any, refresh?: boolean) {
                db.ui.theme = 'gray'
                this.visible = true
                if(db.ui.fullscreen) {this.enterFullScreen()} else {this.leaveFullScreen()}
            },
            leave: function () {
                this.visible = false
            },
            enterFullScreen: function() {
                this.fullscreen = true
            },
            leaveFullScreen: function() {
                this.fullscreen = false
            },

            gotoAdd: function () {
                vueModel.route("edit")
            },
            gotoSetting: function () {
                vueModel.route("setting")
            }
        }
    })
    return vm
}

module.exports = mainModel