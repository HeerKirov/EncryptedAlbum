const electron = require('electron')
const {dialog, TouchBar} = electron.remote
const {TouchBarButton, TouchBarSpacer, TouchBarPopover, TouchBarSlider} = TouchBar
const {nativeImage} = electron
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
            currentIndexInput: '0'
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
                vueModel.setTouchBar(new TouchBar({
                    items: [
                        new TouchBarSpacer({size: 'flexible'}),
                        new TouchBarButton({label: '导入本地', click: this.addGeneral}),
                        new TouchBarButton({label: '添加Pixiv', click: this.addPixiv}),
                        new TouchBarButton({label: '添加URL', click: this.addURL}),
                    ]
                }))
            },
            leave: function() {
                this.visible = false
                this.clearItems()
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
                        // this.toPage(this.items.length - 1)
                    }
                })
            },
            addPixiv: function() {
                alert('尚待开发。') // TODO 尚待开发
            },
            addURL: function() {
                alert('尚待开发。') // TODO 尚待开发
            },
            appendToList: function(items) {
                for(let i in items) {
                    vm.$set(this.items, this.count + parseInt(i), items[i])
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
                    this.current = defaultCurrent
                    this.current = this.items[index]
                }
            },
            getTagType: function (tag) {
                let flag = tag.slice(0, 1)
                return {
                    'badge-warning': flag === '@',
                    'badge-info': flag === '%',
                    'badge-success': flag === '#'
                }
            },
            getTagName: function (tag) {
                return tag.slice(1)
            },
            addNewTag: function () {
                let newTag = this.newTagSelect + this.newTagInput
                if(!(newTag in this.current.tags)) {
                    vm.$set(this.current.tags, this.current.tags.length, newTag)
                }
                this.newTagInput = ''
            },
            addOldTag: function(tag) {
                if(!(tag in this.current.tags)) {
                    vm.$set(this.current.tags, this.current.tags.length, tag)
                }
            },
            removeTag: function(tag) {
                for(let i in this.current.tags) {
                    if(this.current.tags[i] === tag) {
                        this.current.tags.splice(i, 1)
                        let mid = this.current.tags
                        this.current.tags = []
                        this.current.tags = mid
                        break
                    }
                }
            },
            addNewLink: function () {
                vm.$set(this.current.links, this.current.links.length, {name: ''})
            },
            removeLink: function (index) {
                let links = this.current.links
                if(index < links.length) {
                    links.splice(index, 1)
                    this.current.links = null
                    this.current.links = links
                }
            }
        }
    })
    return vm
}

module.exports = addModel