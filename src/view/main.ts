import {remote} from 'electron'
import {CommonModel} from "./model"
import {Illustration, IllustrationFindOption, Image, ImageSpecification, Scale} from "../common/engine"
import {Arrays, Sets} from "../util/collection"
import {Tags} from "../util/model";
import {Strings} from "../util/string";
import {exportImage} from "../util/nativeImage"

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
        tag__containsAll: Arrays.isNotEmpty(option.filter.tags) ? Arrays.clone(option.filter.tags) : undefined
    }
}
function getUIOption(option: IllustrationFindOption): Object {
    return {
        filter: {
            search: option.search ? option.search : null,
            tags: Arrays.isNotEmpty(option.tag__containsAll) ? Arrays.clone(option.tag__containsAll) : []
        },
        sort: {
            by: option.order && option.order.length > 0 ? option.order[0] : '',
            desc: option.desc || false
        },
        viewByImage: option.findByImage || false
    }
}

function generateExportTitle(illust: Illustration, image: Image): string {
    if(illust.images.length > 1) {
        return `${illust.title ? illust.title : illust.id}-${image.index}${image.subTitle ? ('-' + image.subTitle) : ''}`
    }else{
        return `${illust.title ? illust.title : illust.id}${image.subTitle ? ('-' + image.subTitle) : ''}`
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
                    tags: [],
                    tagSearchText: '',  //绑定过滤面板上的标签搜索框
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
                    tags: []
                },
                sort: {
                    by: 'createTime',
                    desc: true
                },
                viewByImage: false,
            },
            tag: {
                tags: [],
                typeList: []
            },
            view: {
                showTitle: false,
                zoom: 4,
                loadNum: 40
            },

            folder: {
                current: 'list',
                type: 'list',
                customs: [],     //保存所有自定义文件夹。{name: string, virtual: boolean}

                create: {
                    name: '',
                    type: 'folder'
                }
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
            },

            exportation: {
                path: null,
                items: []
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
                return Arrays.filterMap(this.folder.customs, (t: any, i: number) => !t.virtual ? {name: t.name, index: i} : undefined)
            }
        },
        watch: {
            'view.showTitle': function () {
                this.saveViewOption()
            },
            'view.zoom': function () {
                this.saveViewOption()
            },
            'view.loadNum': function () {
                this.saveViewOption()
            }
        },
        methods: {
            //事件
            load(options?: any, refresh?: boolean) {
                db.ui.theme = 'gray'
                this.visible = true
                if(db.ui.fullscreen) {this.enterFullScreen()} else {this.leaveFullScreen()}
                if(db.storage == null) {
                    alert('发生错误：存储未加载。')
                }
                if(db.engine == null) {
                    db.engine = db.storage.loadMainEngine()
                    db.engine.connect()
                }
                console.log(db.engine)
                this.tag.typeList = db.engine.getConfig('tag-type')
                this.loadViewOption()
                this.loadFolder()
                if(refresh) {
                    this.switchFolder(this.folder.current, true)
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
                vueModel.route('edit')
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
                if(!Arrays.equal(this.ui.filter.tags, this.option.filter.tags)) {
                    this.option.filter.tags = Arrays.clone(this.ui.filter.tags)
                    changed = true
                }
                if(changed) {
                    if(this.folder.type === 'list') {
                        db.engine.updateQuery(getIllustrationFindOption(this.option))
                    }else if(this.folder.type === 'virtual-folder') {
                        db.engine.createOrUpdateVirtualFolder(this.folder.customs[this.folder.current].name, getIllustrationFindOption(this.option))
                        db.engine.save()
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
                this.ui.filter.tags = Arrays.clone(this.option.filter.tags)
                this.ui.filter.tagSearchText = ''
                this.tag.tags = db.engine.findTag({order: ['type', 'title']})
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
                            ${Arrays.concatString(Arrays.map(this.option.filter.tags, (tag: string) => Tags.getTagName(tag)), '][')}
                            ${this.option.filter.tags.length > 0 ? ']' : ''} ${this.option.filter.search ? this.option.filter.search : ''}`
                }else{
                    this.ui.filter.noteText = null
                }
            },
            addFilterTag(tag: string) {
                if(!Arrays.contains(this.ui.filter.tags, tag)) {
                    vm.$set(this.ui.filter.tags, this.ui.filter.tags.length, tag)
                }
            },
            removeFilterTag(index: number) {
                Arrays.removeAt(this.ui.filter.tags, index)
            },
            searchFilterTag() {
                if(this.ui.filter.tagSearchText) {
                    this.tag.tags = db.engine.findTag({order: ['type', 'title'], search: Strings.isNotBlank(this.ui.filter.tagSearchText) ? this.ui.filter.tagSearchText : undefined})
                }else{
                    this.tag.tags = db.engine.findTag({order: ['type', 'title']})
                }
            },
            saveViewOption() {
                db.engine.putConfig('view', {
                    showTitle: this.view.showTitle,
                    zoom: this.view.zoom,
                    loadNum: this.view.loadNum
                })
                db.engine.save()
            },
            loadViewOption() {
                let view = db.engine.getConfig('view')
                if(view) {
                    this.view.loadNum = view.loadNum
                    this.view.zoom = view.zoom
                    this.view.showTitle = view.showTitle
                }
            },
            //文件夹切换和控制
            loadFolder() {
                this.folder.customs = db.engine.getFolderList()
            },
            switchFolder(folder: 'list' | 'temp' | number, force: boolean = false) {
                if(force || this.folder.current != folder) {
                    this.folder.current = folder
                    if(folder === 'list' || folder === 'temp') this.folder.type = folder
                    else this.folder.type = this.folder.customs[this.folder.current].virtual ? 'virtual-folder' : 'folder'

                    if(this.folder.type === 'list') {
                        let queryInfo = db.engine.getQuery()
                        if(queryInfo) {
                            this.option = getUIOption(queryInfo)
                        }
                        this.updateNoteText()
                    }else if(this.folder.type === 'virtual-folder') {
                        let queryInfo = db.engine.getVirtualFolder(this.folder.customs[this.folder.current].name)
                        if(queryInfo) {
                            this.option = getUIOption(queryInfo)
                        }
                        this.updateNoteText()
                    }
                    if(this.selected.mode) this.switchSelectMode()
                    this.loadData()
                    this.clearUploadData()
                    this.uploadData()
                }
            },
            createFolder() {
                if(Strings.isBlank(this.folder.create.name)) {
                    alert('文件夹的名称不能为空。')
                    return
                }
                let name = this.folder.create.name.trim()
                let virtual = !(this.folder.create.type === 'folder')
                if(db.engine.isFolderExist(name)) {
                    alert('该名称的文件夹已经存在。')
                    return
                }
                if(!virtual) {
                    db.engine.createOrUpdateRealFolder(name, [], "update")
                }else{
                    db.engine.createOrUpdateVirtualFolder(name, {})
                }
                db.engine.save()
                this.folder.create.name = ''
                let index = this.folder.customs.length
                vm.$set(this.folder.customs, index, {name: name, virtual: virtual})
                this.switchFolder(index)
            },
            //显示控制
            loadData() {
                //将数据加载到backend。
                if(this.folder.current === 'list') {
                    this.data.backend = db.engine.findIllustration(db.engine.getQuery())
                }else if(this.folder.current === 'temp') {
                    this.data.backend = db.engine.findIllustrationByScale(db.engine.getTempFolder())
                }else if(this.folder.current >= 0 && this.folder.current < this.folder.customs.length) {
                    if(this.folder.customs[this.folder.current].virtual) {
                        this.data.backend = db.engine.findIllustration(db.engine.getVirtualFolder(this.folder.customs[this.folder.current].name))
                    }else{
                        this.data.backend = db.engine.findIllustrationByScale(db.engine.getRealFolder(this.folder.customs[this.folder.current].name))
                    }
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
                            let scales: Scale[] = Arrays.map(this.data.backend, (illust: Illustration) => {
                                return {
                                    illustId: illust.id,
                                    imageIndex: Arrays.map(illust.images, (image: Image) => image.index)
                                }
                            })
                            let {backendIllustIndex, backendImageIndex} = this.data.frontend[frontendIndex]
                            let illust: Illustration = this.data.backend[backendIllustIndex]
                            if(backendImageIndex != undefined) {
                                let image: Image = illust.images[backendImageIndex]
                                vueModel.route('detail', {scales, selectIllustId: illust.id, selectImageIndex: image.index})
                            }else{
                                vueModel.route('detail', {scales, selectIllustId: illust.id})
                            }
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
            selectAction(action: 'detail' | 'edit' | 'export' | 'delete') {
                if(action === 'detail') {
                    let scales = this.getSelectedItems()
                    let selectIllustId = scales.length > 0 ? scales[0].illustId : null
                    let selectImageIndex = scales.length > 0 ? scales[0].imageIndex[0] : null
                    vueModel.route('detail', {scales, selectIllustId, selectImageIndex})
                }else if(action === 'edit') {
                    let illustIds = []
                    for(let frontendIndex of this.selected.frontendIndexList) {
                        let backendIllustIndex = this.data.frontend[frontendIndex].backendIllustIndex
                        let illust: Illustration = this.data.backend[backendIllustIndex]
                        Sets.put(illustIds, illust.id)
                    }
                    vueModel.route('edit', {illustIds})
                }else if(action === 'export') {
                    dialog.showOpenDialog(db.currentWindow, {
                        title: '导出位置',
                        properties: ['openDirectory', 'createDirectory']
                    }, (paths) => {
                        if(paths) {
                            this.exportation.path = paths[0]
                            let items = []

                            for(let frontendIndex of this.selected.frontendIndexList) {
                                let backendIllustIndex = this.data.frontend[frontendIndex].backendIllustIndex
                                let backendImageIndex = this.data.frontend[frontendIndex].backendImageIndex
                                let illust: Illustration = this.data.backend[backendIllustIndex]
                                if(backendImageIndex != null) {
                                    let image: Image = illust.images[backendImageIndex]
                                    Arrays.append(items, {
                                        title: generateExportTitle(illust, image),
                                        imageId: image.id
                                    })
                                }else{
                                    for(let image of illust.images) {
                                        Arrays.append(items, {
                                            title: generateExportTitle(illust, image),
                                            imageId: image.id
                                        })
                                    }
                                }
                            }

                            this.exportation.items = items
                            $('#exportModal')['modal']()
                        }
                    })
                }
            },
            addToFolder(folder: 'temp' | number) {
                //将当前选定项添加到指定的临时文件夹|实体文件夹。
                let items = this.getSelectedItems()
                if(folder === 'temp') {
                    db.engine.updateTempFolder(items, 'add')
                }else{
                    let f = this.folder.customs[folder]
                    if(!f.virtual) {
                        db.engine.createOrUpdateRealFolder(f.name, items, 'add')
                        db.engine.save()
                    }else{
                        console.warn(`'${f.name}' is a virtual folder.`)
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
            exportDo() {
                if(Arrays.isNotEmpty(this.exportation.items)) {
                    let items = this.exportation.items, path = this.exportation.path
                    let cnt = items.length
                    for(let {title, imageId} of items) {
                        db.engine.loadImageURL(imageId, ImageSpecification.Origin, (dataURL) => {
                            if(dataURL) {
                                let filename = `${path}/${title}.jpg`
                                exportImage(dataURL, filename, (success) => {
                                    if(!success) {
                                        alert(`导出图像'${title}'时遇到了未知的错误。`)
                                    }
                                    if(-- cnt <= 0) {
                                        alert('图像导出成功。')
                                    }
                                })
                            }
                        })
                    }
                    this.exportation.items = []
                    this.exportation.path = null
                }
            },
            //工具函数
            inFolderType(type: 'list' | 'temp' | 'folder' | 'virtual-folder') {
                return this.folder.type === type
            },
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
        }
    })
    return vm
}

module.exports = mainModel