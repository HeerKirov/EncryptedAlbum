const {nativeImage} = require('electron')

let img = nativeImage.createFromPath("test.jpg")
let el = document.getElementById("i");
el['src'] = img.toDataURL();
