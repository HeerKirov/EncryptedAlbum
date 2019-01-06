const Vue = require('vue/dist/vue')

function helpModel(vueModel) {
    let db = vueModel.db
    let vm = new Vue({
        el: '#helpView',
        data: {
            visible: false,
            fullscreen: false
        },
        computed: {
            noTitleBar: function() {
                return this.fullscreen || db.platform.platform !== 'darwin'
            }
        },
        methods: {
            load: function () {
                db.ui.theme = 'white'
                this.visible = true
                if(db.ui.fullscreen) {this.enterFullScreen()} else {this.leaveFullScreen()}
            },
            leave: function () {
                this.visible = false
            },
            enterFullScreen: function() {
                this.fullscreen = true
            },
            leaveFullScreen: function() {
                this.fullscreen = false
            },

            goBack: function() {
                vueModel.route('main')
            },
            setTab: function (tab) {
                $('.nav-link').removeClass('active')
                $('.tab-pane').removeClass('active')
                $(`#${tab}-btn`).addClass('active')
                $(`#${tab}`).addClass('active')
            }
        }
    })
    return vm
}

module.exports = helpModel