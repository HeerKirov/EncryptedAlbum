import {CommonModel} from "./model"
import {Illustration, Image, ImageSpecification} from "../common/engine"
import {PixivClient, PixivIllust} from "../common/pixiv"
import {Illustrations, Images, Tags} from "../util/model"
import {Arrays, Sets} from "../util/collection"
import {Paths, Strings} from "../util/string"
import {ProcessManager} from '../util/processor'
import {downloadImageBuffer, PREFIX} from "../util/nativeImage"
import {readFile} from 'fs'
import {nativeImage, remote} from 'electron'

const {dialog, TouchBar} = remote
const {TouchBarButton, TouchBarSpacer} = TouchBar
const Vue = require('vue/dist/vue')
const $ = window['$']

class EditProcessor extends ProcessManager {
    constructor(private vm) {
        super()
    }
    setVueData(data: {title?: string, text?: string, percent?: number}): void {
        if(data.title) this.vm.processor.title = data.title
        if(data.text) this.vm.processor.text = data.text
        if(data.percent) this.vm.processor.percent = data.percent
    }
    setVisible(visible: boolean): void {
        this.vm.processor.visible = visible
    }
}

function editModel(vueModel: CommonModel) {
    let db = vueModel.db
    let newImageCount = 0
    let newImageData = {}
    let deletedIllusts = []

    let vm = new Vue({
        el: '#editView',
        data: {
            visible: false,
            fullscreen: false,

            illusts: [],
            current: {
                index: null,
                illust: null,
                imageURLs: [],
                input: {
                    newLink: '',
                    navigateIndex: null
                }
            },

            tagEditor: {
                tags: null,     //正在编辑的标签列

                tagName: '',    //添加器中填写的标签名
                tagTypeIndex: 0,    //添加器选择的标签类型的索引值
                tagType: '',   //添加器选择的标签类型
                tagTypeBackground: '',  //选择的标签类型的背景色
                tagTypeFontColor: '',   //选择的标签类型的前景色

                allTagList: [], //全部标签的列表
                typeList: []    //所有标签类型的列表
            },
            urlEditor: {
                urls: [],
                input: '',
                saveEachImage: false,
                type: null
            },
            localEditor: {
                paths: [],  //二级结构
                type: 'group'   //添加新path时的分组模式[group: 每次一组, each: 每个path一组, all: 所有path放进一个组]
            },
            pixivEditor: {
                paths: [],
                input: '',
                configure: false
            },
            processor: {
                title: null,
                text: null,
                percent: 0,
                visible: false
            }
        },
        computed: {
            isNoTitleBar() {
                return db.platform.platform !== 'darwin' || this.fullscreen
            },
            isEmptyList() {
                return this.illusts.length <= 0
            },
            isEmptyCurrent() {
                return !this.current.illust
            },
            isMultiplyIllust() {
                return this.illusts.length > 1
            },
            isSingleImageStyle() {
                return this.current.illust && this.current.illust.images && this.current.illust.images.length === 1
            }
        },
        watch: {
            'tagEditor.tagTypeIndex': function (val: number) {
                if(val >= 0 && val < this.tagEditor.typeList.length) {
                    this.tagEditor.tagType = this.tagEditor.typeList[val].key
                    this.tagEditor.tagTypeBackground = this.tagEditor.typeList[val].background
                    this.tagEditor.tagTypeFontColor = this.tagEditor.typeList[val].fontcolor
                }
            }
        },
        methods: {
            //事件
            load(option?: any, refresh?: boolean) {
                db.ui.theme = 'gray'
                this.visible = true
                if(db.ui.fullscreen) {this.enterFullScreen()} else {this.leaveFullScreen()}
                this.pixivEditor.configure = db.engine.getConfig('pixiv')
                if(refresh) {
                    this.tagEditor.typeList = db.engine.getConfig('tag-type')
                    if(this.tagEditor.typeList.length > 0) {
                        this.tagEditor.tagTypeIndex = 0
                        this.tagEditor.tagType = this.tagEditor.typeList[0].key
                        this.tagEditor.tagTypeBackground = this.tagEditor.typeList[0].background
                        this.tagEditor.tagTypeFontColor = this.tagEditor.typeList[0].fontcolor
                    }
                    this.tagEditor.allTagList = db.engine.findTag({order: ['type', 'title']})
                }
                if(option && typeof option === 'object') {
                    let illustIds: number[] = option
                    if(illustIds.length > 0) {
                        Arrays.join(this.illusts, db.engine.findIllustration({id__in: illustIds}))
                        this.turnTo(0)
                    }
                }
            },
            leave() {
                this.visible = false
                this.tagEditor.tags = null
            },
            enterFullScreen() {
                this.fullscreen = true
            },
            leaveFullScreen() {
                this.fullscreen = false
            },
            //导航控制
            goBack() {
                //后退会撤销所有的改动。
                this.illusts = []
                this.current.index = null
                this.current.illust = null
                this.current.imageURLs = []
                newImageData = {}
                deletedIllusts = []

                vueModel.routeBack()
            },
            gotoSettingPixiv() {
                vueModel.route('setting', 'pixiv')
            },
            submit() {
                if(this.illusts.length > 0 || deletedIllusts.length > 0) {
                    //TODO 提交时，干掉single image的sub信息。
                    processor.submitTask({title: '保存中'}, function (
                        isRunning: () => boolean,
                        setText: (text: string) => void,
                        setMaxProgress: (max: number) => void,
                        getMaxProgress: () => number,
                        addCurrentProgress: (current: number) => void,
                        finishTask: () => void) {

                        let timestamp = new Date().getTime()
                        let idReflect = {}

                        setText('正在保存数据')
                        for(let illust of vm.illusts) {
                            if(illust.createTime == null) illust.createTime = timestamp
                            for(let image of illust.images) {
                                if(image.createTime == null) image.createTime = timestamp
                            }
                        }
                        setMaxProgress(1 + newImageCount)
                        db.engine.createOrUpdateIllustration(vm.illusts, idReflect)
                        if(deletedIllusts.length > 0) {
                            db.engine.deleteIllustration(deletedIllusts)
                        }

                        addCurrentProgress(1)

                        if(newImageCount > 0) {
                            let leave = newImageCount
                            setText('正在保存新图像')
                            for(let virtualId in newImageData) {
                                let realId = idReflect[virtualId]
                                if(realId != undefined) {
                                    db.engine.saveImageURL(realId, newImageData[virtualId], () => {
                                        addCurrentProgress(1)
                                        if(--leave <= 0) {
                                            finish()
                                        }
                                    })
                                }
                            }
                        }else{
                            finish()
                        }
                        function finish() {
                            db.engine.save()
                            finishTask()

                            newImageData = {}
                            vm.illusts = []
                            vm.current.index = null
                            vm.current.illust = null
                            vm.current.imageURLs = []
                            deletedIllusts = []
                            vueModel.routeBack(true)
                        }
                    })
                }
            },
            //Illust切换
            turnToInput() {
                let goal
                try {
                    goal = parseInt(this.current.input.navigateIndex)
                }catch (e) {
                    goal = null
                }
                if(goal != null) {
                    goal -= 1
                    if(goal < 0) goal = 0
                    else if(goal >= this.illusts.length) goal = this.illusts.length - 1
                    this.turnTo(goal)
                }
            },
            turnToArrow(position: 'first' | 'prev' | 'next' | 'last') {
                switch (position) {
                    case 'first':
                        this.turnTo(0)
                        break
                    case 'prev':
                        this.turnTo(this.current.index > 0 ? this.current.index - 1 : 0)
                        break
                    case 'next':
                        this.turnTo(this.current.index < this.illusts.length - 1 ? this.current.index + 1 : this.illusts.length - 1)
                        break
                    case 'last':
                        this.turnTo(this.illusts.length > 0 ? this.illusts.length - 1 : 0)
                        break
                }  
            },
            //主要功能
            newIllust(location: string = 'empty') {
                let illusts: Illustration[] = []
                if(location === 'empty') {
                    Arrays.append(illusts, Illustrations.empty())
                }else if(location === 'local') {
                    if(Arrays.isNotEmpty(this.localEditor.paths)) {
                        processor.submitTask({title: '读取本地文件'}, function (isRunning: () => boolean,
                              setText: (text: string) => void,
                              setMaxProgress: (max: number) => void,
                              getMaxProgress: () => number,
                              addCurrentProgress: (current: number) => void,
                              toFinish: () => void) {
                            let cnt = 0
                            for(let group of vm.localEditor.paths) {
                                cnt += group.length
                            }
                            setMaxProgress(cnt)
                            let lastIllustMax = vm.illusts.length
                            for(let group of vm.localEditor.paths) {
                                if(!isRunning()) break
                                if(group.length <= 0) continue
                                let illust: Illustration = {
                                    id: undefined,
                                    title: '',
                                    tags: [],
                                    favorite: false,
                                    links: [],
                                    createTime: undefined,
                                    images: []
                                }
                                let index = 0
                                for(let path of group) {
                                    readFile(path, function(e, buf) {
                                        let imageFlagId = -(++newImageCount)
                                        let image = nativeImage.createFromBuffer(buf)
                                        let imageModel: Image = {
                                            id: imageFlagId,    //使用负数标记暂存的image data
                                            index: index++, //实际相当于next index
                                            subTitle: null,
                                            subFavorite: null,
                                            subTags: [],
                                            createTime: undefined,
                                            resolution: image.getSize()
                                        }
                                        Arrays.append(illust.images, imageModel)
                                        newImageData[imageFlagId] = PREFIX + buf.toString('base64')
                                        addCurrentProgress(1)
                                        if(--cnt <= 0) {
                                            toFinish()
                                            finish()
                                        }
                                    })
                                }
                                vm.$set(vm.illusts, vm.illusts.length, illust)
                            }
                            function finish() {
                                vm.localEditor.paths = []
                                vm.turnTo(lastIllustMax)
                            }
                        })
                    }
                }else if(location === 'url') {
                    if(Arrays.isNotEmpty(this.urlEditor.urls)) {
                        processor.submitTask({title: '下载网络文件'}, function (isRunning: () => boolean,
                              setText: (text: string) => void,
                              setMaxProgress: (max: number) => void,
                              getMaxProgress: () => number,
                              addCurrentProgress: (current: number) => void,
                              toFinish: () => void) {
                            let lastIllustMax = vm.illusts.length
                            let cnt = vm.urlEditor.urls.length
                            setMaxProgress(cnt)
                            if(vm.urlEditor.saveEachImage) {
                                for(let url of vm.urlEditor.urls) {
                                    downloadImageBuffer({url: url, proxy: db.engine.getConfig('proxy')}, (buffer, status) => {
                                        if(isRunning() && buffer) {
                                            let imageFlagId = -(++newImageCount)
                                            let image = nativeImage.createFromBuffer(buffer)
                                            let imageModel: Image = {
                                                id: imageFlagId,
                                                index: 0,
                                                subTitle: null,
                                                subFavorite: null,
                                                subTags: [],
                                                createTime: undefined,
                                                resolution: image.getSize()
                                            }
                                            newImageData[imageFlagId] = PREFIX + buffer.toString('base64')
                                            let eachIllust: Illustration = {
                                                id: undefined,
                                                title: '',
                                                favorite: false,
                                                tags: [],
                                                links: [],
                                                createTime: undefined,
                                                images: [imageModel]
                                            }
                                            vm.$set(vm.illusts, vm.illusts.length, eachIllust)
                                            addCurrentProgress(1)
                                            if(--cnt <= 0) {
                                                toFinish()
                                                finish()
                                            }
                                        }
                                    })
                                }
                            }else{
                                let index = 0
                                let illust: Illustration = {
                                    id: undefined,
                                    title: '',
                                    favorite: false,
                                    tags: [],
                                    links: [],
                                    createTime: undefined,
                                    images: []
                                }
                                vm.$set(vm.illusts, vm.illusts.length, illust)
                                for(let url of vm.urlEditor.urls) {
                                    downloadImageBuffer({url: url, proxy: db.engine.getConfig('proxy')}, (buffer, status) => {
                                        if(isRunning() && buffer) {
                                            let imageFlagId = -(++newImageCount)
                                            let image = nativeImage.createFromBuffer(buffer)
                                            let imageModel: Image = {
                                                id: imageFlagId,
                                                index: index++,
                                                subTitle: null,
                                                subFavorite: null,
                                                subTags: [],
                                                createTime: undefined,
                                                resolution: image.getSize()
                                            }
                                            newImageData[imageFlagId] = PREFIX + buffer.toString('base64')
                                            Arrays.append(illust.images, imageModel)
                                            addCurrentProgress(1)
                                            if(--cnt <= 0) {
                                                toFinish()
                                                finish()
                                            }
                                        }
                                    })
                                }
                            }
                            function finish() {
                                vm.urlEditor.urls = []
                                vm.turnTo(lastIllustMax)
                            }
                        })
                    }
                }else if(location === 'pixiv') {
                    if(Arrays.isNotEmpty(this.pixivEditor.paths)) {
                        if(!this.pixivEditor.configure) {
                            alert('pixiv账户信息未配置。')
                        }else{
                            processor.submitTask({title: '解析pixiv项目', autoFinish: true}, function (isRunning: () => boolean,
                                  setText: (text: string) => void,
                                  setMaxProgress: (max: number) => void,
                                  getMaxProgress: () => number,
                                  addCurrentProgress: (current: number) => void,
                                  toFinish: () => void) {
                                let client = new PixivClient()
                                let proxy = db.engine.getConfig('proxy')
                                if(proxy) client.setProxy(proxy)
                                setMaxProgress(2 + 2 * vm.pixivEditor.paths.length)
                                addCurrentProgress(1)
                                setText('尝试登录pixiv……')
                                client.login(vm.pixivEditor.configure.username, vm.pixivEditor.configure.password, (b) => {
                                    if(!isRunning()) return
                                    else if(!b) {
                                        toFinish()
                                        alert('pixiv账户登录失败。请检查用户名、密码或网络连接。')
                                    }else{
                                        console.debug(`[pixiv]login success.`)
                                        addCurrentProgress(1)
                                        setText('正在下载并分析项目……')
                                        let lastIllustMax = vm.illusts.length
                                        for(let pid of vm.pixivEditor.paths) {
                                            let info: PixivIllust = null
                                            let buffers = []
                                            client.loadIllust(pid, (illust) => {
                                                if(!isRunning()) return
                                                if(illust) {
                                                    console.debug(`[pixiv][${illust.pid}]illust download success.`)
                                                    info = illust
                                                    setText(`[${illust.pid}]项目解析完成……`)
                                                    addCurrentProgress(1)
                                                }else{
                                                    alert(`项目[${pid}]无法被正确识别或解析。`)
                                                    addCurrentProgress(2)
                                                }
                                            }, (id, buffer) => {
                                                if(!isRunning()) return
                                                setText('图像下载中……')
                                                if(id >= 0 && buffer) {
                                                    console.debug(`[pixiv][${info ? info.pid : '?'}]image ${id} download success.`)
                                                    buffers[id] = buffer
                                                }else if(id == -1) {
                                                    console.debug(`[pixiv][${info ? info.pid : '?'}]all images download success.`)
                                                    if(createResults(info, buffers)) {
                                                        addCurrentProgress(1)
                                                        finish()
                                                    }
                                                }else{
                                                    alert(`[Pixiv]有图像下载失败。`)
                                                }
                                            })
                                        }
                                        function createResults(info: PixivIllust, buffers: Buffer[]): boolean {
                                            if(!isRunning()) return false
                                            let tags: string[] = [] //TODO 处理tags
                                            let illust: Illustration = {
                                                id: undefined,
                                                title: info.title,
                                                tags: tags,
                                                favorite: false,
                                                links: [info.webLink],
                                                createTime: undefined,
                                                images: []
                                            }
                                            let index = 0
                                            for(let buffer of buffers) {
                                                if(!buffer) continue
                                                let imageFlagId = -(++newImageCount)
                                                let native = nativeImage.createFromBuffer(buffer)
                                                let imageModel: Image = {
                                                    id: imageFlagId,    //使用负数标记暂存的image data
                                                    index: index++, //实际相当于next index
                                                    subTitle: null,
                                                    subFavorite: null,
                                                    subTags: [],
                                                    createTime: undefined,
                                                    resolution: native.getSize()
                                                }
                                                Arrays.append(illust.images, imageModel)
                                                newImageData[imageFlagId] = PREFIX + buffer.toString('base64')
                                            }
                                            vm.$set(vm.illusts, vm.illusts.length, illust)
                                            return true
                                        }
                                        function finish() {
                                            if(!isRunning()) {
                                                vm.pixivEditor.paths = []
                                                vm.turnTo(lastIllustMax)
                                            }
                                        }
                                    }
                                })
                            })
                        }
                    }
                }
                if(Arrays.isNotEmpty(illusts)) {
                    let lastLength = this.illusts.length
                    for(let i = 0, first = this.illusts.length; i < illusts.length; ++i) {
                        vm.$set(this.illusts, first + i, illusts[i])
                    }
                    this.turnTo(lastLength)
                }
            },
            turnTo(index: number) {
                if(index == null) {
                    this.current.index = null
                    this.current.input.navigateIndex = null
                    this.current.illust = null
                    this.current.imageURLs = []
                }else if(index >= 0 && index < this.illusts.length) {
                    this.current.index = index
                    this.current.input.navigateIndex = index + 1
                    this.current.illust = this.illusts[index]
                    this.current.imageURLs = []
                    for(let i in this.current.illust.images) {
                        let image = this.current.illust.images[i]
                        if(image) {
                            if(image.id > 0) {
                                //TODO 加载现有的dataURL时逻辑有问题。第一次执行会触发加载但加载不进去，第二次则会因为已加载立刻加载上去。
                                db.engine.loadImageURL(image.id, ImageSpecification.Origin, (dataURL) => {
                                    this.current.imageURLs[i] = dataURL
                                })
                            }else if(image.id < 0) {
                                this.current.imageURLs[i] = newImageData[image.id]
                            }
                        }
                    }
                }else{
                    console.warn(`try turning to page ${index} which is not exist.`)
                }
            },
            newImage(location: string) {
                if(location === 'local') {
                    dialog.showOpenDialog(db.currentWindow, {
                        title: '选择本地文件',
                        properties: ['openFile', 'multiSelections'],
                        filters: [
                            {name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'bmp']},
                            {name: 'All', extensions: ['*']}
                        ]
                    }, (paths: string[]) => {
                        if(paths) {
                            processor.submitTask({
                                title: '读取本地文件',
                                autoFinish: true
                            }, function (isRunning: () => boolean,
                                         setText: (text: string) => void,
                                         setMaxProgress: (max: number) => void,
                                         getMaxProgress: () => number,
                                         addCurrentProgress: (current: number) => void) {
                                setMaxProgress(paths.length)
                                let index = vm.current.illust.images.length
                                for(let path of paths) {
                                    if(!isRunning()) break
                                    readFile(path, function(e, buf) {
                                        let imageFlagId = -(++newImageCount)
                                        let image = nativeImage.createFromBuffer(buf)
                                        let imageModel: Image = {
                                            id: imageFlagId,    //使用负数标记暂存的image data
                                            index: index++, //实际相当于next index
                                            subTitle: null,
                                            subFavorite: null,
                                            subTags: [],
                                            createTime: undefined,
                                            resolution: image.getSize()
                                        }
                                        vm.$set(vm.current.illust.images, vm.current.illust.images.length, imageModel)
                                        newImageData[imageFlagId] = PREFIX + buf.toString('base64')
                                        vm.$set(vm.current.imageURLs, vm.current.imageURLs.length, newImageData[imageFlagId])
                                        addCurrentProgress(1)
                                    })
                                }
                            })
                        }
                    })
                }
                else if(location === 'url') {
                    if(this.urlEditor.urls.length > 0) {
                        processor.submitTask({title: '下载网络文件'}, function (isRunning: () => boolean,
                                     setText: (text: string) => void,
                                     setMaxProgress: (max: number) => void,
                                     getMaxProgress: () => number,
                                     addCurrentProgress: (current: number) => void,
                                     toFinish: () => void) {
                            let cnt = vm.urlEditor.urls.length
                            setMaxProgress(vm.urlEditor.urls.length)
                            let index = vm.current.illust.images.length
                            for(let url of vm.urlEditor.urls) {
                                downloadImageBuffer({url: url, proxy: db.engine.getConfig('proxy')}, (buffer, status) => {
                                    if(isRunning() && buffer) {
                                        let imageFlagId = -(++newImageCount)
                                        let image = nativeImage.createFromBuffer(buffer)
                                        let imageModel: Image = {
                                            id: imageFlagId,
                                            index: index++,
                                            subTitle: null,
                                            subFavorite: null,
                                            subTags: [],
                                            createTime: undefined,
                                            resolution: image.getSize()
                                        }
                                        vm.$set(vm.current.illust.images, vm.current.illust.images.length, imageModel)
                                        newImageData[imageFlagId] = PREFIX + buffer.toString('base64')
                                        vm.$set(vm.current.imageURLs, vm.current.imageURLs.length, newImageData[imageFlagId])
                                        addCurrentProgress(1)
                                        if(--cnt <= 0) {
                                            toFinish()
                                            finish()
                                        }
                                    }
                                })
                            }
                            function finish() {
                                vm.urlEditor.urls = []
                            }
                        })
                    }
                }
            },
            removeIllust() {
                if(this.current.index >= 0 && this.current.index < this.illusts.length) {
                    if(this.current.illust.id > 0) {
                        Arrays.append(deletedIllusts, this.current.illust.id)
                    }
                    Arrays.removeAt(this.illusts, this.current.index)
                    if(this.illusts.length === 0) {
                        this.turnTo(null)
                    }else if(this.current.index >= this.illusts.length) {
                        this.turnTo(this.illusts.length - 1)
                    }else{
                        this.turnTo(this.current.index)
                    }
                }
            },
            //编辑区
            addNewLink() {
                if(this.current.illust && this.current.input.newLink) {
                    Arrays.append(this.current.illust.links, this.current.input.newLink)
                    this.current.input.newLink = ''
                }
            },
            removeLink(index: number) {
                if(this.current.illust) {
                    Arrays.removeAt(this.current.illust.links, index)
                }
            },

            orderImage(imageIndex: number, position: 'first' | 'last' | 'prev' | 'next') {
                if(this.current.illust && imageIndex >= 0 && imageIndex < this.current.illust.images.length) {
                    let image = Arrays.popAt(this.current.illust.images, imageIndex)
                    let imageDataURL = Arrays.popAt(this.current.imageURLs, imageIndex)
                    let goalIndex = position === 'first' ? 0 :
                                    position === 'last' ? this.current.illust.images.length :
                                    position === 'prev' ? (imageIndex > 0 ? imageIndex - 1 : 0) :
                                        (imageIndex < this.current.illust.images.length ? imageIndex + 1 : this.current.illust.images.length)
                    Arrays.insert(this.current.illust.images, goalIndex, image)
                    Arrays.insert(this.current.imageURLs, goalIndex, imageDataURL)
                    for(let i = 0; i < this.current.illust.images.length; ++i) {
                        this.current.illust.images[i].index = i
                    }
                }
            },
            moveImage(imageIndex: number, position: 'prev' | 'next' | 'prev-new' | 'next-new') {
                if(this.current.illust && imageIndex >= 0 && imageIndex < this.current.illust.images.length) {
                    if(position === 'prev' && this.current.index <= 0) position = 'prev-new'
                    else if(position === 'next' && this.current.index >= this.illusts.length - 1) position = 'next-new'

                    let image: Image = Arrays.popAt(this.current.illust.images, imageIndex)
                    Arrays.removeAt(this.current.imageURLs, imageIndex)
                    for(let i = 0; i < this.current.illust.images.length; ++i) {
                        this.current.illust.images[i].index = i
                    }

                    let goalIllust: Illustration
                    if(position === 'prev') {
                        goalIllust = this.illusts[this.current.index - 1]
                    }else if(position === 'next') {
                        goalIllust = this.illusts[this.current.index + 1]
                    }else if(position === 'prev-new') {
                        goalIllust = Illustrations.empty()
                        Arrays.insert(this.illusts, this.current.index, goalIllust)
                        this.turnTo(this.current.index + 1)
                    }else if(position === 'next-new') {
                        goalIllust = Illustrations.empty()
                        Arrays.insert(this.illusts, this.current.index + 1, goalIllust)
                    }
                    image.index = goalIllust.images.length
                    Arrays.append(goalIllust.images, image)
                }
            },
            removeImage(imageIndex: number) {
                if(this.current.illust && imageIndex >= 0 && imageIndex < this.current.illust.images.length) {
                    Arrays.removeAt(this.current.illust.images, imageIndex)
                    Arrays.removeAt(this.current.imageURLs, imageIndex)
                    for(let i = 0; i < this.current.illust.images.length; ++i) {
                        this.current.illust.images[i].index = i
                    }
                }
            },
            //TAG编辑面板
            editTag(tags: string[]) {
                if(tags) {
                    this.tagEditor.tags = tags
                    $('#editTagModal')['modal']()
                }
            },
            addNewTagToEditor() {
                this.addTagToEditor(this.tagEditor.tagType, this.tagEditor.tagName)
                this.tagEditor.tagName = ''
            },
            addExistTagToEditor(tag: string) {
                this.addTagToEditor(Tags.getTagType(tag), Tags.getTagName(tag))
            },
            addTagToEditor(tagType: string, tagName: string) {
                if(Strings.isNotBlank(tagName) && tagType) {
                    let tag = Tags.tag(tagType, tagName.trim())
                    if(this.tagEditor.tags && !Arrays.contains(this.tagEditor.tags, tag)) {
                        vm.$set(this.tagEditor.tags, this.tagEditor.tags.length, tag)
                        if(!Sets.contains(this.tagEditor.allTagList, tag)) {
                            Sets.put(this.tagEditor.allTagList, tag)
                        }
                    }
                }
            },
            removeTagFromEditor(index: number) {
                Arrays.removeAt(this.tagEditor.tags, index)
            },
            changeTagTypeInEditor(index: number) {
                if(this.tagEditor.tags && index >= 0 && index < this.tagEditor.tags.length) {
                    let tag = this.tagEditor.tags[index]
                    let tagType = Tags.getTagType(tag), tagName = Tags.getTagName(tag);
                    let tagTypeList = this.tagEditor.typeList
                    let goal = null
                    for(let i = 0; i < tagTypeList.length; ++i) {
                        let {key} = tagTypeList[i]
                        if(key === tagType) {
                            goal = i >= tagTypeList.length - 1 ? 0 : i + 1
                            break
                        }
                    }
                    if(goal != null) {
                        this.$set(this.tagEditor.tags, index, Tags.tag(tagTypeList[goal].key, tagName))
                    }
                }
            },
            //URL编辑面板
            openURLPanel(type: 'illust' | 'image') {
                this.urlEditor.type = type
                this.urlEditor.input = ''
                $('#urlModal')['modal']()
            },
            submitURLPanel() {
                if(Strings.isNotBlank(this.urlEditor.input)) {
                    this.addURL()
                }
                if(this.urlEditor.type === 'illust') {
                    this.newIllust('url')
                }else{  //image
                    this.newImage('url')
                }
            },
            addURL() {
                if(this.urlEditor.input) {
                    vm.$set(this.urlEditor.urls, this.urlEditor.urls.length, this.urlEditor.input)
                    this.urlEditor.input = ''
                }
            },
            removeURL(index: number) {
                if(index >= 0 && index < this.urlEditor.urls.length) {
                    Arrays.removeAt(this.urlEditor.urls, index)
                }
            },
            //local illust编辑面板
            openLocalPanel() {
                $('#localModal')['modal']()
            },
            submitLocalPanel() {
                this.newIllust('local')
            },
            addLocalPath() {
                dialog.showOpenDialog(db.currentWindow, {
                        title: '选择本地文件',
                        properties: ['openFile', 'multiSelections'],
                        filters: [
                            {name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'bmp']},
                            {name: 'All', extensions: ['*']}
                        ]
                    }, (paths: string[]) => {
                        if(Arrays.isNotEmpty(paths)) {
                            if(this.localEditor.type === 'group') {
                                vm.$set(this.localEditor.paths, this.localEditor.paths.length, paths)
                            }else if(this.localEditor.type === 'each') {
                                for(let path of paths) {
                                    vm.$set(this.localEditor.paths, this.localEditor.paths.length, [path])
                                }
                            }else{//all
                                if(this.localEditor.paths.length > 0) {
                                    let last = this.localEditor.paths[this.localEditor.paths.length - 1]
                                    for(let path of paths) {
                                        vm.$set(last, last.length, path)
                                    }
                                }else{
                                    vm.$set(this.localEditor.paths, 0, paths)
                                }
                            }
                        }
                    })
            },
            removeLocalPath(groupIndex: number, itemIndex?: number) {
                if(itemIndex != undefined) {
                    let group = this.localEditor.paths[groupIndex]
                    Arrays.removeAt(group, itemIndex)
                    if(Arrays.isEmpty(group)) {
                        Arrays.removeAt(this.localEditor.paths, groupIndex)
                    }
                }else{
                    Arrays.removeAt(this.localEditor.paths, groupIndex)
                }
            },
            //pixiv编辑面板
            openPixivPanel() {
                $('#pixivModal')['modal']()
            },
            submitPixivPanel() {
                if(Strings.isNotBlank(this.pixivEditor.input)) {
                    this.addPixivPath()
                }
                this.newIllust('pixiv')
            },
            addPixivPath() {
                if(this.pixivEditor.input) {
                    vm.$set(this.pixivEditor.paths, this.pixivEditor.paths.length, this.pixivEditor.input)
                    this.pixivEditor.input = ''
                }
            },
            removePixivPath(index: number) {
                Arrays.removeAt(this.pixivEditor.paths, index)
            },

            //Processor相关函数
            cancelProcessor() {
                if(this.processor.visible) {
                    processor.cancelTask()
                }
            },

            //工具函数
            getTagName(tag: string): string {
                return Tags.getTagName(tag)
            },
            getTagColor(tag: string): {background: string, color: string} {
                let tagType = Tags.getTagType(tag)
                //TODO 更改存储结构，优化查询效率
                for(let type of this.tagEditor.typeList) {
                    if(type.key === tagType) {
                        return {
                            background: type.background,
                            color: type.fontcolor
                        }
                    }
                }
                return {background: '', color: ''}
            },
            canTurnToAccess(position: 'first' | 'prev' | 'next' | 'last') {
                switch (position) {
                    case 'first':
                        return this.current.index > 0
                    case 'prev':
                        return this.current.index > 0
                    case 'next':
                        return this.current.index < this.illusts.length - 1
                    case 'last':
                        return this.current.index < this.illusts.length - 1
                }
            }
        }
    })

    let processor = new EditProcessor(vm)

    return vm
}

module.exports = editModel