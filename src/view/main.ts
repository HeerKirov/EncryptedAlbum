import {remote} from 'electron'
import {CommonModel} from "./model"
import {Illustration, IllustrationFindOption, Image, ImageSpecification} from "../common/engine"
import {Arrays, Sets} from "../util/collection"

const {TouchBar, dialog} = remote
const {TouchBarButton, TouchBarSpacer} = TouchBar
const Vue = require('vue/dist/vue')
const $ = window['$']

interface Frontend {
    title: string,
    dataURL: string,
    multiImage: boolean,
    selected: boolean,
    backendIllustIndex?: number,
    backendImageIndex?: number
}

function mainModel(vueModel: CommonModel) {
    let db = vueModel.db

    let temps = []
    let listOptions = {
        filter: {
            search: '',
            favorite: false,
            tags: []
        },
        sort: {
            by: 'createTime',
            desc: true
        },
        viewByImage: false
    }

    let vm = new Vue({
        el: '#mainView',
        data: {
            visible: false,
            fullscreen: false,

            ui: {
                filter: {
                    search: '',
                    favorite: false,
                    tags: [],
                    tagSearchText: '',
                    existTags: [],
                    noteText: null
                },
                sort: {
                    by: 'createTime',
                    desc: true
                },
                viewByImage: false
            },
            option: {
                filter: {
                    search: '',
                    favorite: false,
                    tags: []
                },
                sort: {
                    by: 'createTime',
                    desc: true
                },
                viewByImage: false,
            },
            view: {
                showTitle: false,
                zoom: 4,
                loadNum: 40
            },

            folder: {
                current: 'all',
                customs: []
            },
            data: {
                backend: [],    //保存Illustration的数据
                frontend: [],   //转换到前端显示的结构列表
                nextIllustrationIndex: 0,   //下次加载，要加载的illust在backend里的下标
                nextImageIndex: 0,          //下次加载，要加载的image在illust里的下标
                haveNextPage: false
            },
            selected: {
                mode: false,
                count: 0,
                frontendIndexList: []
            }
        },
        computed: {
            isNoTitleBar() {
                return this.fullscreen || db.platform.platform !== 'darwin'
            },
            isAnyFilter() {
                return this.option.filter.search || this.option.filter.tags.length > 0
            },
            isAnySelected() {
                return this.selected.count > 0
            }
        },
        methods: {
            //事件
            load(options?: any, refresh?: boolean) {
                db.ui.theme = 'gray'
                this.visible = true
                if(db.ui.fullscreen) {this.enterFullScreen()} else {this.leaveFullScreen()}
                if(refresh) {
                    this.loadData()
                    this.clearUploadData()
                    this.uploadData()
                }
            },
            leave() {
                this.visible = false
            },
            enterFullScreen() {
                this.fullscreen = true
            },
            leaveFullScreen() {
                this.fullscreen = false
            },
            //导航
            gotoAdd() {
                vueModel.route("edit")
            },
            gotoSetting() {
                vueModel.route("setting")
            },
            //navBar交互和操作
            saveFilterOption() {
                let changed = false
                if(this.ui.viewByImage != this.option.viewByImage) {
                    this.option.viewByImage = this.ui.viewByImage
                    changed = true
                }
                if(this.ui.sort.by != this.option.sort.by) {
                    this.option.sort.by = this.ui.sort.by
                    changed = true
                }
                if(this.ui.sort.desc != this.option.sort.desc) {
                    this.option.sort.desc = this.ui.sort.desc
                    changed = true
                }
                if(this.ui.filter.search != this.option.filter.search) {
                    this.option.filter.search = this.ui.filter.search
                    changed = true
                }
                if(this.ui.filter.favorite != this.option.filter.favorite) {
                    this.option.filter.favorite = this.ui.filter.favorite
                    changed = true
                }
                if(!Arrays.equal(this.ui.filter.tags, this.option.filter.tags)) {
                    this.option.filter.search = Arrays.clone(this.ui.filter.search)
                    changed = true
                }
                if(changed) {
                    this.loadData()
                    this.clearUploadData()
                    this.uploadData()
                    if(this.isAnyFilter) {
                        this.ui.filter.noteText = `${this.option.filter.tags.length > 0 ? '[' : ''}
                            ${Arrays.concatString(this.option.filter.tags, '][')}
                            ${this.option.filter.tags.length > 0 ? ']' : ''} ${this.option.filter.search}`
                    }else{
                        this.ui.filter.noteText = null
                    }
                }
            },
            loadFilterOption() {
                this.ui.viewByImage = this.option.viewByImage
                this.ui.sort.by = this.option.sort.by
                this.ui.sort.desc = this.option.sort.desc
                this.ui.filter.search = this.option.filter.search
                this.ui.filter.favorite = this.option.filter.favorite
                this.ui.filter.tags = Arrays.clone(this.option.filter.tags)
                this.ui.filter.tagSearchText = ''
            },
            //显示控制
            loadData() {
                let option: IllustrationFindOption = {
                    findByImage: this.option.viewByImage,
                    order: [this.option.sort.by],
                    desc: this.option.sort.desc,
                    search: this.option.filter.search ? this.option.filter.search : undefined,
                    favorite__eq: this.option.filter.favorite ? true : undefined,
                    tag__containsAll: Arrays.isNotEmpty(this.option.filter.tags) ? this.option.filter.tags : undefined
                }
                this.data.backend = db.engine.findIllustration(option)
                //将数据加载到backend。
            },
            clearUploadData() {
                this.data.frontend = []
                this.data.nextIllustrationIndex = 0
                this.data.nextImageIndex = 0
                this.data.haveNextPage = false
            },
            uploadData() {
                //将一部分backend的数据刷新到显示列表。
                //这个刷新视data.next而定。
                if(this.data.nextIllustrationIndex < this.data.backend.length) {
                    let leave = this.view.loadNum
                    let frontendIndex = this.data.frontend.length
                    if(this.option.viewByImage) {
                        while(this.data.nextIllustrationIndex < this.data.backend.length) {
                            let illust: Illustration = this.data.backend[this.data.nextIllustrationIndex]
                            while(this.data.nextImageIndex < illust.images.length) {
                                uploadImage(this.data.nextIllustrationIndex, this.data.nextImageIndex, frontendIndex++)
                                if(leave != null && leave != '*') leave --
                                this.data.nextImageIndex ++
                                if(leave <= 0) {
                                    break
                                }
                            }
                            if(leave <= 0) {
                                break
                            }
                            this.data.nextIllustrationIndex ++
                            this.data.nextImageIndex = 0
                        }
                    }else{
                        while(this.data.nextIllustrationIndex < this.data.backend.length) {
                            uploadIllust(this.data.nextIllustrationIndex, frontendIndex++)
                            if(leave != null) leave --
                            this.data.nextIllustrationIndex ++
                            if(leave <= 0) {
                                break
                            }
                        }
                    }
                }
                this.data.haveNextPage = (this.data.nextIllustrationIndex < this.data.backend.length)

                function uploadImage(illustIndex: number, imageIndex: number, frontendIndex: number) {
                    let illust: Illustration = vm.data.backend[illustIndex]
                    let image: Image = illust.images[imageIndex]
                    db.engine.loadImageURL(image.id, ImageSpecification.Thumbnail, (dataURL) => {
                        vm.$set(vm.data.frontend, frontendIndex, {
                            title: image.subTitle ? image.subTitle : illust.title,
                            dataURL: dataURL,
                            multiImage: false,
                            selected: false,
                            backendIllustIndex: illustIndex,
                            backendImageIndex: imageIndex
                        })
                    })
                }
                function uploadIllust(illustIndex: number, frontendIndex: number) {
                    let illust: Illustration = vm.data.backend[illustIndex]
                    if(illust.images.length > 0) {
                        let image: Image = illust.images[0]
                        db.engine.loadImageURL(image.id, ImageSpecification.Thumbnail, (dataURL) => {
                            vm.$set(vm.data.frontend, frontendIndex, {
                                title: illust.title,
                                dataURL: dataURL,
                                multiImage: illust.images.length > 1,
                                selected: false,
                                backendIllustIndex: illustIndex
                            })
                        })
                    }else{
                        vm.$set(vm.data.frontend, frontendIndex, {
                            title: illust.title,
                            dataURL: '',
                            multiImage: false,
                            selected: false,
                            backendIllustIndex: illustIndex
                        })
                    }
                }
            },
            //选取和选取功能
            switchSelectMode() {
                this.selected.mode = !this.selected.mode
                if(!this.selected.mode) {
                    this.selected.count = 0
                    this.selected.frontendIndexList = []
                }
            },
            clickOne(frontendIndex: number, mouse: 'left' | 'right' = 'left') {
                if(frontendIndex >= 0 && frontendIndex < this.data.frontend.length) {
                    if(mouse === 'left') {
                        if(this.selected.mode) {
                            selectOne(frontendIndex)
                        }else{
                            //TODO go to detail page
                        }
                    }else if(!this.selected.mode) {//右键点击，未处于选择模式
                        this.selected.mode = true
                        selectOne(frontendIndex)
                    }else if(!selectOne(frontendIndex) && !this.isAnySelected){//右键点击，处于选择模式，判断选择后的状态是否应当取消选择模式
                        this.selected.mode = false
                    }
                }
                function selectOne(frontendIndex: number): boolean {
                    let frontend: Frontend = vm.data.frontend[frontendIndex]
                    vm.$set(frontend, 'selected', !frontend.selected)
                    if(frontend.selected) {
                        if(!Arrays.contains(vm.selected.frontendIndexList, frontendIndex)) {
                            Arrays.append(vm.selected.frontendIndexList, frontendIndex)
                            vm.selected.count ++
                        }
                    }else{
                        if(Arrays.remove(vm.selected.frontendIndexList, frontendIndex)) {
                            vm.selected.count --
                        }
                    }
                    return frontend.selected
                }
            }
        }
    })
    return vm
}

module.exports = mainModel