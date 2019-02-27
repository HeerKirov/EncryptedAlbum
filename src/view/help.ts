import {CommonModel, CommonDB} from './model'
const Vue = require('vue/dist/vue')
const $ = window['$']

function helpModel(vueModel: CommonModel) {
    let db: CommonDB = vueModel.db
    return new Vue({
        el: '#helpView',
        data: {
            visible: false,
            fullscreen: false
        },
        computed: {
            noTitleBar() {
                return this.fullscreen || db.platform.platform !== 'darwin'
            },
            platformName () {
                return db.platform.platform
            }
        },
        methods: {
            load() {
                db.ui.theme = 'white'
                this.visible = true
                if(db.ui.fullscreen) {this.enterFullScreen()} else {this.leaveFullScreen()}
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

            goBack() {
                vueModel.routeBack()
            },
            setTab (tab) {
                $('.nav-link').removeClass('active')
                $('.tab-pane').removeClass('active')
                $(`#${tab}-btn`).addClass('active')
                $(`#${tab}`).addClass('active')
            }
        }
    })
}

module.exports = helpModel