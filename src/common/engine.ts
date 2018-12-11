import { Size } from "electron"

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
    loadImageURL(id: number, specification?: ImageSpecification): string
    findTag(options?: TagFindOption): Array<string>
    getNextId(): number

    connect?(): void
    close?(): void
}

interface ImageFindOption {
    search?: string,
    order?: string[],
    id_eq?: number,
    id_in?: number[],
    title_eq?: string,
    collection_eq?: string,
    tag_contains?: string[][],
    favorite_eq?: boolean,
    createTime_le?: number,
    createTime_ge?: number
}

interface TagFindOption {
    search?: string,
    order?: string[],
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
    createTime: number,
    buffer?: Buffer
}

export {DataEngine, ImageSpecification, ImageFindOption, TagFindOption, Image}