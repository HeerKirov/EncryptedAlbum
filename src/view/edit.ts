import {CommonModel} from "./model"
import {Illustration, Image, ImageSpecification} from "../common/engine"
import {Illustrations, Images, Tags} from "../util/model"
import {Arrays, Sets} from "../util/collection"
import {Paths, Strings} from "../util/string"
import {ProcessManager} from '../util/processor'
import {PREFIX} from "../util/nativeImage"
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
            deletedIllusts: [],

            tagEditor: {
                tags: null,

                tagName: '',
                tagType: 'a',
                allTagList: []
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
            },
            tagTypeList() {
                //TODO 完成tag type列表。该列表要从config中取得。
                return [
                    {name: '内容', key: 'a'},
                    {name: '题材', key: 'b'},
                    {name: '作者', key: 'c'}
                ]
            }
        },
        methods: {
            //事件
            load(option?: any, refresh?: boolean) {
                db.ui.theme = 'gray'
                this.visible = true
                if(db.ui.fullscreen) {this.enterFullScreen()} else {this.leaveFullScreen()}
                //TODO 添加编辑已存在项目的功能。
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
                vueModel.routeBack()
                //后退会撤销所有的改动。
                this.illusts = []
                this.current.index = null
                this.current.illust = null
                this.current.imageURLs = []
                newImageData = {}
                this.deletedIllusts = []
            },
            submit() {
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
                        vm.goBack()
                    }
                })
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

                }else if(location === 'url') {

                }else if(location === 'pixiv') {

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
                                for(let path of paths) {
                                    if(!isRunning()) break
                                    readFile(path, function(e, buf) {
                                        let imageFlagId = -(++newImageCount)
                                        let image = nativeImage.createFromBuffer(buf)
                                        let imageModel: Image = {
                                            id: imageFlagId,    //使用负数标记暂存的image data
                                            index: vm.current.illust.images.length, //实际相当于next index
                                            subTitle: Paths.getFileTitle(path),
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
                }else if(location === 'url') {

                }
            },
            removeIllust() {
                if(this.current.index >= 0 && this.current.index < this.illusts.length) {
                    if(this.current.illust.id > 0) {
                        Arrays.append(this.deletedIllusts, this.current.illust.id)
                    }
                    Arrays.removeAt(this.illusts, this.current.index)
                    if(this.current.index >= this.illusts.length) {
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
            addTagToEditor(tagType: string, tagName: string) {
                if(Strings.isNotBlank(tagName) && tagType) {
                    let tag = Tags.tag(tagType, tagName.trim())
                    if(this.tagEditor.tags && !Arrays.contains(this.tagEditor.tags, tag)) {
                        Arrays.append(this.tagEditor.tags, tag)
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
                    let tagTypeList = this.tagTypeList
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