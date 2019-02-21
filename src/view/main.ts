import {remote} from 'electron'
import {CommonModel} from "./model"
import {Illustration, IllustrationFindOption, Image, ImageSpecification, Scale} from "../common/engine"
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

function getIllustrationFindOption(option): IllustrationFindOption {
    return {
        findByImage: option.viewByImage,
        order: [option.sort.by],
        desc: option.sort.desc,
        search: option.filter.search ? option.filter.search : undefined,
        favorite__eq: option.filter.favorite ? true : undefined,
        tag__containsAll: Arrays.isNotEmpty(option.filter.tags) ? Arrays.clone(option.filter.tags) : undefined
    }
}
function getUIOption(option: IllustrationFindOption): Object {
    return {
        filter: {
            search: option.search ? option.search : null,
            favorite: option.favorite__eq || false,
            tags: Arrays.isNotEmpty(option.tag__containsAll) ? Arrays.clone(option.tag__containsAll) : []
        },
        sort: {
            by: option.order && option.order.length > 0 ? option.order[0] : '',
            desc: option.desc || false
        },
        viewByImage: option.findByImage || false
    }
}

function mainModel(vueModel: CommonModel) {
    let db = vueModel.db
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
                current: 'list',
                type: 'list',
                customs: []     //保存所有自定义文件夹。{name: string, virtual: boolean}
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
            },
            realFolders() {
                return Arrays.filter(this.folder.customs, (t: any) => !t.virtual)
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
                    if(this.folder.type === 'list') {
                        db.engine.updateQuery(getIllustrationFindOption(this.option))
                    }else if(this.folder.type === 'virtual-folder') {
                        db.engine.createOrUpdateVirtualFolder(this.folder.customs[this.folder.current].name, getIllustrationFindOption(this.option))
                    }
                    this.loadData()
                    this.clearUploadData()
                    this.uploadData()
                    this.updateNoteText()
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
            switchViewByImage() {
                this.option.viewByImage = !this.option.viewByImage
                this.loadData()
                this.clearUploadData()
                this.uploadData()
            },
            updateNoteText() {
                if(this.isAnyFilter) {
                    this.ui.filter.noteText = `${this.option.filter.tags.length > 0 ? '[' : ''}
                            ${Arrays.concatString(this.option.filter.tags, '][')}
                            ${this.option.filter.tags.length > 0 ? ']' : ''} ${this.option.filter.search}`
                }else{
                    this.ui.filter.noteText = null
                }
            },
            //文件夹切换和控制
            switchFolder(folder: 'list' | 'temp' | number) {
                if(this.folder.current != folder) {
                    this.folder.current = folder
                    if(folder === 'list' || folder === 'temp') this.folder.type = folder
                    else this.folder.type = this.folder.customs[this.folder.current].virtual ? 'virtual-folder' : 'folder'

                    if(this.folder.type === 'list') {
                        this.option = getUIOption(db.engine.getQueryInformation())
                        this.updateNoteText()
                    }else if(this.folder.type === 'virtual-folder') {
                        this.option = getUIOption(db.engine.getVirtualFolderInformation(this.folder.customs[this.folder.current].name))
                        this.updateNoteText()
                    }
                    if(this.selected.mode) this.switchSelectMode()
                    this.loadData()
                    this.clearUploadData()
                    this.uploadData()
                }
            },
            //显示控制
            loadData() {
                //将数据加载到backend。
                if(this.folder.current === 'list') {
                    this.data.backend = db.engine.findQuery()
                }else if(this.folder.current === 'temp') {
                    this.data.backend = db.engine.findTempFolder()
                }else if(this.folder.current >= 0 && this.folder.current < this.folder.customs.length) {
                    this.data.backend = db.engine.findFolder(this.folder.customs[this.folder.current].name)
                }else{
                    this.data.backend = []
                    console.warn(`folder "${this.folder.current}" is not exist.`)
                }
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
            },
            switchSelectMode() {
                this.selected.mode = !this.selected.mode
                if(!this.selected.mode) {
                    this.selectClear()
                }
            },
            selectClear() {
                this.selected.count = 0
                this.selected.frontendIndexList = []
                for(let frontend of this.data.frontend) {
                    frontend.selected = false
                }
            },
            selectAll() {
                for(let frontend of this.data.frontend) {
                    vm.$set(frontend, 'selected', true)
                }
                this.selected.frontendIndexList = []
                for(let i = 0; i < this.data.frontend.length; ++i) this.selected.frontendIndexList[i] = i
                this.selected.count = this.data.frontend.length
            },
            selectReverse() {
                this.selected.count = this.data.frontend.length - this.selected.count
                let oldList = this.selected.frontendIndexList
                this.selected.frontendIndexList = []
                for(let i = 0; i < this.data.frontend.length; ++i) {
                    if(!Arrays.contains(oldList, i)) {
                        Arrays.append(this.selected.frontendIndexList, i)
                    }
                    vm.$set(this.data.frontend[i], 'selected', !this.data.frontend[i].selected)
                }
            },
            addToFolder(folder: 'temp' | number) {
                //将当前选定项添加到指定的临时文件夹|实体文件夹。
                let items = this.getSelectedItems()
                if(folder === 'temp') {
                    db.engine.updateTempFolder(items, 'add')
                }else{
                    let folder = this.folder.customs[this.folder.current]
                    if(!folder.virtual) {
                        db.engine.createOrUpdateRealFolder(folder.name, items, 'add')
                    }
                }
                this.selectClear()
            },
            removeFromFolder() {
                //将当前选定项从文件夹移出，只能在临时文件夹|实体文件夹操作。
                let items = this.getSelectedItems()
                if(this.folder.current === 'temp') {
                    db.engine.updateTempFolder(items, 'delete')
                }else{
                    let folder = this.folder.customs[this.folder.current]
                    if(!folder.virtual) {
                        db.engine.createOrUpdateRealFolder(folder.name, items, 'delete')
                    }
                }
                //为了避免过多刷新查询，删除操作将不会执行刷新，而是自行移除frontend. backend则不会移除，它不碍事，下次刷新也会自动修正。
                let list: number[] = Arrays.map(this.selected.frontendIndexList, (t: any) => parseInt(t))
                list.sort((a, b) => a === b ? 0 : a > b ? -1 : 1)
                for(let i of list) {
                    Arrays.removeAt(this.data.frontend, i)
                }
                this.selectClear()
            },
            getSelectedItems(): Scale[] {
                let items: Scale[] = []
                for(let frontendIndex of this.selected.frontendIndexList) {
                    let backendIllustIndex = this.data.frontend[frontendIndex].backendIllustIndex
                    let backendImageIndex = this.data.frontend[frontendIndex].backendImageIndex
                    let illust: Illustration = this.data.backend[backendIllustIndex]
                    if(backendImageIndex != null) {
                        Arrays.append(items, {
                            illustId: illust.id,
                            imageIndex: [backendImageIndex]
                        })
                    }else{
                        Arrays.append(items, {
                            illustId: illust.id,
                            imageIndex: Arrays.map(illust.images, (t) => t.index)
                        })
                    }
                }
                items = Arrays.zip<Scale, Scale>(items, (last, next) => {
                    if(last.illustId != next.illustId) return undefined
                    else return {
                        illustId: last.illustId,
                        imageIndex: Arrays.join(last.imageIndex, next.imageIndex)
                    }
                })
                return items
            },
            //工具函数
            inFolderType(type: 'list' | 'temp' | 'folder' | 'virtual-folder') {
                return this.folder.type === type
            }
        }
    })
    return vm
}

module.exports = mainModel