const {containsElement} = require('../target/common/utils')
const {ImageSpecification} = require("../target/common/engine")
const {exportImage} = require('../target/common/imageTool')
const {remote, ipcRenderer} = require('electron')
const {TouchBar, dialog} = remote
const {TouchBarButton, TouchBarSpacer} = TouchBar
const Vue = require('vue/dist/vue')

function mainModel(vueModel) {
    let db = vueModel.db
    let loadLock = false
    let vm = new Vue({
        el: '#mainView',
        data: {
            visible: false,
            fullscreen: false,
            //绑定展示页面空间的option数据项
            filterInput: {
                favorite: false,
                tags: [],
                tagSearchText: '',
                existTags: [],
                existTagsAll: []
            },
            sortInput: {
                by: 'createTime',
                desc: true
            },
            viewInput: {
                aggregateByCollection: false,
                showTitle: false,
                zoom: 4,
                loadNum: 40
            },
            searchTextInput: '',
            //绑定实际使用的option数据项
            filter: {
                favorite: false,
                tags: []
            },
            sort: {
                by: 'createTime',
                desc: true
            },
            view: {
                aggregateByCollection: false,
                showTitle: false,
                zoom: 4,
                loadNum: 40
            },
            searchText: '',
            //绑定选择功能
            selected: {
                mode: false,
                count: 0,
                list: []
            },
            //绑定导出功能
            exportPanel: {
                items: [],   //{id: number, title: string, collection: string}
                ext: 'jpg',
                path: ''
            },
            //绑定内容展示列表和区分
            viewFolder: 'list', //list or temp
            showBackend: [],  //用于绑定展示列表的全部表，仅包含数据表，不做查询。这一层用于缓冲查询和显示。
            showList: [],    //绑定在前端展示的列表。包含dataURL。
            showRecord: 0,   //用于标记已经从showBackend中加载的数量。
            items: [],      //用于保存当前正在查询的列表。在被正式上载之前不含dataURL。
            temps: []      //用于保存临时文件夹。
        },
        computed: {
            noTitleBar: function() {
                return this.fullscreen || db.platform.platform !== 'darwin'
            },
            leastSelectOne: function () {
                return this.selected.mode && this.selected.count > 0
            },
            canLoadFromBackend: function () {
                return this.showBackend.length > this.showList.length
            }
        },
        methods: {
            load: function() {
                db.ui.theme = 'gray'
                this.visible = true
                if(db.ui.fullscreen) {this.enterFullScreen()} else {this.leaveFullScreen()}
                if(db.engine == null) {
                    db.engine = db.storage.loadMainEngine()
                    db.engine.connect()
                }
                if(db.engine.existConfig('view')) {
                    this.view = db.engine.getConfig('view')
                    this.loadOptionToSearch()
                }
                this.setTouchBar()
                if(this.viewFolder === 'list') this.search()
                this.loadTempsFromMain()
                this.loadListToPage()
                this.filterInput.existTags = this.filterInput.existTagsAll = db.engine.findTag({order: ['type', 'title']})
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
                vueModel.route('add')
            },
            setting: function() {
                vueModel.route('setting')
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
                this.viewInput.loadNum = this.view.loadNum
            },
            loadOptionToSearch: function() {
                this.searchTextInput = this.searchText
            },
            saveOptionFromFilter: function () {
                this.filter.favorite = this.filterInput.favorite
                let tags = []
                for(let i = 0; i < this.filterInput.tags.length; ++i) tags[i] = this.filterInput.tags[i]
                this.filter.tags = tags
                this.search()
                this.loadListToPage()
            },
            saveOptionFromSort: function () {
                this.sort.by = this.sortInput.by
                this.sort.desc = this.sortInput.desc
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
                this.view.loadNum = this.viewInput.loadNum
                db.engine.putConfig('view', this.view)
                db.engine.save()
            },
            saveOptionFromSearch: function () {
                this.searchText = this.searchTextInput
                this.search()
                this.loadListToPage()
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
            searchFilterTags: function() {
                let text = this.filterInput.tagSearchText.trim()
                if(text !== '') {
                    let tags = []
                    for(let tag of this.filterInput.existTagsAll) {
                        if(tag.indexOf(text) >= 0) {
                            tags[tags.length] = tag
                        }
                    }
                    this.filterInput.existTags = tags
                }else{
                    this.filterInput.existTags = this.filterInput.existTagsAll
                }
            },
            addFilterTag: function(tag) {
                if(!containsElement(tag, this.filterInput.tags)) {
                    this.$set(this.filterInput.tags, this.filterInput.tags.length, tag)
                }
            },
            removeFilterTag: function(index) {
                if(index >= 0 && index < this.filterInput.tags.length) {
                    this.filterInput.tags.splice(index, 1)
                }
            },

            loadTempsFromMain: function() {
                //从主线程加载临时文件夹。
                let {temps} = ipcRenderer.sendSync('load-cache', ['temps'])
                if(temps) {
                    this.temps = db.engine.findImage({id_in: temps})
                }
            },
            saveTempsToMain: function() {
                let ids = []
                for(let item of this.temps) {
                    ids[ids.length] = item.id
                }
                ipcRenderer.sendSync('save-cache', {temps: ids})
            },

            search: function () {
                //提交一次查询操作。
                let findOption = {}
                if(this.searchText) findOption['search'] = this.searchText
                if(this.sort.by) findOption['order'] = [this.sort.by]
                findOption['desc'] = this.sort.desc
                if(this.filter.favorite) findOption['favorite_eq'] = true
                if(this.filter.tags) findOption['tag_contains'] = this.filter.tags
                this.items = db.engine.findImage(findOption)
            },
            loadListToPage: function () {
                //此函数根据viewFolder的类型，将items或temps加载到showBackend。
                this.clearSelected()
                this.showList = []
                this.showBackend = this.viewFolder === 'list' ? this.items : this.temps
                if(this.view.aggregateByCollection) {
                    //聚合规范：
                    //  在list -> showBackend的过程中聚合；
                    //  将被聚合的条目，会在showBackend中被记录为数组，而不是Image模型。
                    //  这个数据包含所有聚合的Image。优先保持id小的在前。
                    //  查询图片按照最靠前的那一个id查询。
                    //  前端绑定最靠前的那一个模型，且绑定collection名而不是title。
                    let aggregations = []
                    let collectionFlag = {}
                    for(let i in this.showBackend) {
                        let item = this.showBackend[i]
                        if(item.collection && item.collection in collectionFlag) {
                            let idx = collectionFlag[item.collection]
                            let partition = aggregations[idx]
                            let insertPosition = 0
                            for(; insertPosition < partition.length; ++insertPosition) {
                                if(partition[insertPosition].id >= item.id) break
                            }
                            partition.splice(insertPosition, 0, item)
                        }else{
                            collectionFlag[item.collection] = aggregations.length
                            aggregations[aggregations.length] = [item]
                        }
                    }
                    this.showBackend = aggregations
                }
                this.continueToPage()
            },
            continueToPage: function() {
                //这将控制继续将剩余的列表加载到showList.
                if(!loadLock){
                    loadLock = true
                    let remain = this.showBackend.length - this.showList.length
                    if(remain > 0) {
                        let begin = this.showList.length
                        let max = this.view.loadNum === '*' ? null : parseInt(this.view.loadNum)
                        for(let i = 0; i < remain; ++i) {
                            if(max && i >= max) break;
                            let index = i + begin
                            let image = this.view.aggregateByCollection ? this.showBackend[index][0] : this.showBackend[index]
                            if(image.buffer === undefined || image.buffer === null) {
                                db.engine.loadImageURL(image.id, ImageSpecification.Exhibition, (data) => {
                                    let newSet = {
                                        buffer: data,
                                        title: this.view.aggregateByCollection && image.collection ? image.collection : image.title ? image.title : image.collection,
                                        selected: false,
                                        col: this.view.aggregateByCollection && this.showBackend[index].length > 1,
                                        id: image.id,
                                        index: index
                                    }
                                    vm.$set(this.showList, index, newSet)
                                })
                            }
                        }
                    }
                    loadLock = false
                }
            },
            selectOne: function(index, k) {
                //单击一张图片。
                if(this.selected.mode) {
                    //单击选定|取消选定某一个index上的项。
                    this.$set(this.showList[index], 'selected', !this.showList[index].selected)
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
                }else if(k === 'right') {
                    //右键进入选择模式同时选中。
                    if(!this.selected.mode) this.selected.mode = true
                    this.selectOne(index, k)
                }else{
                    //单击进入阅览模式。
                    vueModel.route('detail', {
                        list: this.showBackend,
                        index: index,
                        aggregate: this.view.aggregateByCollection
                    })
                }
            },
            switchSelectMode: function() {
                this.selected.mode = !this.selected.mode
                this.setTouchBar()
                if(!this.selected.mode) {
                    this.clearSelected()
                }
            },
            clearSelected: function () {
                this.selected.count = 0
                this.selected.list = []
                for(let item of this.showList) {
                    this.$set(item, 'selected', false)
                }
            },
            selectAll: function () {
                //选定所有项。
                for(let i of this.showList) {
                    this.$set(i, 'selected', true)
                }
                this.selected.list = []
                for(let i = 0; i < this.showList.length; ++i) this.selected.list[i] = i
                this.selected.count = this.showList.length
            },
            selectNot: function () {
                //反转选择项。
                this.selected.count = this.showList.length - this.selected.count
                let oldList = this.selected.list
                this.selected.list = []
                for(let i = 0; i < this.showList.length; ++i) {
                    if(!containsElement(i, oldList)) {
                        this.selected.list[this.selected.list.length] = i
                    }
                }
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
                        if(this.view.aggregateByCollection) {
                            for(let i in this.showBackend[item.index]) {
                                this.addToTemp(this.showBackend[item.index][i])
                            }
                        }else{
                            this.addToTemp(this.showBackend[item.index])
                        }
                    }
                    this.clearSelected()
                    this.saveTempsToMain()
                }
            },
            selectRemoveFromTemp: function() {
                //将当前选择的所有项移出临时文件夹。
                //该操作仅在temp模式下可用。
                if(this.viewFolder === 'temp' && this.selected.count > 0) {
                    let indexes = []
                    for(let sel of this.selected.list) {
                        let item = this.showList[sel]
                        if(this.view.aggregateByCollection) {
                            for(let i in this.showBackend[item.index]) {
                                indexes[indexes.length] = this.showBackend[item.index][i].id
                            }
                        }else{
                            indexes[indexes.length] = this.showBackend[item.index].id
                        }

                    }
                    indexes.sort((a, b) => a === b ? 0 : a < b ? -1 : 1)
                    this.removeFromTemp(indexes)
                    for(let i = indexes.length - 1; i >= 0; --i) {
                        this.temps.splice(indexes[i], 1)
                    }
                    this.saveTempsToMain()
                    this.loadListToPage()
                }
            },
            addToTemp: function(newItem) {
                for(let item of this.temps) {
                    if(item.id === newItem.id) {
                        return
                    }
                }
                this.$set(this.temps, this.temps.length, newItem)
            },
            removeFromTemp: function(removeIds) {
                for(let i = removeIds.length - 1; i >= 0; --i) {
                    for(let j = this.temps.length - 1; j >= 0; --j) {
                        if(this.temps[j].id === removeIds[i]) {
                            this.temps.splice(j, 1)
                            break
                        }
                    }
                }
            },
            switchList: function (type) {
                //选择要展示的列表。
                if(type !== this.viewFolder) {
                    this.viewFolder = type
                    this.loadListToPage()
                    this.setTouchBar()
                }
            },
            selectToView: function() {
                if(this.selected.count > 0) {
                    let items = []
                    for(let sel of this.selected.list) {
                        let item = this.showList[sel]
                        if(this.view.aggregateByCollection) {
                            for(let i in this.showBackend[item.index]) {
                                items[items.length] = this.showBackend[item.index][i]
                            }
                        }else{
                            items[items.length] = this.showBackend[item.index]
                        }
                    }
                    vueModel.route('detail', {
                        list: items,
                        index: 0,
                        aggregate: false
                    })
                }
            },
            selectToDelete: function() {
                if(this.selected.count > 0) {
                    let items = []
                    for(let sel of this.selected.list) {
                        let item = this.showList[sel]
                        if(this.view.aggregateByCollection) {
                            for(let i in this.showBackend[item.index]) {
                                items[items.length] = this.showBackend[item.index][i]
                            }
                        }else{
                            items[items.length] = this.showBackend[item.index]
                        }
                    }
                    let successNum = db.engine.deleteImage(items)
                    if(successNum > 0) {
                        db.engine.save()
                        this.search()
                        this.loadListToPage()
                    }
                }
            },
            selectToExport: function() {
                if(this.selected.count > 0) {
                    dialog.showOpenDialog(db.currentWindow, {
                        title: '选择导出的文件夹',
                        buttonLabel: '选择此位置',
                        properties: ['openDirectory', 'createDirectory']
                    }, (path) => {
                        if(path) {
                            this.exportPanel.path = path[0]
                            let items = []
                            let titles = {}
                            for(let sel of this.selected.list) {
                                let item = this.showList[sel]
                                if(this.view.aggregateByCollection) {
                                    for(let i in this.showBackend[item.index]) {
                                        let image = this.showBackend[item.index][i]
                                        let title = image.title ? image.title : image.collection ? image.collection : ''
                                        if(title in titles) titles[title] += 1
                                        else titles[title] = 1
                                        items[items.length] = {id: image.id, title: title}
                                    }
                                }else{
                                    let image = this.showBackend[item.index]
                                    let title = image.title ? image.title : image.collection ? image.collection : ''
                                    if(!(title in titles)) titles[title] = 'single'
                                    else titles[title] = 'multiple'
                                    items[items.length] = {id: image.id, title: title}
                                }
                            }
                            for(let item of items) {
                                let flag = titles[item.title]
                                if(flag === 'single') {
                                    if(item.title === '') {
                                        item.title = '未命名'
                                    }
                                }else if(flag === 'multiple') {
                                    titles[item.title] = 1
                                    if(item.title === '') {
                                        item.title = '1'
                                    }else{
                                        item.title = item.title + '1'
                                    }
                                }else{
                                    titles[item.title] += 1
                                    if(item.title === '') {
                                        item.title = titles[item.title]
                                    }else{
                                        item.title = item.title + titles[item.title]
                                    }
                                }
                            }
                            this.exportPanel.items = items
                            $('#exportAllCheck').modal()
                        }
                    })
                }
            },
            selectToExportOk: function() {
                if(this.exportPanel.path && this.exportPanel.items.length) {
                    this.selectToExportFunction(0)
                }
            },
            selectToExportFunction: function(index) {
                if(index >= this.exportPanel.items.length) {
                    alert('图片导出成功。')
                }else{
                    let {id, title} = this.exportPanel.items[index]
                    db.engine.loadImageURL(id, ImageSpecification.Origin, (url) => {
                        let filename = `${this.exportPanel.path}/${title}.${this.exportPanel.ext}`
                        exportImage(url, filename, (success) => {
                            if(success) {
                                this.selectToExportFunction(index + 1)
                            }else{
                                alert(`导出[${title}.${this.exportPanel.ext}]时发生了未知的错误。`)
                            }
                        })
                    })
                }
            },

            setTouchBar: function () {
                if(db.platform.platform !== 'darwin') return;
                //标准栏。显示选择模式、筛选、排序、视图、文件夹选择。会根据模式信息决定是不是显示筛选等，以及是否进入选择模式。
                if(this.selected.mode) {
                    vueModel.setTouchBar(new TouchBar({
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
                    vueModel.setTouchBar(new TouchBar({
                        items: [
                            new TouchBarButton({label: '选择模式', click: this.switchSelectMode}),
                            new TouchBarSpacer({size: 'flexible'}),
                            this.viewFolder === 'list' ?
                                new TouchBarButton({label: '临时文件夹', click: () => {this.switchList('temp')}}) :
                                new TouchBarButton({label: '阅览列表', click: () => {this.switchList('list')}})
                        ]
                    }))
                }
            }
        }
    })
    return vm
}

module.exports = mainModel