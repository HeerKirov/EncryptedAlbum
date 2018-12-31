const {ImageSpecification} = require("../target/common/engine")
const {containsElement} = require('../target/common/utils')
const {exportImage} = require('../target/common/imageTool')
const {remote, shell} = require('electron')
const {TouchBar, dialog} = remote
const {TouchBarSpacer, TouchBarPopover,
    TouchBarSlider, TouchBarSegmentedControl} = TouchBar
const Vue = require('vue/dist/vue')

const THUMBNAIL_SIZE = 5

const PLAY_ITEMS = [
    {title: '停止', value: null},
    {title: '1秒', value: 1},
    {title: '3秒', value: 3},
    {title: '5秒', value: 5},
    {title: '10秒', value: 10},
    {title: '30秒', value: 30},
    {title: '1分钟', value: 60},
    {title: '2分钟', value: 120}
]

function buildPlayScrubbers() {
    let ret = []
    for(let i in PLAY_ITEMS) {
        ret[ret.length] = {label: PLAY_ITEMS[i].title}
    }
    return ret
}

function buildTouchBar(vm) {
    let showInfoControl = new TouchBarSegmentedControl({
        mode: 'single',
        segments: [{label: '预览页'}, {label: '信息页'}],
        selectedIndex: vm.showInfo ? 1 : 0,
        change: function (index, state) {
            vm.showInfo = index !== 0
        }
    })
    let zoomValueControl = new TouchBarSlider({
        label: '尺寸',
        minValue: 0, maxValue: 100, value: vm.zoomValue,
        change: (value) => {
            vm.zoomValue = value
        }
    })
    let zoomAbsoluteControl = new TouchBarSegmentedControl({
        segments: [
            {label: '绝对值'},
            {label: '自适应'}
        ],
        selectedIndex: vm.zoomAbsolute ? 0 : 1,
        change: (index, state) => {
            vm.zoomAbsolute = index === 0
        }
    })
    let playRandControl = new TouchBarSegmentedControl({
        segments: [
            {label: '随机'},
            {label: '顺序'}
        ],
        selectedIndex: vm.playRand ? 0 : 1,
        change: (index, state) => {
            vm.playRand = index === 0
        }
    })
    let playItemControl = new TouchBarSegmentedControl({
        segments: buildPlayScrubbers(),
        selectedIndex: vm.playItem,
        change: (index, state) => {
            vm.playItem = index
        },
    })

    let touchBar = new TouchBar({
        items: [
            new TouchBarSpacer({size: 'large'}),
            showInfoControl,
            new TouchBarSpacer({size: 'flexible'}),
            new TouchBarSegmentedControl({
                mode: 'buttons',
                segments: [{label: '上一页'}, {label: '下一页'}],
                change: function (index, state) {
                    if(index === 0) vm.prevPage()
                    else vm.nextPage()
                }
            }),
            new TouchBarSpacer({size: 'flexible'}),
            new TouchBarPopover({
                label: '轮播',
                items: [
                    playRandControl,
                    new TouchBarSpacer({size: 'large'}),
                    playItemControl
                ]
            }),
            new TouchBarPopover({
                label: '缩放',
                items: [zoomValueControl, zoomAbsoluteControl]
            })
        ]
    })

    return {
        touchBar,
        showInfoControl,
        zoomAbsoluteControl, zoomValueControl,
        playItemControl, playRandControl
    }
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
function equalArray(a, b) {
    if(a && b) {
        if(a.length !== b.length) return false
        for(let i = 0; i < a.length; ++i) {
            if(a[i] !== b[i]) return false
        }
        return true
    }
    return false
}
function copyImage(from) {
    if(from) {
        return {
            id: from.id | 0,
            title: from.title,
            collection: from.collection,
            tags: copyArray(from.tags),
            links: copyArray(from.links),
            favorite: from.favorite | false,
            resolution: {
                width: from.resolution ? from.resolution.width : 0,
                height: from.resolution ? from.resolution.height : 0
            },
            createTime: from.createTime | 0
        }
    }else{
        return emptyImage()
    }
}
function equalImage(a, b) {
    if(!a || !b) return false
    else if(a.title !== b.title) return false
    else if(a.collection !== b.collection) return false
    else if(!equalArray(a.tags, b.tags)) return false
    else {
        if(a.links.length !== b.links.length) return false
        for(let i = 0; i < a.links.length; ++i) {
            let linkA = a.links[i]
            let linkB = b.links[i]
            if(typeof linkA === 'object') linkA = linkA['name']
            if(typeof linkB === 'object') linkB = linkB['name']
            if(linkA !== linkB) return false
        }
        return true
    }
}
function emptyImage() {
    return {
        id: 0,
        title: null,
        collection: null,
        tags: [],
        favorite: false,
        links: [],
        resolution: {width: 0, height: 0},
        createTime: 0
    }
}

function detailModel(vueModel) {
    let db = vueModel.db

    let timer = null
    let touchBar = null
    let vm = new Vue({
        el: '#detailView',
        data: {
            visible: false,
            fullscreen: false,

            showDock: true,     //控制下方工具条的显示
            dockType: 'list',   //dock栏显示的内容[list, zoom, play]
            showTool: true,     //控制环绕在图片四周的工具按钮的显示
            showInfo: false,    //控制切换信息页
            editMode: false,    //信息页的编辑模式

            playItem: 0,        //轮播的值的index
            playRand: false,    //随机轮播

            zoomAbsolute: false,//启用绝对值缩放
            zoomValue: 50,      //绝对缩放。这个绝对值仍然是基于图片的基础大小缩放的，50%相当于原大小。

            showList: [],       //当前正在展示的Image[]列表。
            showIndex: -1,      //当前前台展示的image在列表内的index。

            currentDataURL: '',         //当前前台展示的image的dataURL。
            currentImage: emptyImage(), //当前前台展示的image的Image。
            editImage: {                //与edit模式控件绑定的变量组。
                title: null,
                collection: null,
                tags: [],
                newTag: '',
                newTagType: '#',
                links: []
            },
            thumbnails: [],             //下方缩略图区正在展示的image的简略结构。{dataURL: string, title: string}
            thumbnailFirstIndex: null,  //下方缩略图区正在展示的image中，第一个的index。

            existTags: [],
            playItems: PLAY_ITEMS    //绑定显示的常量
        },
        computed: {
            showFullScreenButton: function () {
                return db.platform.platform !== 'darwin'
            },
            showPageButton: function () {
                return this.showList.length > 1
            },
            mainImageZoom: function () {
                if(this.zoomAbsolute) {
                    let rate = this.zoomValue < 50 ? this.zoomValue / 250 + 0.1
                            :  this.zoomValue > 50 ? this.zoomValue / 62.5 - 0.5 : 0.3
                    return {
                        'width': this.currentImage.resolution.width * rate + 'px',
                        'height': this.currentImage.resolution.height * rate + 'px'
                    }
                }else{
                    return {
                        'max-width': '100%',
                        'max-height': '100%'
                    }
                }
            }
        },
        watch: {
            'playItem': function (value) {
                if(touchBar != null) {
                    touchBar.playItemControl.selectedIndex = value
                }
                if(timer != null) {
                    clearInterval(timer)
                    timer = null
                }
                if(PLAY_ITEMS[value].value) timer = setInterval(this.togglePlay, PLAY_ITEMS[value].value * 1000)
            },
            'playRand': function (value) {
                if(touchBar != null) {
                    touchBar.playRandControl.selectedIndex = value ? 0 : 1
                }
            },
            'zoomAbsolute': function (value) {
                if(touchBar != null) {
                    touchBar.zoomAbsoluteControl.selectedIndex = value ? 0 : 1
                }
            },
            'zoomValue': function (value) {
                if(touchBar != null) {
                    touchBar.zoomValueControl.value = parseInt(value)
                }
            },
            'showInfo': function (value) {
                touchBar.showInfoControl.selectedIndex = value ? 1 : 0
            }
        },
        methods: {
            load: function (arg) {
                db.ui.theme = 'dark'
                this.visible = true
                if(db.ui.fullscreen) {this.enterFullScreen()} else {this.leaveFullScreen()}
                if(db.engine == null) {
                    db.engine = db.storage.loadMainEngine()
                    db.engine.connect()
                }
                if(arg) {
                    this.loadShowList(arg['list'], arg['index'], arg['aggregate'])
                }
                this.existTags = db.engine.findTag({order: ['type', 'title']})
                this.setTouchBar()
            },
            leave: function () {
                this.visible = false
                this.showList = []
                this.showIndex = -1
                this.currentDataURL = ''
                this.currentImage = this.editImage = emptyImage()
                this.thumbnailFirstIndex = null
                this.thumbnails = []
            },
            enterFullScreen: function () {
                this.fullscreen = true
            },
            leaveFullScreen: function () {
                this.fullscreen = false
            },

            goBack: function() {
                vueModel.route('main')
            },
            switchFullScreen: function() {
                db.currentWindow.setFullScreen(!db.ui.fullscreen)
            },
            exportImage: function() {
                let image = this.currentImage
                let filename = image.title ? image.title : image.collection
                dialog.showSaveDialog(db.currentWindow, {
                    title: '导出图片',
                    defaultPath: filename,
                    filters: [
                        {name: 'JPEG', extensions: ['jpg']},
                        {name: 'PNG', extensions: ['png']}
                    ]
                }, (filename) => {
                    if(filename) {
                        exportImage(this.currentDataURL, filename, (success) => {
                            if(success) {
                                alert('图片导出成功。')
                            }else{
                                alert('发生了未知的错误。')
                            }
                        })
                    }
                })
            },

            nextPage: function() {
                if(this.showIndex + 1 < this.showList.length) {
                    this.loadCurrentAs(this.showIndex + 1)
                }else{
                    this.loadCurrentAs(0)
                }
                this.clickThumbnail()
            },
            prevPage: function() {
                if(this.showIndex >= 1) {
                    this.loadCurrentAs(this.showIndex - 1)
                }else{
                    this.loadCurrentAs(this.showList.length - 1)
                }
                this.clickThumbnail()
            },
            togglePlay: function() {
                if(this.playRand) {
                    this.loadCurrentAs(Math.floor(Math.random() * this.showList.length))
                    this.clickThumbnail()
                }else{
                    this.nextPage()
                }
            },

            loadShowList: function(list, index, aggregate) {
                let showList = []
                let showIndex = -1
                for(let i = 0; i < list.length; ++i) {
                    if(index === i) {
                        showIndex = showList.length
                    }
                    if(aggregate) {
                        for(let j = 0; j < list[i].length; ++j) {
                            showList[showList.length] = list[i][j]
                        }
                    }else{
                        showList[showList.length] = list[i]
                    }
                }
                this.showList = showList
                this.loadCurrentAs(showIndex)
                this.clickThumbnail()
            },
            loadCurrentAs: function(index) {
                if(index >= 0 && index < this.showList.length) {
                    this.editMode = false
                    this.showIndex = index
                    let image = this.showList[index]
                    this.currentDataURL = ''
                    this.currentImage = image
                    vueModel.setTitle(image.title ? image.title : image.collection ? image.collection : null)
                    db.engine.loadImageURL(image.id, ImageSpecification.Origin, (dataURL) => {
                        this.currentDataURL = dataURL
                    })
                }
            },
            clickThumbnail: function() {
                //根据当前选定的图像index，刷新缩略图区。这会优先使图像居中，其次靠左。

                //首先试图将index放在floor((SIZE-0.5)/2)上，然后可以计算出，firstIndex=index-floor((SIZE-0.5)/2)
                //然后，如果firstIndex小于0，就向0偏移。
                //lastIndex = firstIndex + SIZE.如果last大于等于showList.length，就向length-1偏移。
                let old = this.thumbnailFirstIndex
                const center = Math.floor((THUMBNAIL_SIZE - 0.5) / 2)
                if(this.showIndex <= center) {
                    this.thumbnailFirstIndex = 0
                }else if(this.showIndex >= this.showList.length - center) {
                    if(this.showList.length - THUMBNAIL_SIZE > 0) {
                        this.thumbnailFirstIndex = this.showList.length - THUMBNAIL_SIZE
                    }else{
                        this.thumbnailFirstIndex = 0
                    }
                }else{
                    if(this.showIndex - center > 0) {
                        this.thumbnailFirstIndex = this.showIndex - center
                    }else{
                        this.thumbnailFirstIndex = 0
                    }
                }
                if(old !== this.thumbnailFirstIndex) this.refreshThumbnails()
            },
            nextThumbnailPartition: function() {
                //将缩略图区滚动到下一个区间。滚动区间并不是完全滚动，它会保留上个区间的最后一个项。
                let old = this.thumbnailFirstIndex
                if(this.thumbnailFirstIndex + 2 * THUMBNAIL_SIZE - 1 >= this.showList.length) {
                    if(this.showList.length - THUMBNAIL_SIZE > 0) {
                        this.thumbnailFirstIndex = this.showList.length - THUMBNAIL_SIZE
                    }else{
                        this.thumbnailFirstIndex = 0
                    }
                }else{
                    this.thumbnailFirstIndex += THUMBNAIL_SIZE -1
                }
                if(old !== this.thumbnailFirstIndex) this.refreshThumbnails()
            },
            prevThumbnailPartition: function() {
                //将缩略图区滚动到上一个区间。滚动区间并不是完全滚动，它会保留下个区间的第一个项。
                let old = this.thumbnailFirstIndex
                if(this.thumbnailFirstIndex < THUMBNAIL_SIZE - 1) {
                    this.thumbnailFirstIndex = 0
                }else{
                    this.thumbnailFirstIndex -= THUMBNAIL_SIZE - 1
                }
                if(old !== this.thumbnailFirstIndex) this.refreshThumbnails()
            },
            refreshThumbnails: function() {
                //根据已经确定好的thumbnailFirstIndex，刷新thumbnails缩略图显示。
                this.thumbnails = []
                for(let i = 0; i < THUMBNAIL_SIZE; ++i) {
                    let image = this.showList[i + this.thumbnailFirstIndex]
                    if(image) {
                        this.$set(this.thumbnails, i, {
                            dataURL: '',
                            title: image.title ? image.title : image.collection,
                            index: i + this.thumbnailFirstIndex
                        })
                        db.engine.loadImageURL(image.id, ImageSpecification.Thumbnail, (dataURL) => {
                            this.$set(this.thumbnails[i], 'dataURL', dataURL)
                        })
                    }
                }
            },

            switchEditMode: function() {
                this.editMode = !this.editMode
                if(!this.editMode) {
                    let origin = copyImage(this.currentImage)
                    if(this.editImage.title == null || this.editImage.title.trim() === '') {
                        this.currentImage.title = null
                    }else{
                        this.currentImage.title = this.editImage.title
                    }
                    if(this.editImage.collection == null || this.editImage.collection.trim() === '') {
                        this.currentImage.collection = null
                    }else{
                        this.currentImage.collection = this.editImage.collection
                    }
                    this.currentImage.tags = copyArray(this.editImage.tags)
                    this.currentImage.links = []
                    for(let i in this.editImage.links) {
                        this.currentImage.links[i] = this.editImage.links[i].name
                    }
                    if(!equalImage(origin, this.currentImage)) {
                        let successNum = db.engine.updateImage([this.currentImage]).length
                        if(successNum > 0) db.engine.save()
                    }
                }else{
                    this.editImage.title = this.currentImage.title
                    this.editImage.collection = this.currentImage.collection
                    this.editImage.tags = copyArray(this.currentImage.tags)
                    this.editImage.links = []
                    for(let i in this.currentImage.links) {
                        this.editImage.links[i] = {name: this.currentImage.links[i]}
                    }
                }
            },
            switchFavorite: function() {
                this.currentImage.favorite = !this.currentImage.favorite
                //save
            },
            deleteItem: function() {
                let successNum = db.engine.deleteImage([this.currentImage.id])
                if(successNum > 0) {
                    db.engine.save()
                    if(this.showList.length > 1) {
                        this.showList.splice(this.showIndex, 1)
                        this.loadCurrentAs(this.showIndex >= this.showList.length ? this.showList.length - 1 : this.showIndex)
                        this.clickThumbnail()
                    }
                }
            },

            removeLink: function(index) {
                let links = this.editImage.links
                if(index < links.length) {
                    links.splice(index, 1)
                }
            },
            addNewLink: function() {
                this.$set(this.editImage.links, this.editImage.links.length, {name: ''})
            },
            addNewTag: function () {
                let newTag = this.editImage.newTagType + this.editImage.newTag
                if(!containsElement(newTag, this.editImage.tags)) {
                    this.$set(this.editImage.tags, this.editImage.tags.length, newTag)
                    if(!containsElement(newTag, this.existTags)) {
                        this.$set(this.existTags, this.existTags.length, newTag)
                    }
                }
                this.editImage.newTag = ''
            },
            addOldTag: function(tag) {
                if(!containsElement(tag, this.editImage.tags)) {
                    this.$set(this.editImage.tags, this.editImage.tags.length, tag)
                }
            },
            removeTag: function(tag) {
                for(let i in this.editImage.tags) {
                    if(this.editImage.tags[i] === tag) {
                        this.editImage.tags.splice(i, 1)
                        break
                    }
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
            calcResolution: function (resolution) {
                if(resolution != null) {
                    return resolution.width + '×' + resolution.height
                }else{
                    return ''
                }
            },
            openLink: function(link) {
                shell.openExternal(link)
            },
            calcDateTime: function(date, fmt) {
                let o = {
                    "M+" : date.getMonth() + 1,
                    "d+" : date.getDate(),
                    "h+" : date.getHours(),
                    "m+" : date.getMinutes(),
                    "s+" : date.getSeconds(),
                    "q+" : Math.floor((date.getMonth() + 3) / 3),
                    "S"  : date.getMilliseconds()
                }
                if(/(y+)/.test(fmt)) {
                    fmt = fmt.replace(RegExp.$1, (date.getFullYear() + "").substr(4 - RegExp.$1.length))
                }
                for(let k in o) {
                    if(new RegExp("("+ k +")").test(fmt)){
                        fmt = fmt.replace(RegExp.$1, (RegExp.$1.length === 1) ? (o[k]) : (("00" + o[k]).substr(("" + o[k]).length)))
                    }
                }
                return fmt
            },

            setTouchBar: function () {
                if(db.platform.platform !== 'darwin') return;
                touchBar = buildTouchBar(this)
                vueModel.setTouchBar(touchBar.touchBar)
            }
        }
    })

    $(document).keydown(function (e) {
        if(vm.visible) {
            if(!vm.showInfo && e.keyCode === 37) {  //arrow left
                vm.prevPage()
            }else if(!vm.showInfo && e.keyCode === 39) {    //arrow right
                vm.nextPage()
            }else if(e.keyCode === 27) {     //esc
                vm.goBack()
            }
        }
    })

    return vm
}

module.exports = detailModel
