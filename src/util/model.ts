import {Illustration, Image} from '../common/engine'
import {Arrays} from './collection'


function matchExistTextPureIllustration(illust: Illustration, str: string): boolean {
    if(illust.title.indexOf(str) >= 0) return true
    for(let tag of illust.tags) {
        if(tag.indexOf(str) >= 0) return true
    }
    return false
}
function matchExistTextPureImage(image: Image, str: string): boolean {
    if(image.subTitle.indexOf(str) >= 0) return true
    for(let tag of image.subTags) {
        if(tag.indexOf(str) >= 0) return true
    }
    return false
}

class Illustrations {
    static empty(): Illustration {
        return {
            id: undefined,
            title: '',
            tags: [],
            links: [],
            createTime: undefined,
            images: []
        }
    }
    static cloneIllustration(illust: Illustration): Illustration {
        return {
            id: illust.id || undefined,
            title: illust.title,
            tags: Arrays.clone(illust.tags),
            links: Arrays.clone(illust.links),
            createTime: illust.createTime,
            images: Arrays.map(illust.images, (image) => Images.cloneImage(image))
        }
    }
    static cloneIllustrationExcludeImage(illust: Illustration): Illustration {
        return {
            id: illust.id || undefined,
            title: illust.title,
            tags: Arrays.clone(illust.tags),
            links: Arrays.clone(illust.links),
            createTime: illust.createTime,
            images: []
        }
    }

    static containsAllTags(illust: Illustration, tags: string[]): boolean {
        if(!tags) return true
        for(let match of tags) {
            if(Arrays.contains(illust.tags, match)) continue
            let flag = false
            for(let image of illust.images) {
                if(Arrays.contains(image.subTags, match)) {
                    flag = true
                    break
                }
            }
            if(!flag) return false
        }
        return true
    }
    static matchSearchText(illust: Illustration, search: string): boolean {
        if(search) {
            let parts = search.split(' ')
            for(let part of parts) {
                if(!matchExistTextPureIllustration(illust, part)) {
                    return false
                }
                let flag = false
                for(let image of illust.images) {
                    if(!matchExistTextPureImage(image, part)) {
                        flag = false
                        break
                    }
                }
                if(flag) {
                    return false
                }
            }
        }
        return true
    }
}

class Images {
    static empty(): Image {
        return {
            id: undefined,
            index: undefined,
            subTitle: null,
            subTags: [],
            createTime: undefined,
            resolution: null
        }
    }
    static cloneImage(image: Image) : Image {
        return {
            id: image.id || undefined,
            index: image.index,
            subTitle: image.subTitle,
            subTags: Arrays.clone(image.subTags),
            resolution: {width: image.resolution.width, height: image.resolution.height},
            createTime: image.createTime
        }
    }
    static equals(a: Image, b: Image): boolean {
        if(a && b) {
            return a.id === b.id &&
                a.index === b.index &&
                a.resolution.height === b.resolution.height &&
                a.resolution.width === b.resolution.width &&
                a.subTitle === b.subTitle &&
                Arrays.equal(a.subTags, b.subTags)
        }
        return false
    }

    static containsAllTags(image: Image, illust: Illustration, tags: string[]): boolean {
        if(!tags) return true
        for(let match of tags) {
            if(!Arrays.contains(illust.tags, match) && !Arrays.contains(image.subTags, match)) return false
        }
        return true
    }
    static matchSearchText(image: Image, illust: Illustration, search: string): boolean {
        if(search) {
            let parts = search.split(' ')
            for(let part of parts) {
                if(!(matchExistTextPureIllustration(illust, part) || matchExistTextPureImage(image, part))) return false
            }
        }
        return true
    }
}

class Tags {
    static tag(type: string, name: string): string {
        return type && name ? `${type}:${name}` : null
    }
    static getTagName(tag: string): string {
        return tag ? tag.split(':', 2)[1] : null
    }
    static getTagType(tag: string): string {
        return tag ? tag.split(':', 2)[0] : null
    }

    static matchSearchText(tag: string, search: string) {
        if(search) {
            let middle = tag.indexOf(':')
            let parts = search.split(' ')
            for(let part of parts) {
                if(tag.indexOf(part) > middle) return true
            }
            return false
        }
        return true
    }

}

export {Illustrations, Images, Tags}