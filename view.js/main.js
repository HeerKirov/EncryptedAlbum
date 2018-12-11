const {ipcRenderer} = require('electron')
const {Vue} = require('../view.js/base')

let vm = new Vue({
    el: '#app',
    data: {
        /* 结果和状态都寄存到主进程。这样可以保持主页状态持久化。 */
    },
    methods: {
        load: function() {
            ipcRenderer.sendSync('load-engine')
        },
        add: function() {
            ipcRenderer.sendSync('goto', 'add')
        }
    }
})

vm.load()