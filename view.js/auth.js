const electron = require('electron')
const {ipcRenderer} = electron
const {getCurrentWindow, TouchBar} = electron.remote
const {TouchBarButton, TouchBarSpacer} = TouchBar
const {Vue} = require('../view.js/base')
const {uuid} = require('../target/common/utils')

let vm = new Vue({
    el: '#app',
    data: {
        platform: null,
        status: 'loading',
        loginData: {
            password: '',
            error: ''
        },
        initData: {
            step: 0,
            password: '',
            checkPassword: '',
            formula: {
                key: ''
            },
            error: ''
        }
    },
    methods: {
        load: function() {
            this.platform = ipcRenderer.sendSync('platform').platform
            let status = ipcRenderer.sendSync('authenticate-status')
            if(status === "not-init") {
                this.initData.step = 1
                this.status = "init"
            }else if(status === "not-auth") {
                this.status = "login"
                this.setTouchBar("login")
            }else{//auth
                ipcRenderer.send('goto', 'main')
            }
        },
        initNextStep: function() {
            if(this.initData.step === 1) {
                this.initData.step ++
            }else if(this.initData.step === 2) {
                if(this.initData.password === '') {
                    this.initData.error = 'empty-passwd'
                }else if(this.initData.password !== this.initData.checkPassword) {
                    this.initData.error = 'not-eq-passwd'
                }else{
                    this.initData.error = ''
                    this.initData.step ++
                    this.initData.formula.key = uuid(32, 16)
                }
            }else if(this.initData.step === 3){
                if(this.initData.formula.key === '') {
                    this.initData.error = 'empty-key'
                }else{
                    let result = ipcRenderer.sendSync('initialize', {
                        password: this.initData.password,
                        formula: {
                            type: 'local',
                            id: 'main',
                            key: this.initData.formula.key,
                            storage: 'data/local'
                        }
                    })
                    if(result) {
                        this.initData.error = ''
                        this.initData.step ++
                    }else{
                        this.initData.error = 'unknown'
                    }
                }
            }else{//4
                this.setTouchBar(null)
                ipcRenderer.send('goto', 'main')
            }
        },
        loginGo: function() {
            if(this.loginData.password === '') {
                this.loginData.error = 'empty-passwd'
            }else{
                let result = ipcRenderer.sendSync('authenticate', this.loginData.password)
                if(result) {
                    this.setTouchBar(null)
                    ipcRenderer.sendSync('goto', 'main')
                }else{
                    this.loginData.error = 'wrong-passwd'
                }
            }
        },
        setTouchBar: function (state, value) {
            if(this.platform !== 'darwin') return;
            let win = getCurrentWindow()
            if(state === "init") {
                let items = [new TouchBarSpacer({size: "flexible"})]
                if(value === 3) {
                    items[items.length] = new TouchBarButton({
                        label: '上一步',
                        click: () => {
                            this.initData.step --
                        }
                    })
                }
                if(value === 1) {
                    items[items.length] = new TouchBarButton({
                        label: '开　始',
                        backgroundColor: '#007BFF',
                        click: this.initNextStep
                    })
                }else if(value === 2 || value === 3) {
                    items[items.length] = new TouchBarButton({
                        label: '下一步',
                        backgroundColor: '#007BFF',
                        click: this.initNextStep
                    })
                }else if(value === 4) {
                    items[items.length] = new TouchBarButton({
                        label: '完　成',
                        backgroundColor: '#007BFF',
                        click: this.initNextStep
                    })
                }
                items[items.length] = new TouchBarSpacer({size: "large"})
                items[items.length] = new TouchBarSpacer({size: "large"})

                win.setTouchBar(new TouchBar({
                    items: items
                }))
            }else if(state === "login") {
                win.setTouchBar(new TouchBar({
                    items: [
                        new TouchBarSpacer({size: "flexible"}),
                        new TouchBarButton({
                            label: 'Go',
                            backgroundColor: '#28A745',
                            click: this.loginGo
                        }),
                        new TouchBarSpacer({size: "large"}),
                        new TouchBarSpacer({size: "large"})
                    ]
                }))
            }else{
                win.setTouchBar(null)
            }
        }
    },
    watch: {
        'initData.step': function (value) {
            this.setTouchBar("init", value)
        }
    }
})
vm.load()