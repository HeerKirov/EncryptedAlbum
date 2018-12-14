const {ipcRenderer} = require('electron')
const {Vue} = require('../view.js/base')

let vm = new Vue({
    el: '#app',
    data: {
        /* 结果和状态都寄存到主进程。这样可以保持主页状态持久化。 */
        filterInput: {
            favorite: false,
            tags: []
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
        viewFolder: 'list', //list or temp
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
        items: [],
        dataCache: {}
    },
    methods: {
        load: function() {
            ipcRenderer.sendSync('load-engine')
            //TODO 从主进程加载main页面持久化的filter/sort/view/viewFolder状态，并根据这个状态重查列表
            //TODO 临时文件夹也在主线程持久化。需要的话也要查。
        },
        add: function() {
            ipcRenderer.sendSync('goto', 'add')
        },

    }
})

vm.load()