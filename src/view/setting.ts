import {remote, ipcRenderer} from 'electron'
import {CommonModel, CommonDB} from './model'
import {LocalFormula} from "../common/localEngine"
import {Arrays} from "../util/collection"
import {Strings} from "../util/string"
import {Tags} from "../util/model"
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
                typeEditor: {
                    goal: null,  //new | number
                    key: '',
                    name: '',
                    background: '',
                    fontcolor: ''
                },
                tags: [],
                tagSearchText: '',
                tagSelect: null ,    //被选择来操作的标签
                tagEditor: {
                    name: null,
                    type: null
                }
            },
            folder: {
                folders: [],
                selectedIndex: -1,
                create: {
                    name: '',
                    type: 'folder'
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
            noTitleBar() {
                return this.fullscreen || db.platform.platform !== 'darwin'
            },
        },
        methods: {
            load(option) {
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
                this.loadTagList()
                //初始化【文件夹】面板
                this.folder.folders = db.engine.getFolderList()
                this.folder.folders.selectedIndex = -1

                this.setTouchBar()
                if(option) {
                    $(document)['ready'](() => {
                        this.setTab(option)
                    })
                }
            },
            leave() {
                this.visible = false
            },
            enterFullScreen() {
                this.fullscreen = true
            },
            leaveFullScreen() {
                this.fullscreen = false
            },
            //导航函数
            goBack() {
                vueModel.routeBack()
            },
            help() {
                vueModel.route('help')
            },
            //安全&pixiv&代理
            setPassword() {
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
            savePixiv() {
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
            saveProxy() {
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
            clearPixiv() {
                this.pixiv.username = ''
                this.pixiv.password = ''
            },
            clearProxy() {
                this.proxy.host = ''
                this.proxy.port = ''
            },
            //标签
            editTagType(position: 'new' | number) {
                if(position === 'new') {
                    this.tag.typeEditor.name = ''
                    this.tag.typeEditor.key = ''
                    this.tag.typeEditor.background = '#007bff'
                    this.tag.typeEditor.fontcolor = '#ffffff'
                    this.tag.typeEditor.goal = 'new'
                }else{
                    this.tag.typeEditor.name = this.tag.typeList[position].name
                    this.tag.typeEditor.key = this.tag.typeList[position].key
                    this.tag.typeEditor.background = this.tag.typeList[position].background
                    this.tag.typeEditor.fontcolor = this.tag.typeList[position].fontcolor
                    this.tag.typeEditor.goal = position
                }
                $('#tagTypeEditModal')['modal']()
            },
            saveTagType() {
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
            loadTagList(search?: string) {
                this.tag.tags = db.engine.findTag({search: search})
            },
            searchTag() {
                let search = Strings.isNotBlank(this.tag.tagSearchText) ? this.tag.tagSearchText.trim() : null
                this.loadTagList(search)
                this.tag.tagSelect = null
            },
            selectTag(tag: string) {
                this.tag.tagSelect = tag
                this.tag.tagEditor.name = Tags.getTagName(tag)
                this.tag.tagEditor.type = Tags.getTagType(tag)
            },
            saveTag() {
                let name = null, type = null
                if(Tags.getTagName(this.tag.tagSelect) != this.tag.tagEditor.name) {
                    let ok = true
                    if(db.engine.findTag({title__eq: this.tag.tagEditor.name}).length > 0) {
                        if(!confirm(`名称为[${this.tag.tagEditor.name}]的标签已经存在。名称变更操作会视为合并。确认合并吗？`)) ok = false
                    }
                    if(ok) {
                        name = this.tag.tagEditor.name
                    }
                }
                if(Tags.getTagType(this.tag.tagSelect) != this.tag.tagEditor.type) {
                    type = this.tag.tagEditor.type
                }
                if(name || type) {
                    let count = db.engine.renameTag(this.tag.tagSelect, name, type)
                    if(count > 0) {
                        db.engine.save()
                        alert(`修改了${count}个项目的标签。`)
                        this.loadTagList()
                    }
                }

                this.tag.tagSelect = null
            },
            deleteTag() {
                if(confirm(`确认要删除该标签吗？该操作会消除所有项目中的标签[${Tags.getTagName(this.tag.tagSelect)}]，且不可撤销。`)) {
                    let cnt = db.engine.deleteTag(this.tag.tagSelect)
                    if(cnt > 0) {
                        db.engine.save()
                        alert(`在${cnt}个项目中移除了此标签。`)
                        this.loadTagList()
                    }
                    this.tag.tagSelect = null
                }
            },
            //文件夹
            createFolder() {
                if(Strings.isBlank(this.folder.create.name)) {
                    alert('文件夹的名称不能为空。')
                    return
                }
                let name = this.folder.create.name.trim()
                let virtual = !(this.folder.create.type === 'folder')
                if(db.engine.isFolderExist(name)) {
                    alert('该名称的文件夹已经存在。')
                    return
                }
                if(!virtual) {
                    db.engine.createOrUpdateRealFolder(name, [], "update")
                }else{
                    db.engine.createOrUpdateVirtualFolder(name, {})
                }
                db.engine.save()
                this.folder.create.name = ''
                vm.$set(this.folder.folders, this.folder.folders.length, {name: name, virtual: virtual})
            },
            removeFolder() {
                if(this.folder.selectedIndex >= 0) {
                    let f = this.folder.folders[this.folder.selectedIndex]
                    if(db.engine.deleteFolder(f.name)) {
                        db.engine.save()
                        Arrays.removeAt(this.folder.folders, this.folder.selectedIndex)
                    }else{
                        console.warn('folder delete failed.')
                    }

                }
            },
            //tab控制和其他
            setTab(tab) {
                $('.nav-link').removeClass('active')
                $('.tab-pane').removeClass('active')
                $(`#${tab}-btn`).addClass('active')
                $(`#${tab}`).addClass('active')
            },
            setTouchBar() {
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
            },
            //工具函数
            getTagName(tag: string): string {
                return Tags.getTagName(tag)
            },
            getTagColor(tag: string): {background: string, color: string} {
                let tagType = Tags.getTagType(tag)
                for(let type of this.tag.typeList) {
                    if(type.key === tagType) {
                        return {
                            background: type.background,
                            color: type.fontcolor
                        }
                    }
                }
                return {background: '', color: ''}
            },
        }
    })

    return vm
}

module.exports = settingModel