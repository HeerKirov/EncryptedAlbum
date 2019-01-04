const {nativeImage, remote} = require('electron')
const {containsElement} = require('../target/common/utils')
const {downloadImageDataURL} = require('../target/common/imageTool')
const {PixivClient} = require('../target/common/pixiv')
const {dialog, TouchBar} = remote
const {TouchBarButton, TouchBarSpacer} = TouchBar
const Vue = require('vue/dist/vue')
const {readFile} = require('fs')

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

// class TaskManager {
//     setItemFunc = null
//     clearItemFunc = null
//     allCompleteFunc = null
//     nextIndex = 0
//
//     tasks = {}
//     taskCount = 0
//
//     constructor(addItem, clearItem) {
//         this.setItemFunc = addItem
//         this.clearItemFunc = clearItem
//     }
//
//     setAllComplete(allComplete) {
//         this.allCompleteFunc = allComplete
//     }
//
//     checkTaskCount() {
//         if(this.taskCount <= 0) {
//             this.taskCount = 0
//             this.tasks.clear()
//             this.clearItemFunc()
//             //TODO add err msg
//             if(this.allCompleteFunc) this.allCompleteFunc()
//         }
//     }
//
//     /**
//      * 向管理器注册一个监控进度的任务。
//      * task需要是一个function(step: (percent: number) => boolean, error: (message: string) => void).
//      *      回调step函数以更新任务进度.需要一个介于[0, 100]的数字。回调100会导致任务完成。这个函数还会返回一个布尔值，告知当前任务是否未被取消。
//      *      回调error函数以告知有异常抛出，任务终止。
//      * @param title
//      * @param task
//      * @return 返回该任务的id.
//      */
//     register(title, task) {
//         if(task) {
//             let id = ++this.nextIndex
//             let stepFunc = function (percent) {
//                 this.manager.tasks[id].percent = percent
//                 if(percent >= 100 && !this.manager.tasks[id].completed) {
//                     this.manager.tasks[id].completed = true
//                     this.manager.taskCount --
//                     this.manager.checkTaskCount()
//                 }
//             }
//             stepFunc.prototype.manager = this
//             let errorFunc = function(message) {
//                 this.manager.tasks[id].completed = true
//                 this.manager.tasks[id].error = message
//                 this.manager.taskCount --
//                 this.manager.checkTaskCount()
//             }
//             errorFunc.prototype.manager = this
//             task(stepFunc, errorFunc)
//             let t = {
//                 id: id,
//                 title: title,
//                 percent: 0,
//                 completed: false,
//                 error: null,
//                 cancel: false
//             }
//             this.tasks[id] = t
//             this.setItemFunc(id, t)
//         }
//     }
//
//     cancel(id) {
//         if(id in this.tasks) {
//             this.tasks[id].cancel = true
//             this.tasks[id].completed = true
//             this.taskCount --
//             this.checkTaskCount()
//         }
//     }
//     cancelAll() {
//         for(let task of this.tasks) {
//             task.cancel = true
//             task.completed = true
//         }
//         this.taskCount = 0
//         this.checkTaskCount()
//     }
// }

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

            importURL: [],
            importPixiv: []
        },
        computed: {
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
                vueModel.setTouchBar(new TouchBar({
                    items: [
                        new TouchBarSpacer({size: 'flexible'}),
                        new TouchBarButton({label: '导入本地', click: this.addGeneral}),
                        new TouchBarButton({label: '添加Pixiv', click: () => $('#importPixivModal').modal()}),
                        new TouchBarButton({label: '添加URL', click: () => $('#importURLModal').modal()}),
                    ]
                }))
            },
            leave: function() {
                this.visible = false
                this.clearItems()
                this.importURL = []
                this.importPixiv= []
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
                        createTime: new Date().getTime()
                    }
                    dataURLs[dataURLs.length] = {id: id, dataURL: item.dataURL}
                }
                try {
                    db.engine.createImage(newImages)
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
                    saveOne(0)
                }catch (e) {
                    alert(e)
                }
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
                if(this.importPixiv) {
                    let client = new PixivClient()
                    client.login('', '', (b) => {
                        if(b) {
                            console.log('login success.')
                            let results = []
                            let cnt = this.importPixiv.length
                            for(let i in this.importPixiv) {
                                ((index, pid) => {
                                    let info = null
                                    let buffers = []
                                    client.loadIllust(pid, (illust) => {
                                        console.log(`[${pid}]illust download success.`)
                                        if(illust) {
                                            info = illust
                                        }else{
                                            alert(`pixiv ID=${pid}的项目无法被正确识别。`)
                                        }
                                    }, (id, buf) => {
                                        if(id >= 0 && buf) {
                                            console.log(`[${pid}]image ${id} download success.`)
                                            buffers[id] = buf
                                        }else if(id === -1){
                                            addToResult()
                                        }else{
                                            console.log(`[${pid}]image ${id} download failed.`)
                                        }
                                    })
                                    function addToResult() {
                                        console.log(`[${pid}]add to result.`)
                                        console.log(buffers)
                                        for(let i in buffers) {
                                            let buf = buffers[i]
                                            if(!buf) continue
                                            let native = nativeImage.createFromBuffer(buf)
                                            let tags = []
                                            for(let tag of info.tags) tags[tags.length] = `%${tag}`
                                            tags[tags.length] = `@${info.member}`
                                            results[index] = {
                                                title: info.pageCount > 1 ? `${info.title}-${i}` : info.title,
                                                collection: info.pageCount > 1 ? info.title : null,
                                                tags: tags,
                                                links: [{name: info.webLink}],
                                                favorite: false,
                                                resolution: native.getSize(),
                                                dataURL: 'data:image/jpeg;base64,' + buf.toString('base64')
                                            }
                                            cnt --
                                            if(cnt <= 0) {
                                                vm.appendToList(results)
                                            }
                                        }
                                    }
                                })(i, this.importPixiv[i].name)
                            }
                            this.importPixiv = []
                        }else{
                            alert('Pixiv账户登录失败。请检查用户名、密码或网络连接。')
                        }
                    })

                }
            },
            addURL: function() {
                if(this.importURL) {
                    let results = []
                    let cnt = this.importURL.length
                    for(let i in this.importURL) {
                        ((index, path) => {
                            downloadImageDataURL(path, (dataURL, status) => {
                                if(dataURL) {
                                    let image = nativeImage.createFromDataURL(dataURL)
                                    results[index] = {
                                        title: '',
                                        collection: '',
                                        tags: [],
                                        links: [],
                                        favorite: false,
                                        resolution: image.getSize(),
                                        dataURL: dataURL
                                    }
                                    cnt --
                                    if(cnt <= 0) {
                                        vm.appendToList(results)
                                    }
                                }else{
                                    alert(`尝试下载${path}时发生错误。错误代码: ${status}`)
                                }
                            })
                        })(i, this.importURL[i].name)
                    }
                    this.importURL = []
                }
            },
            appendToList: function(items) {
                for(let i in items) {
                    this.$set(this.items, this.count + parseInt(i), items[i])
                }
                let nextPageIndex = this.count
                this.count += items.length
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
            }
        }
    })
    return vm
}

module.exports = addModel