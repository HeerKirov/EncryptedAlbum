import { Size } from "electron"
import {containsAll, containsElement, findLikeIn} from "./utils";

/**
 * 数据引擎的接口。
 * 由应用层调用，并由底层实现，同时实现缓存层。
 * 实现以下功能标准：
 * 1. 按照给定的筛选、排序条件，查找tags、images的item。
 * 2. (批量)删除items。包括其bitmap。
 * 3. (批量)更新items。包括其bitmap。
 * 4. (批量)新建items。包括其bitmap。
 * 5. 获取一份bitmap，并制定规格。bitmap需要被缓存。
 * 
 * tag使用string合并模式: `${type-flag}${title}`。
 * type-flag包括：
 *      # content
 *      @ author
 *      % type
 */
interface DataEngine {
    findImage(options?: ImageFindOption): Array<Image>
    createImage(images: Array<Image>): Array<Image>
    updateImage(images: Array<Image>): Array<Image>
    deleteImage(images: Array<Image | number>): number
    findTag(options?: TagFindOption): Array<string>
    getNextId(): number

    saveImageURL(id: number, dataURL: string, callback?: () => void): void
    loadImageURL(id: number, specification?: ImageSpecification, callback?: (string) => void): void

    getConfig(key: string): any
    putConfig(key: string, value: any): void
    existConfig(key: string): boolean

    connect?(): boolean
    close?(): void

    load?(): boolean
    save?(): void
}

interface ImageFindOption {
    search?: string,
    order?: string[],
    desc?: boolean,
    id_eq?: number,
    id_in?: number[],
    title_eq?: string,
    collection_eq?: string,
    tag_contains?: string[],
    favorite_eq?: boolean,
    createTime_le?: number,
    createTime_ge?: number
}

interface TagFindOption {
    search?: string,
    order?: string[],
    desc?: boolean,
    type_eq?: string,
    title_eq?: string
}

enum ImageSpecification {
    Thumbnail,
    Exhibition,
    Origin
}

interface Image {
    id?: number
    title: string
    collection: string
    tags: Array<string>
    favorite: boolean
    links: Array<string>
    resolution: Size,
    createTime: number
}

function caseImage(image: Image, option: ImageFindOption): boolean {
    if(option.id_eq && image.id !== option.id_eq) return false
    else if(option.id_in && (!containsElement(image.id, option.id_in))) return false
    else if(option.title_eq && image.title !== option.title_eq) return false
    else if(option.collection_eq && image.collection !== option.collection_eq) return false
    else if(option.tag_contains && (!containsAll(image.tags, option.tag_contains))) return false
    else if(option.favorite_eq && image.favorite !== option.favorite_eq) return false
    else if(option.createTime_ge && image.createTime < option.createTime_ge) return false
    else if(option.createTime_le && image.createTime > option.createTime_le) return false
    else return !(option.search && (!findLikeIn(option.search, [image.title, image.collection])));
}
function sortImage(images: Image[], order: string[], desc: boolean): Image[] {
    let gt = desc ? -1 : 1
    let lt = desc ? 1 : -1
    images.sort((a, b) => {
        for(let field of order) {
            if(field === 'id') {
                if(a.id !== b.id) return a.id > b.id ? gt : lt
            }else if(field === 'title') {
                let titleA = a.title ? a.title : a.collection ? a.collection : null
                let titleB = b.title ? b.title : b.collection ? b.collection : null
                if(titleA !== titleB) return titleA.localeCompare(titleB, 'zh') > 0 ? gt : lt
            }else if(field === 'favorite') {
                if(a.favorite !== b.favorite) return a.favorite ? gt : lt
            }else if(field === 'resolution') {
                let areaA = a.resolution.width * a.resolution.height
                let areaB = b.resolution.width * b.resolution.height
                if(areaA !== areaB) return areaA > areaB ? gt : lt
            }else if(field === 'createTime') {
                if(a.createTime !== b.createTime) return a.createTime > b.createTime ? gt : lt
            }
        }
        return 0
    })
    return images
}

function caseTag(tag: string, option: TagFindOption): boolean {
    if(option.type_eq && tag.substring(0, 1) !== option.type_eq) return false
    else if(option.title_eq && tag.substring(1) !== option.title_eq) return false
    else return !(option.search && (!findLikeIn(option.search, [tag.substring(1)])))
}
function sortTag(tags: string[], order: string[], desc: boolean): string[] {
    let gt = desc ? -1 : 1
    let lt = desc ? 1 : -1
    tags.sort((a, b) => {
        for(let field of order) {
            if(field === 'type') {
                let tA = a.substring(0, 1), tB = b.substring(0, 1)
                if(tA !== tB) return tA > tB ? gt : lt
            }else if(field === 'title') {
                let tA = a.substring(1), tB = b.substring(1)
                if(tA !== tB) return tA.localeCompare(tB, 'zh') > 0 ? gt : lt
            }
        }
        return 0
    })
    return tags
}
export {DataEngine, ImageSpecification, ImageFindOption, TagFindOption, Image, caseImage, sortImage, caseTag, sortTag}