const {ipcRenderer} = require('electron')
const {Vue} = require('../view.js/base')

let vm = new Vue({
    el: '#app',
    data: {
        /* 结果和状态都寄存到主进程。这样可以保持主页状态持久化。 */
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
            zoom: 5
        },
        searchTextInput: '',

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
            zoom: 5
        },
        searchText: '',

        viewFolder: 'list', //list or temp
        showList: [],    //绑定在前端展示的列表。包含dataURL。
        items: [],      //用于保存当前正在查询的列表。在被正式上载之前不含dataURL。
        temps: [],      //用于保存临时文件夹。

        dataCache: {}   //缓存最近使用过的dataURL。
    },
    methods: {
        load: function() {
            ipcRenderer.sendSync('load-engine')
            this.loadCacheFromMain()
            if(this.viewFolder === 'list') this.search()
            this.loadTempsFromMain()
            this.loadListToPage()
        },
        add: function() {
            ipcRenderer.sendSync('goto', 'add')
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
            this.view.aggregateByCollection = this.viewInput.aggregateByCollection
            this.view.showTitle = this.viewInput.showTitle
            this.view.zoom = this.viewInput.zoom
            ipcRenderer.sendSync('save-main-cache', {view: this.view})
            //TODO 将效果触发
        },
        saveOptionFromSearch: function () {
            this.searchText = this.searchTextInput
            this.search()
            this.loadListToPage()
        },
        //加载时用于从主进程加载
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
            if(this.viewFolder === 'list') {
                this.showList = this.items
                for(let image of this.items) {
                    if(image.buffer === undefined || image.buffer === null) {
                        if(image.id in this.dataCache) {
                            image.buffer = this.dataCache[image.id]
                            this.refreshShowList()
                        }else{
                            ipcRenderer.once('load-image-url-await-' + image.id, (e, arg) => {
                                image.buffer = arg
                                this.dataCache[image.id] = arg
                                this.refreshShowList()
                            })
                            ipcRenderer.send('load-image-url-async', {id: image.id, specification: 'Exhibition', awaitId: image.id})
                        }
                    }
                }
            }else{
                //TODO
            }
        },
        refreshShowList: function () {
            let m = this.showList
            this.showList = null
            this.showList = m
        }
        /*
            option list temp的缓存策略：
            1。 option将在saveOption时实时更新到主线程进行缓存。
            2。 list会在触发查询时在主线程自动缓存。
            3。 temp会在每次有改动操作时更新到主线程缓存。
            4。在load页面时统一加载一次上述缓存。
            image data的缓存策略：
            1。 获取时自动从主线程拉取，并缓存到本地的一个cache。
            2。 控制cache的大小。超过一定数量时自动清除一部分早先添加的。
         */

    }
})

vm.load()