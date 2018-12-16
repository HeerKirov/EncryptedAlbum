const electron = require('electron')
const {dialog} = electron.remote
const {ipcRenderer, nativeImage} = electron
const {Vue} = require('../view.js/base')

const defaultCurrent = {
    title: null,
    collection: null,
    tags: [],
    links: [],
    favorite: false,
    resolution: { width: 0, height: 0 },
    dataURL: '',
    image: null
}

let vm = new Vue({
    el: '#app',
    data: {
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
        goBack: function() {
            ipcRenderer.send('goto', 'main')
        },
        addGeneral: function() {
            dialog.showOpenDialog({
                title: '选择图片',
                properties: ['openFile', 'multiSelections'],
                filters: [
                    {name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'bmp']},
                    {name: 'All', extensions: ['*']}
                ]
            }, (paths) => {
                if(paths) {
                    for(let path of paths) {
                        let image = nativeImage.createFromPath(path)
                        let item = {
                            title: '',
                            collection: '',
                            tags: [],
                            links: [],
                            favorite: false,
                            resolution: image.getSize(),
                            dataURL: image.toDataURL(),
                            image: image
                        }
                        this.appendToList(item)
                    }
                    this.toPage(this.items.length - 1)
                }
            })
        },
        addPixiv: function() {
            alert('尚待开发。') // TODO 尚待开发
        },
        addURL: function() {
            alert('尚待开发。') // TODO 尚待开发
        },
        appendToList: function(item) {
            this.items[this.count] = item
            this.count ++
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
        save: function () {
            let newImages = []
            let nextId = ipcRenderer.sendSync('get-next-id')
            for(let i in this.items) {
                let item = this.items[i]

                let links = []
                for(let j in item.links) links[j] = item.links[j].name

                let buf = item.image.toJPEG(100).toString('base64')
                newImages[i] = {
                    id: nextId ++,
                    title: item.title ? item.title : null,
                    collection: item.collection ? item.collection : null,
                    tags: item.tags,
                    links: links,
                    favorite: item.favorite,
                    resolution: item.resolution,
                    createTime: new Date(),
                    buffer: buf  //为了传递到主线程，buffer在这里就被劣化成JPEG100，并转换buffer至string。
                }
            }
            let rec = ipcRenderer.sendSync('create-image', newImages)
            if(rec == null) {
                ipcRenderer.send('goto', 'main')
            }else{
                alert(rec)
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
                let tags = this.current.tags
                tags[tags.length] = newTag
                this.current.tags = null
                this.current.tags = tags
            }
            this.newTagInput = ''
        },
        addOldTag: function(tag) {
            if(!(tag in this.current.tags)) {
                let tags = this.current.tags
                tags[tags.length] = tag
                this.current.tags = null
                this.current.tags = tags
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
            let links = this.current.links
            links[links.length] = {name: ''}
            this.current.links = null
            this.current.links = links
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