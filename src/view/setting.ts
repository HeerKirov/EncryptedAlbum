import {remote, ipcRenderer} from 'electron'
import {CommonModel, CommonDB} from './model'
import {LocalFormula} from "../common/localEngine"
import {Arrays} from "../util/collection"
import {Strings} from "../util/string";
const {TouchBar} = remote
const {TouchBarButton, TouchBarSpacer} = TouchBar
const Vue = require('vue/dist/vue')
const $ = window['$']

function settingModel(vueModel: CommonModel) {
    let db: CommonDB = vueModel.db

    let vm = new Vue({
        el: '#settingView',
        data: {
            visible: false,
            fullscreen: false,

            storage: {
                mainFormula: null
            },
            tag: {
                typeList: [],    //{name: string, key: string, background: string, fontcolor: string}

                tagEditor: {
                    goal: null,  //new | number
                    key: '',
                    name: '',
                    background: '',
                    fontcolor: ''
                }
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
            },
            security: {
                oldPassword: '',
                newPassword: '',
                checkPassword: '',
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
                if(db.storage.getMainFormula().type === 'local') {
                    this.storage.mainFormula = {
                        type: db.storage.getMainFormula().type,
                        storage: (db.storage.getMainFormula() as LocalFormula).storage
                    }
                }else{
                    this.storage.mainFormula = null
                }
                //初始化各个面板
                //初始化【安全】面板
                this.security.oldPassword = ''
                this.security.newPassword = ''
                this.security.checkPassword = ''
                this.security.msg = ''
                //初始化【pixiv】面板
                let pixiv = db.engine.getConfig('pixiv')
                if(pixiv) {
                    this.pixiv.username = pixiv.username
                    this.pixiv.password = pixiv.password
                }
                this.pixiv.msg = ''
                //初始化【代理】面板
                let proxy = db.engine.getConfig('proxy')
                if(proxy) {
                    this.proxy.host = proxy.host
                    this.proxy.port = proxy.port
                    this.proxy.protocol = proxy.protocol ? proxy.protocol : 'http:'
                }else{
                    this.proxy.protocol = 'http:'
                }
                this.proxy.msg = ''
                //初始化【标签】面板
                let tagTypes = db.engine.getConfig('tag-type')
                if(tagTypes) {
                    this.tag.typeList = tagTypes
                }else{
                    this.tag.typeList = []
                }

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
                vueModel.routeBack()
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

            editTagType: function(position: 'new' | number) {
                if(position === 'new') {
                    this.tag.tagEditor.name = ''
                    this.tag.tagEditor.key = ''
                    this.tag.tagEditor.background = '#007bff'
                    this.tag.tagEditor.fontcolor = '#ffffff'
                    this.tag.tagEditor.goal = 'new'
                }else{
                    this.tag.tagEditor.name = this.tag.typeList[position].name
                    this.tag.tagEditor.key = this.tag.typeList[position].key
                    this.tag.tagEditor.background = this.tag.typeList[position].background
                    this.tag.tagEditor.fontcolor = this.tag.typeList[position].fontcolor
                    this.tag.tagEditor.goal = position
                }
                $('#tagTypeEditModal')['modal']()
            },
            saveTagType: function() {
                let success = true
                if(Strings.isBlank(this.tag.tagEditor.name)) {
                    success = false
                    alert('名称不能为空。')
                }else if(Strings.isBlank(this.tag.tagEditor.key)) {
                    success = false
                    alert('关键字不能为空。')
                }
                if(success) {
                    if(this.tag.tagEditor.goal === 'new') {
                        for(let type of this.tag.typeList) {
                            if(type.key === this.tag.tagEditor.key) {
                                success = false
                                break
                            }
                        }
                        if(success) {
                            vm.$set(this.tag.typeList, this.tag.typeList.length, {
                                name: this.tag.tagEditor.name,
                                key: this.tag.tagEditor.key,
                                background: this.tag.tagEditor.background,
                                fontcolor: this.tag.tagEditor.fontcolor
                            })
                        }else{
                            alert('该关键字已经存在。')
                        }
                    }else{
                        this.tag.typeList[this.tag.tagEditor.goal].name = this.tag.tagEditor.name
                        this.tag.typeList[this.tag.tagEditor.goal].key = this.tag.tagEditor.key
                        this.tag.typeList[this.tag.tagEditor.goal].background = this.tag.tagEditor.background
                        this.tag.typeList[this.tag.tagEditor.goal].fontcolor = this.tag.tagEditor.fontcolor
                    }
                }
                if(success) {
                    db.engine.putConfig('tag-type', Arrays.clone(this.tag.typeList))
                    db.engine.save()
                }
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