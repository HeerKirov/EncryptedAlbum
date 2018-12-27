const {ImageSpecification} = require("../target/common/engine")
const {remote} = require('electron')
const {TouchBar} = remote
const {TouchBarButton, TouchBarSpacer, TouchBarPopover,
    TouchBarSlider, TouchBarSegmentedControl} = TouchBar
const Vue = require('vue/dist/vue')

const playItems = [
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
    for(let i in playItems) {
        ret[ret.length] = {label: playItems[i].title}
    }
    return ret
}

function buildTouchBar(vm) {
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
            new TouchBarButton({label: '返回', click: vm.goBack}),
            new TouchBarSpacer({size: 'flexible'}),
            new TouchBarButton({label: '上一页', click: vm.prevPage}),
            new TouchBarButton({label: '下一页', click: vm.nextPage}),
            new TouchBarSpacer({size: 'large'}),
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
        zoomAbsoluteControl, zoomValueControl,
        playItemControl, playRandControl
    }
}

function detailModel(vueModel) {
    let db = vueModel.db
    let touchBar = null
    //TODO 添加键盘快捷键事件(左右键快捷跳转)
    //TODO 尝试添加触摸板手势(双指左右快捷跳转/双指缩放)
    let vm = new Vue({
        el: '#detailView',
        data: {
            visible: false,
            fullscreen: false,

            showDock: true,     //控制下方工具条的显示
            dockType: 'list',   //dock栏显示的内容[list, zoom, play]
            showTool: true,     //控制环绕在图片四周的工具按钮的显示

            playItem: 0,        //轮播的值的index
            playRand: false,    //随机轮播

            zoomAbsolute: false,//启用绝对值缩放
            zoomValue: 50,      //绝对缩放。这个绝对值仍然是基于图片的基础大小缩放的，50%相当于原大小。

            showList: [],
            showIndex: -1,
            //TODO 在图片页里添加一个详情面板侧板，可以通过一个快捷按钮调出。
            //TODO 考虑下方展示横条的构造形式。

            currentDataURL: '',
            thumbnails: [],

            playItems: playItems    //绑定显示的常量
        },
        computed: {
            showFullScreenButton: function () {
                return db.platform.platform !== 'darwin'
            }
        },
        watch: {
            'playItem': function (value) {
                if(touchBar != null) {
                    touchBar.playItemControl.selectedIndex = value
                }
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
                this.setTouchBar()
            },
            leave: function () {
                this.visible = false
                //TODO 清空存储区
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

            nextPage: function() {
                this.loadCurrentAs(this.showIndex + 1)
            },
            prevPage: function() {
                this.loadCurrentAs(this.showIndex - 1)
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
            },
            loadCurrentAs: function(index) {
                if(index >= 0 && index < this.showList.length) {
                    this.showIndex = index
                    let image = this.showList[index]
                    this.currentDataURL = ''
                    db.engine.loadImageURL(image.id, ImageSpecification.Origin, (dataURL) => {
                        this.currentDataURL = dataURL
                    })
                }
            },

            setTouchBar: function () {
                if(db.platform.platform !== 'darwin') return;
                touchBar = buildTouchBar(this)
                vueModel.setTouchBar(touchBar.touchBar)
            }
        }
    })
    return vm
}

module.exports = detailModel
