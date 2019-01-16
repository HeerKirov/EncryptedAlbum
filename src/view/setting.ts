import {remote, ipcRenderer} from 'electron'
const {TouchBar} = remote
const {TouchBarButton, TouchBarSpacer} = TouchBar
const Vue = require('vue/dist/vue')
const $ = window['$']

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
                checkPassword: '',
                msg: ''
            },
            pixiv: {
                username: '',
                password: '',
                msg: ''
            },
            proxy: {
                protocol: 'http:',
                host: '',
                port: '',
                msg: ''
            }
        },
        computed: {
            noTitleBar: function() {
                return this.fullscreen || db.platform.platform !== 'darwin'
            },
        },
        methods: {
            load: function (option) {
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
                //初始化各个面板
                this.security.oldPassword = ''
                this.security.newPassword = ''
                this.security.checkPassword = ''
                this.security.msg = ''

                let pixiv = db.engine.getConfig('pixiv')
                if(pixiv) {
                    this.pixiv.username = pixiv.username
                    this.pixiv.password = pixiv.password
                }
                this.pixiv.msg = ''
                let proxy = db.engine.getConfig('proxy')
                if(proxy) {
                    this.proxy.host = proxy.host
                    this.proxy.port = proxy.port
                    this.proxy.protocol = proxy.protocol ? proxy.protocol : 'http:'
                }else{
                    this.proxy.protocol = 'http:'
                }
                this.proxy.msg = ''
                this.setTouchBar()
                if(option) {
                    $(document).ready(() => {
                        this.setTab(option)
                    })
                }
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

            setPassword: function() {
                if(db.storage.getPassword() === this.security.oldPassword) {
                    if(this.security.newPassword === this.security.checkPassword) {
                        db.storage.setPassword(this.security.newPassword)
                        db.storage.save()
                        db.password = db.storage.getPassword()
                        ipcRenderer.send('save-cache', {password: db.password})
                        if(this.security.newPassword === '') {
                            this.security.msg = 'success-empty'
                        }else{
                            this.security.msg = 'success'
                        }
                        this.security.oldPassword = ''
                        this.security.newPassword = ''
                        this.security.checkPassword = ''
                    }else{
                        this.security.msg = 'wrong-check'
                    }
                }else{
                    this.security.msg = 'wrong-password'
                }
            },
            savePixiv: function() {
                if(!this.pixiv.username && !this.proxy.password) {
                    db.engine.putConfig('pixiv', null)
                }else{
                    db.engine.putConfig('pixiv', {
                        username: this.pixiv.username,
                        password: this.pixiv.password
                    })
                }
                db.engine.save()
                this.pixiv.msg = 'success'
            },
            saveProxy: function() {
                if(!this.proxy.host && !this.proxy.port) {
                    db.engine.putConfig('proxy', null)
                }else{
                    db.engine.putConfig('proxy', {
                        protocol: this.proxy.protocol,
                        host: this.proxy.host,
                        port: this.proxy.port
                    })
                }
                db.engine.save()
                this.proxy.msg = 'success'
            },
            clearPixiv: function() {
                this.pixiv.username = ''
                this.pixiv.password = ''
            },
            clearProxy: function() {
                this.proxy.host = ''
                this.proxy.port = ''
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