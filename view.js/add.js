const {ipcRenderer} = require('electron')
const {Vue} = require('../view.js/base')

new Vue({
    el: '#app',
    data: {
        items: [],
        currentIndex: 0,
        current: {
            title: null,
            collection: null,
            tags: [],
            links: [],
            favorite: false,
            resolution: { width: 0, height: 0 },
            dataURL: '',
        },
        tags: [],
        newTagInput: '',
        newTagSelect: '#',
        currentIndexInput: '0'
    },
    computed: {
        showNavigator: function() {
            return this.items.length > 1
        },
        emptyList: function () {
            return this.items.length === 0
        },
        resolution: function () {
            if(this.current != null && this.current.resolution != null) {
                return this.current.resolution.width + '×' + this.current.resolution.height
            }else{
                return ''
            }
        },
        canPrev: function () {
            return this.currentIndex > 0
        },
        canNext: function () {
            return this.currentIndex < this.items.length - 1
        }
    },
    methods: {
        goBack: function() {
            ipcRenderer.send('goto', 'main')
        },
        addGeneral: function() {
            
        },
        addPixiv: function() {

        },
        addURL: function() {

        },
        removeItem: function() {
            this.items = this.items.splice(this.currentIndex, 1)
            if(this.currentIndex > 0) {
                this.currentIndex = this.currentIndex - 1
            }
            this.currentIndexInput = this.currentIndex + 1
            this.current = this.items[this.currentIndex]
        },
        save: function () {
            
        },
        toPage: function(index) {
            if(index >= 0 && index < this.current.items.length) {
                this.currentIndex = index
                this.currentIndexInput = index + 1
                this.current = this.items[index]
            }
        },
        getTagType: function (tag) {
            let flag = tag.slice(0, 1)
            return {
                'badge-warning': flag === '@',
                'badge-info': flag === '%',
                'badge-success': flag === '#'
            }
        },
        getTagName: function (tag) {
            return tag.slice(1)
        },
        addNewTag: function () {
            let newTag = this.newTagSelect + this.newTagInput
            if(!(newTag in this.current.tags)) {
                let tags = this.current.tags
                tags[tags.length] = newTag
                this.current.tags = tags
            }
            this.newTagInput = ''
        },
        addOldTag: function(tag) {
            if(!(tag in this.current.tags)) {
                let tags = this.current.tags
                tags[tags.length] = tag
                this.current.tags = tags
            }
        },
        removeTag: function(tag) {
            for(let i in this.current.tags) {
                if(this.current.tags[i] === tag) {
                    this.current.tags = this.current.tags.splice(i, 1)
                    break;
                }
            }
        },
        addNewLink: function () {
            let links = this.current.links
            links[links.length] = {name: ''}
            this.current.links = links
        },
        removeLink: function (index) {
            let links = this.current.links
            if(index < links.length) {
                this.current.links = links.splice(index, 1)
            }
        }
    }
})