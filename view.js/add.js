const {ipcRenderer} = require('electron')
const {Vue} = require('../view.js/base')

let vm = new Vue({
    el: '#app',
    data: {

    },
    methods: {
        goBack: function() {
            ipcRenderer.send('goto', 'main')
        },
        addGeneral: function() {
            
        }
    }
})