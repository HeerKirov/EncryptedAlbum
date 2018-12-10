const {ipcRenderer} = require('electron')
const {Vue} = require('../view.js/base')
const {uuid} = require('../target/common/utils')

let vm = new Vue({
    el: '#app',
    data: {
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
            let status = ipcRenderer.sendSync('authenticate-status')
            if(status === "not-init") {
                this.initData.step = 1
                this.status = "init"
            }else if(status === "not-auth") {
                this.status = "login"
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
                ipcRenderer.send('goto', 'main')
            }
        },
        loginGo: function() {
            if(this.loginData.password === '') {
                this.loginData.error = 'empty-passwd'
            }else{
                let result = ipcRenderer.sendSync('authenticate', this.loginData.password)
                if(result) {
                    ipcRenderer.sendSync('goto', 'main')
                }else{
                    this.loginData.error = 'wrong-passwd'
                }
            }
        }
    }
})
vm.load()