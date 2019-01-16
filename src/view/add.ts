import {nativeImage, remote} from 'electron'
import {containsElement} from '../common/utils'
import {downloadImageBuffer} from '../common/imageTool'
import {PixivClient} from '../common/pixiv'
import {readFile} from 'fs'
const {dialog, TouchBar} = remote
const {TouchBarButton, TouchBarSpacer} = TouchBar
const Vue = require('vue/dist/vue')
const $ = window['$']

const defaultCurrent = {
    title: null,
    collection: null,
    tags: [],
    links: [],
    favorite: false,
    resolution: { width: 0, height: 0 },
    dataURL: ''
}

function copyArray(from) {
    if(from) {
        let ret = []
        for(let i in from) {
            ret[i] = from[i]
        }
        return ret
    }else{
        return []
    }
}

function addModel(vueModel) {
    let db = vueModel.db
    let vm = new Vue({
        el: '#addView',
        data: {
            visible: false,
            fullscreen: false,
            items: [],
            count: 0,
            currentIndex: 0,
            current: defaultCurrent,
            tags: [],
            newTagInput: '',
            newTagSelect: '#',
            currentIndexInput: '0',

            importURL: [{name: ''}],
            importPixiv: [{name: ''}],
            networkConfig: {
                pixiv: null,
                proxy: null
            },
            loadDialog: {
                show: false,
                title: '',
                description: '',
                step: 0, max: 1
            }
        },
        computed: {
            noTitleBar: function() {
                return this.fullscreen || db.platform.platform !== 'darwin'
            },
            showNavigator: function() {
                return this.count > 1
            },
            emptyList: function () {
                return this.count === 0
            },
            resolution: function () {
                if(this.current != null && this.current.resolution != null) {
                    return this.current.resolution.width + '×' + this.current.resolution.height
                }else{
                    return ''
                }
            },
            canPrev: function () {
                return this.currentIndex > 0
            },
            canNext: function () {
                return this.currentIndex < this.count - 1
            }
        },
        methods: {
            load: function() {
                db.ui.theme = 'gray'
                this.visible = true
                if(db.ui.fullscreen) {this.enterFullScreen()} else {this.leaveFullScreen()}
                this.tags = db.engine.findTag({order: ['type', 'title']})
                this.networkConfig.pixiv = db.engine.getConfig('pixiv')
                this.networkConfig.proxy = db.engine.getConfig('proxy')
                vueModel.setTouchBar(new TouchBar({
                    items: [
                        new TouchBarSpacer({size: 'flexible'}),
                        new TouchBarButton({label: '导入本地', click: () => {
                                if(!this.loadDialog.show) this.addGeneral()
                            }
                        }),
                        new TouchBarButton({label: '添加Pixiv', click: () => {
                                if(!this.loadDialog.show) $('#importPixivModal').modal()
                            }
                        }),
                        new TouchBarButton({label: '添加URL', click: () => {
                                if(!this.loadDialog.show) $('#importURLModal').modal()
                            }
                        }),
                    ]
                }))
            },
            leave: function() {
                $('#importPixivModal').modal('hide')
                $('#importURLModal').modal('hide')
                this.visible = false
                this.importURL = [{name: ''}]
                this.importPixiv= [{name: ''}]
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
            save: function () {
                let newImages = []
                let dataURLs = []
                let nextId = db.engine.getNextId()
                let timestamp = new Date().getTime()
                for(let i in this.items) {
                    let item = this.items[i]

                    let links = []
                    for(let j in item.links) links[j] = item.links[j].name
                    let id = nextId ++
                    newImages[i] = {
                        id: id,
                        title: item.title ? item.title : null,
                        collection: item.collection ? item.collection : null,
                        tags: item.tags,
                        links: links,
                        favorite: item.favorite,
                        resolution: item.resolution,
                        createTime: timestamp
                    }
                    dataURLs[dataURLs.length] = {id: id, dataURL: item.dataURL}
                }
                function saveOne(i) {
                    if(i >= dataURLs.length) {
                        db.engine.save()
                        vm.clearItems()
                        vueModel.route('main')
                    }else{
                        db.engine.saveImageURL(dataURLs[i].id, dataURLs[i].dataURL, () => {
                            saveOne(i + 1)
                        })
                    }
                }
                try {
                    db.engine.createImage(newImages)
                    saveOne(0)
                }catch (e) {
                    alert(e)
                }
            },
            goSettingPixiv: function() {
                vueModel.route('setting', 'pixiv')
            },

            addGeneral: function() {
                dialog.showOpenDialog(db.currentWindow, {
                    title: '选择图片',
                    properties: ['openFile', 'multiSelections'],
                    filters: [
                        {name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'bmp']},
                        {name: 'All', extensions: ['*']}
                    ]
                }, (paths) => {
                    if(paths) {
                        let results = []
                        let cnt = paths.length
                        for(let i in paths) {
                            let path = paths[i];
                            ((index) => {
                                readFile(path, (e, buf) => {
                                    let image = nativeImage.createFromBuffer(buf)
                                    results[index] = {
                                        title: '',
                                        collection: '',
                                        tags: [],
                                        links: [],
                                        favorite: false,
                                        resolution: image.getSize(),
                                        dataURL: 'data:image/jpeg;base64,' + buf.toString('base64')
                                    }
                                    cnt --
                                    if(cnt <= 0) {
                                        vm.appendToList(results)
                                    }
                                })
                            })(i)
                        }
                    }
                })
            },
            addPixiv: function() {
                if(this.importPixiv.length > 0) {
                    if(!this.networkConfig.pixiv) {
                        alert('Pixiv账户和密码未配置。')
                        return
                    }
                    let client = new PixivClient()
                    if(this.networkConfig.proxy) client = client.setProxy(this.networkConfig.proxy)
                    this.showLoadingDialog('解析Pixiv项目', 1 + this.importPixiv.length * 2)
                    this.loadDialog.description = '尝试登录pixiv……'
                    client.login(this.networkConfig.pixiv.username, this.networkConfig.pixiv.password, (b) => {
                        if(!this.loadDialog.show) return;
                        if(b) {
                            console.log('[Pixiv] login success.')
                            let results = []
                            let cnt = this.importPixiv.length
                            this.addLoadingStep(1)
                            this.loadDialog.description = '正在下载并分析illust……'
                            for(let i in this.importPixiv) {
                                ((index, pid) => {
                                    let info = null
                                    let buffers = []
                                    client.loadIllust(pid, (illust) => {
                                        if(!this.loadDialog.show) return;
                                        console.log(`[Pixiv][${pid}]illust download success.`)
                                        if(illust) {
                                            info = illust
                                            this.loadDialog.description = '正在下载图片……'
                                            this.addLoadingStep(1)
                                        }else{
                                            alert(`pixiv ID为${pid}的项目无法被正确识别。`)
                                            this.addLoadingStep(2)
                                        }
                                    }, (id, buf) => {
                                        if(!this.loadDialog.show) return;
                                        if(id >= 0 && buf) {
                                            console.log(`[${pid}]image ${id} download success.`)
                                            buffers[id] = buf
                                        }else if(id === -1){
                                            addToResult()
                                            this.addLoadingStep(1)
                                        }else{
                                            console.log(`[Pixiv][${pid}]image ${id} download failed.`)
                                        }
                                    })
                                    let addToResult = () => {
                                        if(!this.loadDialog.show) return;
                                        console.log(`[Pixiv][${pid}]add to result.`)
                                        for(let i in buffers) {
                                            let buf = buffers[i]
                                            if(!buf) continue
                                            let native = nativeImage.createFromBuffer(buf)
                                            let tags = []
                                            for(let tag of info.tags) tags[tags.length] = `%${tag}`
                                            tags[tags.length] = `@${info.member}`
                                            results[results.length] = {
                                                title: info.pageCount > 1 ? `${info.title}-${parseInt(i) + 1}` : info.title,
                                                collection: info.pageCount > 1 ? info.title : null,
                                                tags: tags,
                                                links: [{name: info.webLink}],
                                                favorite: false,
                                                resolution: native.getSize(),
                                                dataURL: 'data:image/jpeg;base64,' + buf.toString('base64')
                                            }
                                        }
                                        cnt --
                                        if(cnt <= 0) {
                                            this.appendToList(results)
                                            this.importPixiv = [{name: ''}]
                                        }
                                    }
                                })(i, this.importPixiv[i].name)
                            }
                        }else{
                            this.stopLoadingDialog()
                            alert('Pixiv账户登录失败。请检查用户名、密码或网络连接。')
                        }
                    })

                }
            },
            addURL: function() {
                if(this.importURL.length > 0) {
                    let results = []
                    let cnt = this.importURL.length
                    this.showLoadingDialog('下载URL项目', this.importURL.length)
                    this.loadDialog.description = '下载中……'
                    for(let i in this.importURL) {
                        ((index, path) => {
                            downloadImageBuffer({url: path, proxy: this.networkConfig.proxy}, (buffer, status) => {
                                if(!this.loadDialog.show) return
                                if(buffer) {
                                    let native = nativeImage.createFromBuffer(buffer)
                                    results[index] = {
                                        title: '',
                                        collection: '',
                                        tags: [],
                                        links: [],
                                        favorite: false,
                                        resolution: native.getSize(),
                                        dataURL: 'data:image/jpeg;base64,' + buffer.toString('base64')
                                    }
                                    cnt --
                                    if(cnt <= 0) {
                                        vm.appendToList(results)
                                    }
                                }else{
                                    alert(`尝试下载${path}时发生错误。错误代码: ${status}`)
                                }
                                this.addLoadingStep(1)
                            })
                        })(i, this.importURL[i].name)
                    }
                    this.importURL = [{name: ''}]
                }
            },
            appendToList: function(items) {
                let nextPageIndex = this.count
                for(let i in items) {
                    this.$set(this.items, this.count++, items[i])
                }
                this.toPage(nextPageIndex)
            },
            removeItem: function() {
                if(this.count > 0) {
                    let [left] = this.items.splice(this.currentIndex, 1)
                    left.image = null
                    left.dataURL = null
                    if(this.currentIndex > 0) {
                        this.currentIndex = this.currentIndex - 1
                    }
                    this.currentIndexInput = this.currentIndex + 1
                    this.current = this.items[this.currentIndex]
                    this.count --
                }
            },
            clearItems: function() {
                if(this.count > 0) {
                    this.count = 0
                    this.current = defaultCurrent
                    this.items = []
                    this.currentIndex = 0
                }
            },
            toPage: function(index) {
                if(index >= 0 && index < this.count) {
                    this.currentIndex = index
                    this.currentIndexInput = index + 1
                    this.current = this.items[index]
                }
            },
            getTagType: function (tag, prefix) {
                if(tag) {
                    let flag = tag.slice(0, 1)
                    let ret = {}
                    ret[prefix + '-warning'] = flag === '@'
                    ret[prefix + '-info'] = flag === '%'
                    ret[prefix + '-success'] = flag === '#'
                    return ret
                }else{
                    return null
                }
            },
            getTagName: function (tag) {
                if(tag) return tag.slice(1)
                else return null
            },
            addNewTag: function () {
                if(!this.newTagInput) {
                    return
                }
                let newTag = this.newTagSelect + this.newTagInput
                if(!containsElement(newTag, this.current.tags)) {
                    this.$set(this.current.tags, this.current.tags.length, newTag)
                    if(!containsElement(newTag, this.tags)) {
                        this.$set(this.tags, this.tags.length, newTag)
                    }
                }
                this.newTagInput = ''
            },
            addOldTag: function(tag) {
                if(!containsElement(tag, this.current.tags)) {
                    this.$set(this.current.tags, this.current.tags.length, tag)
                }
            },
            removeTag: function(tag) {
                for(let i in this.current.tags) {
                    if(this.current.tags[i] === tag) {
                        this.current.tags.splice(i, 1)
                        break
                    }
                }
            },
            changeTagType: function(index) {
                let type = this.current.tags[index].slice(0, 1)
                if(type === '@') type = '%'
                else if(type === '%') type = '#'
                else type = '@'
                this.$set(this.current.tags, index, type + this.current.tags[index].slice(1))
            },
            addNewLink: function () {
                this.$set(this.current.links, this.current.links.length, {name: ''})
            },
            removeLink: function (index) {
                let links = this.current.links
                if(index < links.length) {
                    links.splice(index, 1)
                }
            },

            copyInfoFromPrev: function () {
                if(this.currentIndex > 0) {
                    let prev = this.items[this.currentIndex - 1]
                    if(prev.title) this.$set(this.current, 'title', prev.title)
                    if(prev.collection) this.$set(this.current, 'collection', prev.collection)
                    if(prev.links) this.$set(this.current, 'links', copyArray(prev.links))
                    if(prev.tags) this.$set(this.current, 'tags', copyArray(prev.tags))
                    this.$set(this.current, 'favorite', prev.favorite)
                }
            },

            addNewURL: function () {
                this.$set(this.importURL, this.importURL.length, {name: ''})
            },
            removeURL: function (index) {
                let urls = this.importURL
                if(index < urls.length) {
                    urls.splice(index, 1)
                }
            },
            addNewPID: function () {
                this.$set(this.importPixiv, this.importPixiv.length, {name: ''})
            },
            removePID: function (index) {
                let pids = this.importPixiv
                if(index < pids.length) {
                    pids.splice(index, 1)
                }
            },

            showLoadingDialog: function (title, max) {
                //打开加载框，并重置所有配置.
                this.loadDialog.show = true
                this.loadDialog.step = 0
                this.loadDialog.title = title ? title : 'Loading'
                this.loadDialog.max = max
            },
            addLoadingStep: function(step) {
                if(!this.loadDialog.show) return
                this.loadDialog.step += step
                if(this.loadDialog.step >= this.loadDialog.max) {
                    this.stopLoadingDialog()
                }
            },
            stopLoadingDialog: function () {
                //关闭加载框。取消加载也用这个.
                this.loadDialog.show = false
            }
        }
    })
    return vm
}

module.exports = addModel