import { NativeImage } from "electron";
import { ImageSpecification } from "./engine";

const EXHIBITION_AREA_MAX = Math.pow(2, 20)
const THUMBNAIL_AREA_MAX = Math.pow(2, 16)

function translateSquare(origin: NativeImage): NativeImage {
    let size = origin.getSize()
    if(size.width > size.height) {
        return origin.crop({x: Math.floor((size.width - size.height) / 2), y: 0, width: size.height, height: size.height})
    }else if(size.width < size.height){
        return origin.crop({x: 0, y: Math.floor((size.height - size.width) / 2), width: size.width, height: size.width})
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
 * Exhibition: 保持长宽比不变。使其像素面积不超过2^20.
 * Thumbnail: 裁切位于图片正中心的最大矩形，并使其像素面积不超过2^16.
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

export {translateNativeImage}