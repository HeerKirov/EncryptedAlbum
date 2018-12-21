const {TouchBar} = require('electron').remote
const {TouchBarButton, TouchBarSpacer, TouchBarPopover, TouchBarSlider} = TouchBar
const Vue = require('vue/dist/vue')

function mainModel(vueModel) {
    let db = vueModel.db
    return new Vue({
        el: '#mainView',
        data: {
            visible: false,
            fullscreen: false,
            //绑定展示页面空间的option数据项
            filterInput: {
                favorite: false,
                tags: [],
            },
            sortInput: {
                by: '',
                desc: true
            },
            viewInput: {
                aggregateByCollection: false,
                showTitle: false,
                zoom: 4
            },
            searchTextInput: '',
            //绑定实际使用的option数据项
            filter: {
                favorite: false,
                tags: []
            },
            sort: {
                by: '',
                desc: true
            },
            view: {
                aggregateByCollection: false,
                showTitle: false,
                zoom: 4
            },
            searchText: '',
            //绑定选择功能
            selected: {
                mode: false,
                count: 0,
                list: []
            },
            //绑定内容展示列表和区分
            viewFolder: 'list', //list or temp
            showList: [],    //绑定在前端展示的列表。包含dataURL。
            items: [],      //用于保存当前正在查询的列表。在被正式上载之前不含dataURL。
            temps: [],      //用于保存临时文件夹。

            dataCache: {},   //缓存最近使用过的dataURL。
            platform: null
        },
        computed: {
            leastSelectOne: function () {
                return this.selected.mode && this.selected.count > 0
            }
        },
        methods: {
            load: function() {
                db.ui.theme = 'gray'
                this.visible = true
                if(db.ui.fullscreen) {this.enterFullScreen()} else {this.leaveFullScreen()}
                // this.platform = ipcRenderer.sendSync('platform').platform
                // ipcRenderer.sendSync('load-engine')
                // this.loadCacheFromMain()
                // if(this.viewFolder === 'list') this.search()
                // this.loadTempsFromMain()
                // this.setTouchBar('standard')
                // this.loadListToPage()
            },
            leave: function() {
                this.visible = false
            },
            enterFullScreen: function() {
                this.fullscreen = true
            },
            leaveFullScreen: function() {
                this.fullscreen = false
            },
            add: function() {
                this.setTouchBar(null)
                // ipcRenderer.sendSync('goto', 'add')
            },
            //与控件绑定的事件
            loadOptionToFilter: function () {
                //将filter选项加载到html显示。
                this.filterInput.favorite = this.filter.favorite
                let tags = []
                for(let i = 0; i < this.filter.tags.length; ++i) tags[i] = this.filter.tags[i]
                this.filterInput.tags = tags
            },
            loadOptionToSort: function () {
                //将sort选项加载到html显示。
                this.sortInput.by = this.sort.by
                this.sortInput.desc = this.sort.desc
            },
            loadOptionToView: function () {
                //将view选项加载到html显示。
                this.viewInput.aggregateByCollection = this.view.aggregateByCollection
                this.viewInput.showTitle = this.view.showTitle
                this.viewInput.zoom = this.view.zoom
            },
            loadOptionToSearch: function() {
                this.searchTextInput = this.searchText
            },
            saveOptionFromFilter: function () {
                this.filter.favorite = this.filterInput.favorite
                let tags = []
                for(let i = 0; i < this.filterInput.tags.length; ++i) tags[i] = this.filterInput.tags[i]
                this.filter.tags = tags
                ipcRenderer.sendSync('save-main-cache', {filter: this.filter})
                this.search()
                this.loadListToPage()
            },
            saveOptionFromSort: function () {
                this.sort.by = this.sortInput.by
                this.sort.desc = this.sortInput.desc
                ipcRenderer.sendSync('save-main-cache', {sort: this.sort})
                this.search()
                this.loadListToPage()
            },
            saveOptionFromView: function () {
                if(this.view.aggregateByCollection !== this.viewInput.aggregateByCollection) {
                    this.view.aggregateByCollection = this.viewInput.aggregateByCollection
                    this.loadListToPage()
                }
                this.view.showTitle = this.viewInput.showTitle
                this.view.zoom = this.viewInput.zoom
                ipcRenderer.sendSync('save-main-cache', {view: this.view})
            },
            saveOptionFromSearch: function () {
                this.searchText = this.searchTextInput
                ipcRenderer.sendSync('save-main-cache', {search: this.searchText})
                this.search()
                this.loadListToPage()
            },
            //加载时用于从主线程加载
            loadCacheFromMain: function () {
                //从主线程加载option缓存。
                let ret = ipcRenderer.sendSync('load-main-cache')
                if(ret.filter) this.filter = ret.filter
                if(ret.sort) this.sort = ret.sort
                if(ret.view) this.view = ret.view
                if('folder' in ret && ret.folder) this.viewFolder = ret.folder
                if(ret.search) {
                    this.searchText = ret.search
                    this.loadOptionToSearch()
                }
            },
            loadTempsFromMain: function() {
                //从主线程加载临时文件夹。
                let temps = ipcRenderer.sendSync('load-main-temps', {findImage: true})
                if(temps) {
                    this.temps = temps
                }
            },

            search: function () {
                //提交一次查询操作。这个操作将会同时将option提交到主线程，并使主线程缓存查询结果。
                let findOption = {}
                if(this.searchText) findOption['search'] = this.searchText
                if(this.sort.by) findOption['order'] = [this.sort.by]
                findOption['desc'] = this.sort.desc
                if(this.filter.favorite) findOption['favorite_eq'] = true
                if(this.filter.tags) findOption['tags'] = this.filter.tags
                this.items = ipcRenderer.sendSync('find-image', findOption)
            },
            loadListToPage: function () {
                //此函数根据viewFolder的类型，将items或temps加载到showList。
                //同时，这还会将dataURL绑定到数据模型。
                //TODO 按照【聚合为画集】效果进行聚合
                this.clearSelected()
                let items, output = []
                if(this.viewFolder === 'list') {
                    items = this.items
                }else {
                    items = this.temps
                }
                for(let i in items) {
                    let image = items[i]
                    let index = i
                    if(image.buffer === undefined || image.buffer === null) {
                        if(image.id in this.dataCache) {
                            vm.$set(output, i, {
                                buffer: this.dataCache[image.id],
                                title: image.title,
                                col: false,
                                selected: false,
                                id: image.id,
                                index: index
                            })
                        }else{
                            ipcRenderer.once('load-image-url-await-' + image.id, (e, arg) => {
                                let newSet = {
                                    buffer: arg,
                                    title: image.title,
                                    col: false,
                                    selected: false,
                                    id: image.id,
                                    index: index
                                }
                                vm.$set(output, i, newSet)
                                this.dataCache[image.id] = arg
                            })
                            ipcRenderer.send('load-image-url-async', {id: image.id, specification: 'Exhibition', awaitId: image.id})
                        }
                    }
                }
                this.showList = output
            },
            refreshShowList: function () {
                let m = this.showList
                this.showList = null
                this.showList = m
            },

            selectOne: function(index) {
                //单击一张图片。
                if(this.selected.mode) {
                    //单击选定|取消选定某一个index上的项。
                    vm.$set(this.showList[index], 'selected', !this.showList[index].selected)
                    if(this.showList[index].selected) {
                        let flag = true;
                        for(let i of this.selected.list) {
                            if(index === i) {
                                flag = false
                                break
                            }
                        }
                        if(flag) {
                            this.selected.list[this.selected.list.length] = index
                            this.selected.count ++
                        }
                    }else{
                        let idx = this.selected.list.indexOf(index)
                        if(idx >= 0) {
                            this.selected.list.splice(idx, 1)
                            this.selected.count --
                        }
                    }
                }else{
                    //单击进入阅览模式。
                    //TODO 跳转到单页。
                }
            },
            switchSelectMode: function() {
                this.selected.mode = !this.selected.mode
                this.setTouchBar('standard')
                if(!this.selected.mode) {
                    this.clearSelected()
                }
            },
            clearSelected: function () {
                this.selected.count = 0
                this.selected.list = []
                for(let item of this.showList) {
                    vm.$set(item, 'selected', false)
                }
            },
            selectAll: function () {
                //选定所有项。
                for(let i of this.showList) {
                    vm.$set(i, 'selected', true)
                }
                this.selected.list = []
                for(let i = 0; i < this.showList.length; ++i) this.selected.list[i] = i
                this.selected.count = this.showList.length
            },
            selectNot: function () {
                //反转选择项。
                this.selected.count = this.showList.length - this.selected.count
                for(let i of this.showList) {
                    vm.$set(i, 'selected', !i['selected'])
                }
            },
            selectAddToTemp: function () {
                //将当前选择的所有项添加到临时文件夹。然后取消选定。
                //该操作仅在list模式下可用。
                if(this.viewFolder === 'list' && this.selected.count > 0) {
                    for(let sel of this.selected.list) {
                        let item = this.showList[sel]
                        this.addToTemp(this.items[item.index])
                    }
                    this.clearSelected()
                }
            },
            selectRemoveFromTemp: function() {
                //将当前选择的所有项移出临时文件夹。
                //该操作仅在temp模式下可用。
                if(this.viewFolder === 'temp' && this.selected.count > 0) {
                    let indexes = []
                    for(let sel of this.selected.list) {
                        let item = this.showList[sel]
                        indexes[indexes.length] = item.index
                    }
                    indexes.sort()
                    for(let i = indexes.length - 1; i >= 0; --i) {
                        this.temps.splice(indexes[i], 1)
                    }
                    this.loadListToPage()
                }
            },
            addToTemp: function(newItem) {
                for(let item of this.temps) {
                    if(item.id === newItem.id) {
                        return
                    }
                }
                vm.$set(this.temps, this.temps.length, newItem)
            },
            switchList: function (type) {
                //选择要展示的列表。
                if(type !== this.viewFolder) {
                    this.viewFolder = type
                    this.loadListToPage()
                    this.setTouchBar('standard')
                }
            },

            setTouchBar: function (state) {
                if(this.platform !== 'darwin') return;
                let win = getCurrentWindow()
                if(state === 'standard') {
                    //标准栏。显示选择模式、筛选、排序、视图、文件夹选择。会根据模式信息决定是不是显示筛选等，以及是否进入选择模式。
                    if(this.selected.mode) {
                        win.setTouchBar(new TouchBar({
                            items: [
                                new TouchBarButton({label: '取消选择模式', click: this.switchSelectMode}),
                                new TouchBarButton({label: '全选', click: this.selectAll}),
                                new TouchBarButton({label: '反选', click: this.selectNot}),
                                new TouchBarSpacer({size: 'flexible'}),
                                this.viewFolder === 'list' ?
                                    new TouchBarButton({label: '添加到临时文件夹', click: this.selectAddToTemp}):
                                    new TouchBarButton({label: '移出临时文件夹', click: this.selectRemoveFromTemp}),
                            ]
                        }))
                    }else{
                        win.setTouchBar(new TouchBar({
                            items: [
                                new TouchBarButton({label: '选择模式', click: this.switchSelectMode}),
                                new TouchBarSpacer({size: 'flexible'}),
                                this.viewFolder === 'list' ?
                                    new TouchBarButton({label: '临时文件夹', click: () => {this.switchList('temp')}}) :
                                    new TouchBarButton({label: '阅览列表', click: () => {this.switchList('list')}})
                            ]
                        }))
                    }
                }else{
                    win.setTouchBar(null)
                }
            }

        }
    })
}
//TODO 添加分页加载系统。一次只加载一部分内容，剩余内容通过点击"继续加载"加载或自动加载。

module.exports = mainModel