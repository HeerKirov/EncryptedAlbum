const {remote, ipcRenderer} = require('electron')
const {TouchBar} = remote
const {TouchBarButton, TouchBarSpacer} = TouchBar
const Vue = require('vue/dist/vue')

function settingModel(vueModel) {
    let db = vueModel.db

    let vm = new Vue({
        el: '#settingView',
        data: {
            visible: false,
            fullscreen: false
        },
        computed: {

        },
        methods: {
            load: function () {
                db.ui.theme = 'gray'
                this.visible = true
                if(db.ui.fullscreen) {this.enterFullScreen()} else {this.leaveFullScreen()}
                this.setTouchBar()
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
            setTouchBar: function () {

            }
        }
    })

    return vm
}

module.exports = settingModel