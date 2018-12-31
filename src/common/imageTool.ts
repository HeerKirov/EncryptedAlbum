import {NativeImage, nativeImage} from "electron"
import {ImageSpecification} from "./engine"
import {writeFile} from 'fs'

const PREFIX = 'data:image/jpeg;base64,'
const PREFIX_LENGTH = PREFIX.length

const EXHIBITION_AREA_MAX = Math.pow(2, 20)
const THUMBNAIL_AREA_MAX = Math.pow(2, 16)

function translateSquare(origin: NativeImage): NativeImage {
    let {width, height} = origin.getSize()
    if(width > height) {
        return origin.crop({x: Math.floor((width - height) / 2), y: 0, width: height, height: height})
    }else if(width < height){
        return origin.crop({x: 0, y: Math.floor((height - width) / 2), width: width, height: width})
    }else{
        return origin
    }
}

function translateBelowArea(origin: NativeImage, max: number): NativeImage {
    let size = origin.getSize()
    let area = size.height * size.width
    if(area > max) {
        let rate = Math.sqrt(area / max)
        return origin.resize({width: Math.round(size.width / rate)})
    }else{
        return origin
    }
}

/**
 * 将指定的原图变换到需要的大小规格。
 * 变换规则：
 * Exhibition: 裁切位于图片正中心的最大矩形，使其像素面积不超过2^18.
 * Thumbnail: 裁切位于图片正中心的最大矩形，并使其像素面积不超过2^15.
 * @param origin 原图的NativeImage Object
 * @param specification 变换后的大小规格
 */
function translateNativeImage(origin: NativeImage, specification: ImageSpecification): NativeImage {
    switch(specification) {
        case ImageSpecification.Origin: 
            return origin
        case ImageSpecification.Exhibition:
            return translateBelowArea(translateSquare(origin), EXHIBITION_AREA_MAX)
        case ImageSpecification.Thumbnail:
            return translateBelowArea(translateSquare(origin), THUMBNAIL_AREA_MAX)
    }
}

function translateDataURL(originURL: string, specification: ImageSpecification): string {
    if(specification === ImageSpecification.Origin) {
        if(originURL.substr(0, PREFIX_LENGTH) !== PREFIX) {
            return PREFIX + originURL
        }
        return originURL
    }
    if(originURL.substr(0, PREFIX_LENGTH) === PREFIX) {
        originURL = originURL.substring(PREFIX_LENGTH)
    }
    let native = nativeImage.createFromBuffer(Buffer.from(originURL, 'base64'))
    return PREFIX + translateNativeImage(native, specification).toJPEG(80).toString('base64')
}

function exportImage(dataURL: string, filepath: string, callback?: (success: boolean) => void): void {
    if(dataURL.substr(0, PREFIX_LENGTH) === PREFIX) {
        dataURL = dataURL.substring(PREFIX_LENGTH)
    }
    let buf = Buffer.from(dataURL, 'base64')
    writeFile(filepath, buf, (e) => {
        callback(!e)
    })
}

function downloadImageDataURL(url: string, callback?: (dataURL: string, status?: number) => void): void {
    let xhr = new XMLHttpRequest()
    xhr.open('GET', url, true)
    xhr.responseType = 'blob'
    xhr.onload = function() {
        if(xhr.status === 200) {
            let blob = this.response
            let reader = new FileReader()
            reader.onload = (e) => {
                let dataURL = e.target['result']
                if(callback) callback(dataURL, 200)
            }
            reader.readAsDataURL(blob)
        }else{
            if(callback) callback(null, xhr.status)
        }
    }
    xhr.send()
}

export {translateNativeImage, translateDataURL, exportImage, downloadImageDataURL}