import { Size } from "electron"
import {Strings} from "../util/string"
import {Arrays} from "../util/collection"
import {Illustrations, Images, Tags} from "../util/model"

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
    findIllustration(options: IllustrationFindOption): Illustration[]
    createOrUpdateIllustration(illustrations: Illustration[], imageIdVirtualReflect?: Object): Illustration[]
    deleteIllustration(illustrations: (Illustration | number)[]): number

    saveImageURL(id: number, dataURL: string, callback?: () => void): void
    loadImageURL(id: number, specification?: ImageSpecification, callback?: (string) => void): void

    findTag(options: TagFindOption): Array<string>

    getConfig(key: string): any
    putConfig(key: string, value: any): void
    existConfig(key: string): boolean

    connect?(): boolean
    close?(): void

    load?(): boolean
    save?(): void
}

enum ImageSpecification {
    Thumbnail,
    Exhibition,
    Origin
}

/**
 * Illustration option的解释：
 * 它主要分为两个部分，过滤和排序。此外，还有一个"按Image粒度细分"的选项。
 * 过滤：通过下面一组的字段进行过滤匹配。过滤将会受到粒度细粉的影响。在image粒度下，会针对image的部分选项细分决定是否提取某个image。
 * illust粒度下的匹配字段：
 *      id: 匹配illust.id
 *      title: 匹配illust.title
 *      tag: 匹配illust.tags与所有images.tags的并集
 *      favorite: 匹配illust.fav
 *      createTime: 匹配illust.createTime
 *      imageQuantity: 匹配illust.images.length
 * image粒度下，字段将产生不一样的匹配：
 *      id: 匹配image.id
 *      title: 优先匹配image.title，不存在时匹配illust.title
 *      tag: 匹配illust.tags与当前image.tags的并集
 *      favorite: 匹配image.favorite
 *      createTime: 匹配image.createTime
 *      imageQuantity: 无效
 *
 * 排序：使用几个既定的字段进行优先级排序。可以倒序。总是按illust粒度排序。
 *      id: 小序号在前。
 *      title: 字典序。
 *      favorite: true在前。
 *      createTime: 最新日期在前。
 *      imageQuantity: 数量最多在前。
 */
interface IllustrationFindOption {
    findByImage?: boolean,

    order?: string[],
    desc?: boolean,

    search?: string,
    id__eq?: number,
    id__in?: number[],
    title__eq?: string,
    tag__containsAll?: string[],
    favorite__eq?: boolean,
    createTime__le?: number,
    createTime__ge?: number,
    imageQuantity__ge?: number
}

interface TagFindOption {
    search?: string,
    order?: string[],
    desc?: boolean,
    type__eq?: string,
    title__eq?: string
}

interface Illustration {
    id?: number,
    title: string,
    tags: string[],
    favorite: boolean,
    links: string[],
    createTime: number,
    images: Image[]
}

interface Image {
    id?: number
    index: number,
    subTitle: string
    subTags: string[]
    subFavorite: boolean
    resolution: Size,
    createTime: number
}

function caseIllustration(illustration: Illustration, option: IllustrationFindOption): Illustration {
    if(option.findByImage) {
        let images = []
        for(let image of illustration.images) {
            if(matchOnImage(illustration, image, option)) Arrays.append(images, image)
        }
        if(images.length > 0) {
            let ret = Illustrations.cloneIllustrationExcludeImage(illustration)
            ret.images = images
            return ret
        }else{
            return null
        }
    }else{
        return matchOnIllustration(illustration, option) ? Illustrations.cloneIllustration(illustration) : null
    }
}
function matchOnIllustration(illustration: Illustration, option: IllustrationFindOption): boolean {
    if(option.id__eq && illustration.id !== option.id__eq) return false
    else if(option.id__in && !Arrays.contains(option.id__in, illustration.id)) return false
    else if(option.title__eq && illustration.title !== option.title__eq) return false
    else if(option.tag__containsAll && !Illustrations.containsAllTags(illustration, option.tag__containsAll)) return false
    else if(option.favorite__eq && !illustration.favorite) return false
    else if(option.createTime__le && illustration.createTime > option.createTime__le) return false
    else if(option.createTime__ge && illustration.createTime < option.createTime__ge) return false
    else if(option.imageQuantity__ge && illustration.images.length < option.imageQuantity__ge) return false
    else return !(option.search && !Illustrations.matchSearchText(illustration, option.search))
}
function matchOnImage(illustration: Illustration, image: Image, option: IllustrationFindOption): boolean {
    if(option.id__eq && image.id !== option.id__eq) return false
    else if(option.id__in && !Arrays.contains(option.id__in, image.id)) return false
    else if(option.title__eq && illustration.title !== option.title__eq && image.subTitle !== option.title__eq) return false
    else if(option.tag__containsAll && !Images.containsAllTags(image, illustration, option.tag__containsAll)) return false
    else if(option.favorite__eq && !image.subFavorite && !illustration.favorite) return false
    else if(option.createTime__ge && image.createTime < option.createTime__ge) return false
    else if(option.createTime__le && image.createTime > option.createTime__le) return false
    else return !(option.search && !Images.matchSearchText(image, illustration, option.search))
}
function sortIllustration(illustrations: Illustration[], order: string[], desc: boolean): Illustration[] {
    let gt = desc ? -1 : 1
    let lt = desc ? 1 : -1
    illustrations.sort((a, b) => {
        for(let field of order) {
            if(field === 'id') {
                let tA = a.id, tB = b.id
                if(tA !== tB) return tA > tB ? gt: lt
            }else if(field === 'title') {
                let tA = a.title, tB = b.title
                if(tA !== tB) return tA.localeCompare(tB, 'zh') > 0 ? gt : lt
            }else if(field === 'favorite') {
                let tA = a.favorite, tB = b.favorite
                if(tA !== tB) return tB ? gt : lt
            }else if(field === 'createTime') {
                let tA = a.createTime, tB = b.createTime
                if(tA !== tB) return tA < tB ? gt: lt
            }else if(field === 'imageQuantity') {
                let tA = a.images.length, tB = b.images.length
                if(tA !== tB) return tA < tB ? gt: lt
            }
        }
        return 0
    })
    return illustrations
}

function caseTag(tag: string, option: TagFindOption): boolean {
    if(option.type__eq && tag.substring(0, 1) !== option.type__eq) return false
    else if(option.title__eq && tag.substring(1) !== option.title__eq) return false
    else return !(option.search && (!Strings.findLikeIn(option.search, [Tags.getTagName(tag)])))
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
export {DataEngine, ImageSpecification, IllustrationFindOption, TagFindOption, Illustration, Image, caseIllustration, sortIllustration, caseTag, sortTag}