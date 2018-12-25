const {ImageSpecification} = require("../target/common/engine")
const {remote} = require('electron')
const {TouchBar} = remote
const {TouchBarButton, TouchBarSpacer, TouchBarPopover, TouchBarLabel,
    TouchBarSlider, TouchBarScrubber, TouchBarSegmentedControl} = TouchBar
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

function detailModel(vueModel) {
    let db = vueModel.db

    let vm = new Vue({
        el: '#detailView',
        data: {
            visible: false,
            fullscreen: false,

            showDock: true,     //控制下方工具条的显示
            showTool: true,     //控制环绕在图片四周的工具按钮的显示
        },
        computed: {
            showFullScreenButton: function () {
                return db.platform.platform !== 'darwin'
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

            },
            prevPage: function() {

            },

            setTouchBar: function () {
                vueModel.setTouchBar(new TouchBar({
                    items: [
                        new TouchBarButton({label: '返回', click: this.goBack}),
                        new TouchBarSpacer({size: 'flexible'}),
                        new TouchBarButton({label: '上一页', click: this.prevPage}),
                        new TouchBarButton({label: '下一页', click: this.nextPage}),
                        new TouchBarSpacer({size: 'large'}),
                        new TouchBarPopover({
                            label: '缩放',
                            items: [
                                //TODO 填写touchBar中按钮的事件。
                                new TouchBarSlider({label: '尺寸', minValue: 1, maxValue: 100, value: 40, change: (value) => {}}),
                                new TouchBarButton({label: '自适应', click: () => {}})
                            ]
                        }),
                        new TouchBarPopover({
                            label: '轮播',
                            items: [
                                new TouchBarSpacer({size: 'large'}),
                                new TouchBarSegmentedControl({
                                    segments: [
                                        {label: '随机'},
                                        {label: '顺序'}
                                    ],
                                    selectedIndex: 1,
                                    change: (index, state) => {

                                    }
                                }),
                                new TouchBarSpacer({size: 'large'}),
                                new TouchBarLabel({label: '轮播时间'}),
                                new TouchBarScrubber({
                                    items: buildPlayScrubbers(),
                                    selectedStyle: "background",
                                    continuous: false,
                                    select: (index) => {},
                                })
                            ]
                        })
                    ]
                }))
            }
        }
    })
    return vm
}

module.exports = detailModel
