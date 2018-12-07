const {Vue} = require('../view.js/base')

let vm = new Vue({
    el: '#app',
    data: {
        message: 'Hello, World!'
    }
})
console.log('load complete')