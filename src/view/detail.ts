import {remote, shell} from 'electron'
import {CommonModel} from "./model"
import {Illustration, Image, ImageSpecification, Scale} from "../common/engine"
import {Arrays} from "../util/collection"
import {Strings} from "../util/string"
import {Tags} from "../util/model"
import {exportImage} from "../util/nativeImage";
import Timer = NodeJS.Timer;

const {TouchBar, dialog} = remote
const {TouchBarButton, TouchBarSpacer, TouchBarSegmentedControl, TouchBarSlider, TouchBarPopover} = TouchBar
const Vue = require('vue/dist/vue')
const $ = window['$']

const PLAY_ITEMS = [
    {title: '停止', value: null},
    {title: '1秒', value: 1},
    {title: '2秒', value: 2},
    {title: '3秒', value: 3},
    {title: '5秒', value: 5},
    {title: '8秒', value: 8},
    {title: '15秒', value: 15},
    {title: '30秒', value: 30},
    {title: '1分钟', value: 60}
]

function detailModel(vueModel: CommonModel) {
    let db = vueModel.db

    let loadStructure: {scales: Scale[], selectIllustId: number, selectImageIndex?: number} = null
    let changedFlag: boolean = false

    let timer: Timer = null
    let timerRandomList: {illustIndex: number, imageIndex: number}[] = null
    let timerRandomItem: number = null
    function timerPlay() {
        if(vm.timer.random) {
            if(timerRandomList == null) createRandomTimerList()
            if(timerRandomItem == null || timerRandomItem >= timerRandomList.length) timerRandomItem = 0
            let item = timerRandomList[timerRandomItem++]
            vm.select(item.illustIndex, item.imageIndex)
        }else{
            vm.arrow('image', 'next')
        }
    }
    function createRandomTimerList() {
        let items: {illustIndex: number, imageIndex: number}[] = []
        for(let illustIndex = 0; illustIndex < vm.data.illusts.length; ++illustIndex) {
            let illust: Illustration = vm.data.illusts[illustIndex]
            for(let imageIndex = 0; imageIndex < illust.images.length; ++imageIndex) {
                Arrays.append(items, {illustIndex, imageIndex})
            }
        }
        let ret: {illustIndex: number, imageIndex: number}[] = []
        while(items.length > 0) {
            let next = Math.floor(Math.random() * items.length)
            Arrays.append(ret, Arrays.popAt(items, next))
        }
        timerRandomList = ret
    }

    let touchBar = null
    function generateTouchBar() {
        let zoomAbsolute = new TouchBarSegmentedControl({
            segments: [
                {label: '绝对值'},
                {label: '自适应'}
            ],
            selectedIndex: vm.zoom.absolute ? 0 : 1,
            change: selectedIndex => {
                vm.zoom.absolute = selectedIndex === 0
            }
        })
        let zoomValue = new TouchBarSlider({
            label: '缩放',
            minValue: 0, maxValue: 100, value: vm.zoom.value,
            change: newValue => {
                vm.zoom.value = newValue
            }
        })

        let timerRandom = new TouchBarSegmentedControl({
            segments: [
                {label: '随机'},
                {label: '顺序'}
            ],
            selectedIndex: vm.timer.random ? 0 : 1,
            change: selectedIndex => {
                vm.timer.random = selectedIndex === 0
            }
        })
        let timerItem = new TouchBarSlider({
            label: '定时',
            minValue: 0, maxValue: PLAY_ITEMS.length - 1, value: vm.timer.item,
            change: newValue => {
                vm.timer.item = newValue
            }
        })

        let touchBar = new TouchBar({
            items: [
                new TouchBarSpacer({size: 'flexible'}),
                new TouchBarPopover({
                    label: '轮播',
                    items: new TouchBar({
                        items: [
                            new TouchBarSpacer({size: 'flexible'}),
                            timerRandom, timerItem
                        ]
                    })
                }),
                new TouchBarPopover({
                    label: '缩放',
                    items: new TouchBar({
                        items: [
                            new TouchBarSpacer({size: 'flexible'}),
                            zoomAbsolute, zoomValue
                        ]
                    })
                })
            ]
        })
        return {
            touchBar,
            zoomAbsolute, zoomValue,
            timerRandom, timerItem
        }
    }

    let vm = new Vue({
        el: '#detailView',
        data: {
            visible: false,
            fullscreen: false,

            dock: {
                show: true,
                type: 'info',
            },
            tool: {
                show: true
            },

            zoom: {
                absolute: false,
                value: 50
            },
            timer: {
                random: false,
                item: 0
            },

            data: {
                illusts: [],                //全部待展示的illust的列表
                currentIllust: {},
                currentImage: {},
                currentIllustIndex: null,   //正在处理的illust在列表中的index
                currentImageIndex: null,    //正在处理的image在illust中的index
                currentDataURL: null,       //正在展示的image的dataURL
            },
            tag: {
                typeList: []
            }
        },
        computed: {
            noTitleBar() {
                return this.fullscreen || db.platform.platform !== 'darwin'
            },
            isShowFullScreenButton() {
                return db.platform.platform !== 'darwin'
            },
            imageZoomStyle() {
                if(this.zoom.absolute) {
                    let rate = this.zoom.value < 50 ? this.zoom.value / 250 + 0.1
                        : this.zoom.value > 50 ? this.zoom.value / 62.5 - 0.5 : 0.3
                    return {
                        'width': this.data.currentImage.resolution.width * rate + 'px',
                        'height': this.data.currentImage.resolution.height * rate + 'px'
                    }
                }else{
                    return {
                        'max-width': '100%',
                        'max-height': '100%'
                    }
                }
            },
            timerItems() {
                return PLAY_ITEMS
            }
        },
        watch: {
            'timer.item': function (val) {
                if(timer != null) {
                    clearInterval(timer)
                    timer = null
                }
                if(this.timerItems[val].value) timer = setInterval(timerPlay, this.timerItems[val].value * 1000)
                if(touchBar) {
                    touchBar.timerItem.value = parseInt(val)
                }
            },
            'timer.random': function (val) {
                if(val) createRandomTimerList()
                if(touchBar) {
                    touchBar.timerRandom.selectedIndex = val ? 0 : 1
                }
            },
            'zoom.value': function (val) {
                if(touchBar) {
                    touchBar.zoomValue.value = parseInt(val)
                }
            },
            'zoom.absolute': function (val) {
                if(touchBar) {
                    touchBar.zoomAbsolute.selectedIndex = val ? 0 : 1
                }
            }
        },
        methods: {
            //事件
            load(options?: any, refresh?: boolean) {
                /** options数据结构：
                 * {scales: Scale[], selectIllustId: number, selectImageIndex?: number}
                 * scales: 所有待加载对象列表
                 * selectIllustId: 被选择的illust.id，将初始显示
                 * selectImageIndex: 如果有这一项，则指定初始显示的image.index
                 */
                db.ui.theme = 'dark'
                this.visible = true
                if(db.ui.fullscreen) {this.enterFullScreen()} else {this.leaveFullScreen()}
                this.tag.typeList = db.engine.getConfig('tag-type')
                if(options && options.scales) {loadStructure = options}
                if(refresh && loadStructure) {
                    this.data.illusts = db.engine.findIllustrationByScale(loadStructure.scales)
                    let illustIndex = Arrays.indexOf(this.data.illusts, (illust: Illustration) => illust.id === loadStructure.selectIllustId)
                    let imageIndex
                    if(illustIndex >= 0) {
                        let illust: Illustration = this.data.illusts[illustIndex]
                        imageIndex = Arrays.indexOf(illust.images, (image: Image) => image.index === loadStructure.selectImageIndex)
                        if(imageIndex < 0) imageIndex = null
                    }else{
                        imageIndex = null
                    }
                    this.select(illustIndex, imageIndex)
                    if(options == undefined) {
                        changedFlag = true
                    }
                }
                this.setTouchBar()
            },
            leave() {
                if(this.fullscreen && this.isShowFullScreenButton) {
                    db.currentWindow.setFullScreen(false)
                }
                if(this.timer.item > 0) {
                    this.timer.item = 0
                    clearInterval(timer)
                    timer = null
                }
                if(timerRandomList != null) {
                    timerRandomList = null
                    timerRandomItem = null
                }
                this.visible = false
                if(this.data.currentIllustIndex != null && this.data.currentImageIndex != null) {
                    loadStructure.selectIllustId = this.data.illusts[this.data.currentIllustIndex].id
                    loadStructure.selectImageIndex = this.data.illusts[this.data.currentIllustIndex].images[this.data.currentImageIndex]
                }else{
                    loadStructure.selectIllustId = loadStructure.selectImageIndex = null
                }
            },
            enterFullScreen() {
                this.fullscreen = true
            },
            leaveFullScreen() {
                this.fullscreen = false
            },
            switchFullScreen() {
                db.currentWindow.setFullScreen(!db.ui.fullscreen)
            },
            //导航
            goBack() {
                vueModel.routeBack(changedFlag)
                changedFlag = false
            },
            goEdit() {
                vueModel.route('edit', {illustIds: [this.data.currentIllust.id]})
            },
            //跳转控制
            arrow(control: 'image' | 'illust', position: 'next' | 'prev') {
                if(this.data.currentIllustIndex != null && this.data.currentImageIndex != null) {
                    if(control === 'image') {
                        let illust: Illustration = this.data.illusts[this.data.currentIllustIndex]
                        if(position === 'next') {
                            if(this.data.currentImageIndex + 1 < illust.images.length) {
                                this.select(this.data.currentIllustIndex, this.data.currentImageIndex + 1)
                            }else if(this.data.currentIllustIndex + 1 < this.data.illusts.length) {
                                this.select(this.data.currentIllustIndex + 1, 0)
                            }else{
                                this.select(0, 0)
                            }
                        }else{
                            if(this.data.currentImageIndex >= 1) {
                                this.select(this.data.currentIllustIndex, this.data.currentImageIndex - 1)
                            }else if(this.data.currentIllustIndex >= 1) {
                                this.select(this.data.currentIllustIndex - 1, this.data.illusts[this.data.currentIllustIndex - 1].images.length - 1)
                            }else{
                                this.select(this.data.illusts.length - 1, this.data.illusts[this.data.illusts.length - 1].images.length - 1)
                            }
                        }
                    }else{  //illust
                        if(position === 'next') {
                            if(this.data.currentIllustIndex + 1 < this.data.illusts.length) {
                                this.select(this.data.currentIllustIndex + 1, 0)
                            }else{
                                this.select(0, 0)
                            }
                        }else{
                            if(this.data.currentIllustIndex >= 1) {
                                this.select(this.data.currentIllustIndex - 1, 0)
                            }else{
                                this.select(this.data.illusts.length - 1, 0)
                            }
                        }
                    }
                }
            },
            select(illustIndex: number, imageIndex?: number) {
                if(this.data.illusts.length > 0) {
                    this.data.currentIllustIndex = illustIndex < 0 ? 0 :
                           illustIndex >= this.data.illusts.length ? this.data.illusts.length - 1 : illustIndex
                    let illust: Illustration = this.data.illusts[this.data.currentIllustIndex]
                    if(imageIndex != undefined) {
                        this.data.currentImageIndex = imageIndex < 0 ? 0 : imageIndex >= illust.images.length ? illust.images.length - 1 : imageIndex
                    }else if(illust.images.length > 0) {
                        this.data.currentImageIndex = 0
                    }else{
                        this.data.currentImageIndex = null
                    }
                    this.data.currentDataURL = null
                    if(this.data.currentImageIndex != null) {
                        let image: Image = illust.images[this.data.currentImageIndex]
                        db.engine.loadImageURL(image.id, ImageSpecification.Origin, (dataURL) => {
                            if(dataURL) {
                                this.data.currentDataURL = dataURL
                            }
                        })
                        this.data.currentIllust = illust
                        this.data.currentImage = image
                        vueModel.setTitle(Strings.isNotBlank(image.subTitle) ? image.subTitle : Strings.isNotBlank(illust.title) ? illust.title : null)
                    }else{
                        this.data.currentIllust = {}
                        this.data.currentImage = {}
                        vueModel.setTitle(null)
                    }
                }else{
                    this.data.currentImageIndex = this.data.currentIllustIndex = null
                    this.data.currentDataURL = null
                    this.data.currentIllust = {}
                    this.data.currentImage = {}
                    vueModel.setTitle(null)
                }
            },
            //其他功能
            exportImage() {
                dialog.showSaveDialog(db.currentWindow, {
                    title: '导出图像',
                    defaultPath: Strings.isNotBlank(this.data.currentImage.subTitle) ? this.data.currentImage.subTitle :
                                 Strings.isNotBlank(this.data.currentIllust.title) ? this.data.currentIllust.title : undefined,
                    filters: [
                        {name: 'JPEG', extensions: ['jpg']},
                        {name: 'PNG', extensions: ['png']}
                    ]
                }, (filename) => {
                    if(filename) {
                        exportImage(this.data.currentDataURL, filename, (success) => {
                            if(success) {
                                alert('图像导出成功。')
                            }else{
                                alert('发生了位置的错误。')
                            }
                        })
                    }
                })
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
            openLink(link: string) {
                shell.openExternal(link)
            },
            setTouchBar() {
                if(db.platform.platform === 'darwin') {
                    touchBar = generateTouchBar()
                    vueModel.setTouchBar(touchBar.touchBar)
                }
            }
        }
    })
    $(document)['keydown'](function(e) {
        if(vm.visible) {
            if(e.keyCode === 37) {  //arrow left
                vm.arrow(e.altKey || e.metaKey ? 'illust' : 'image', 'prev')
            }else if(e.keyCode === 39) {
                vm.arrow(e.altKey || e.metaKey ? 'illust' : 'image', 'next')
            }else if(e.keyCode === 27) {
                vm.goBack()
            }
        }
    })
    return vm
}

module.exports = detailModel