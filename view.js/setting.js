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
            fullscreen: false,

            storage: {
                mainFormula: null
            },
            security: {
                oldPassword: '',
                newPassword: '',
                checkPassword: ''
            },
            pixiv: {

            },
            proxy: {

            }
        },
        computed: {

        },
        methods: {
            load: function () {
                db.ui.theme = 'white'
                this.visible = true
                if(db.ui.fullscreen) {this.enterFullScreen()} else {this.leaveFullScreen()}
                if(db.storage.mainFormula.type === 'local') {
                    this.storage.mainFormula = {
                        type: db.storage.mainFormula.type,
                        storage: db.storage.mainFormula.storage
                    }
                }else{
                    this.storage.mainFormula = null
                }
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

            goBack: function() {
                vueModel.route('main')
            },
            help: function() {
                vueModel.route('help')
            },

            setTab: function(tab) {
                $('.nav-link').removeClass('active')
                $('.tab-pane').removeClass('active')
                $(`#${tab}-btn`).addClass('active')
                $(`#${tab}`).addClass('active')
            },

            setTouchBar: function () {
                if(db.platform.platform === 'darwin') {
                    vueModel.setTouchBar(new TouchBar({
                        items: [
                            new TouchBarSpacer({size: 'flexible'}),
                            new TouchBarButton({
                                label: '存储',
                                click: () => {this.setTab('storage')}
                            }),
                            new TouchBarButton({
                                label: '安全',
                                click: () => {this.setTab('security')}
                            }),
                            new TouchBarButton({
                                label: 'Pixiv',
                                click: () => {this.setTab('pixiv')}
                            }),
                            new TouchBarButton({
                                label: '网络代理',
                                click: () => {this.setTab('proxy')}
                            }),
                            new TouchBarSpacer({size: 'flexible'}),
                            new TouchBarButton({
                                label: '帮助向导',
                                click: () => {
                                    this.help()
                                }
                            })
                        ]
                    }))
                }
            }
        }
    })

    return vm
}

module.exports = settingModel