import {remote, ipcRenderer} from 'electron'
import {AppStorage} from '../common/appStorage'
import {LocalFormula} from '../common/localEngine'
import {uuid} from '../util/string'
import {CommonModel, CommonDB} from './model'
const {TouchBar} = remote
const {TouchBarButton, TouchBarSpacer} = TouchBar
const Vue = require('vue/dist/vue')

function registerModel(vueModel: CommonModel) {
    let db: CommonDB = vueModel.db
    return new Vue({
        el: '#registerView',
        data: {
            visible: false,
            step: 0,
            error: '',

            password: '',
            checkPassword: '',
            key: ''
        },
        methods: {
            load: function() {
                db.ui.theme = 'white'
                this.visible = true
                this.step = 1
            },
            leave: function () {
                this.visible = false
            },
            nextStep: function () {
                if(this.step === 1) {
                    this.step ++
                }else if(this.step === 2) {
                    if(this.password !== this.checkPassword) {
                        this.error = 'not-eq-passwd'
                    }else{
                        this.error = ''
                        this.step ++
                        this.key = uuid(32, 16)
                    }
                }else if(this.step === 3){
                    if(this.key === '') {
                        this.error = 'empty-key'
                    }else{
                        let result = AppStorage.initialize(this.password, new LocalFormula('main', this.key as string,
                            db.platform.debug ? `./data/local` : `${db.platform.userData}/local`))
                        if(result) {
                            db.storage = result
                            this.error = ''
                            this.step ++
                        }else{
                            this.error = 'unknown'
                        }
                    }
                }else{//4
                    db.password = this.password
                    ipcRenderer.send('save-cache', {password: db.password})
                    vueModel.route('main')
                }
            },
            setTouchBar: function (value) {
                if(db.platform.platform !== 'darwin') return;
                if(value === 0) {
                    vueModel.setTouchBar(null)
                }else{
                    let items = [new TouchBarSpacer({size: "flexible"})]
                    if(value === 3) {
                        items[items.length] = new TouchBarButton({
                            label: '上一步',
                            click: () => {
                                this.step --
                            }
                        })
                    }
                    if(value === 1) {
                        items[items.length] = new TouchBarButton({
                            label: '开　始',
                            backgroundColor: '#007BFF',
                            click: this.nextStep
                        })
                    }else if(value === 2 || value === 3) {
                        items[items.length] = new TouchBarButton({
                            label: '下一步',
                            backgroundColor: '#007BFF',
                            click: this.nextStep
                        })
                    }else if(value === 4) {
                        items[items.length] = new TouchBarButton({
                            label: '完　成',
                            backgroundColor: '#007BFF',
                            click: this.nextStep
                        })
                    }
                    items[items.length] = new TouchBarSpacer({size: "large"})
                    items[items.length] = new TouchBarSpacer({size: "large"})

                    vueModel.setTouchBar(new TouchBar({items: items}))
                }
            }
        },
        watch: {
            step: function (value) {
                this.setTouchBar(value)
            }
        }
    })
}

module.exports = registerModel