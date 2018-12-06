import { Size } from "electron";

/**
 * 数据引擎的接口。
 * 由应用层调用，并由底层实现，同时实现缓存层。
 * 实现以下功能标准：
 * 1. 按照给定的筛选、排序条件，查找tags、images的item。
 * 2. (批量)删除items。包括其bitmap。
 * 3. (批量)更新items。包括其bitmap。
 * 4. (批量)新建items。包括其bitmap。
 * 5. 获取一份bitmap，并制定规格。bitmap需要被缓存。
 */
interface DataEngine {
    findTag(filter?: Object, order?: Array<string>): Array<Tag>
    findImage(filter?: Object, order?: Array<string>): Array<Image>
    deleteTag(ids: Iterable<number>): number
    deleteImage(ids: Iterable<number>): number
    updateTag(tags: Iterable<Tag>): number
    updateImage(images: Iterable<Image>): number
    createTag(tags: Iterable<Tag>): number
    createImage(images: Iterable<Image>): number
    /**
     * 加载指定image。返回值为DataURL。
     * @param id image的id。
     * @param specification 加载的规范尺寸。
     */
    loadImageURL(id: number, specification?: ImageSpecification): string

    connect?(): void
    close?(): void
}

enum ImageSpecification {
    Thumbnail,
    Exhibition,
    Origin
}

interface Tag {
    id: number
    name: string
    type: string
}

interface Image {
    id: number
    title: string
    collection: string
    tags: Array<Tag>
    favorite: boolean
    links: Array<string>
    resolution: Size,
    createTime: Date,
    buffer?: Buffer
}

export {DataEngine, ImageSpecification, Tag, Image}