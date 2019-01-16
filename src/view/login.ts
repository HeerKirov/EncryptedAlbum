import {ipcRenderer, remote} from 'electron'
import {AppStorage} from '../common/appStorage'
const {TouchBar} = remote
const {TouchBarButton, TouchBarSpacer} = TouchBar
const Vue = require('vue/dist/vue')

function loginModel(vueModel) {
    let db = vueModel.db
    return new Vue({
        el: '#loginView',
        data: {
            visible: false,
            error: '',
            password: ''
        },
        methods: {
            load: function() {
                db.ui.theme = 'white'
                this.visible = true
                vueModel.setTouchBar(new TouchBar({
                    items: [
                        new TouchBarSpacer({size: 'flexible'}),
                        new TouchBarButton({label: 'GO', backgroundColor: '#28A745', click: this.loginGo})
                    ]
                }))
            },
            leave: function () {
                this.visible = false
            },
            loginGo: function() {
                if(this.password === '') {
                    this.error = 'empty-passwd'
                }else{
                    let result = AppStorage.authenticate(this.password)
                    if(result) {
                        db.password = this.password
                        db.storage = result
                        ipcRenderer.send('save-cache', {password: db.password})
                        vueModel.route('main')
                    }else{
                        this.error = 'wrong-passwd'
                    }
                }
            }
        }
    })
}

module.exports = loginModel