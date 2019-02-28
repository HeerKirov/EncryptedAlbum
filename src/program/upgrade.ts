/**将v0.1.0-Beta的localEngine存储结构升级到v0.2.0-Beta。
 * node target/upgrade.js <password> <save_path>
 */
import {readFileSync, writeFileSync} from 'fs'
import {Illustration, Image} from "../common/engine"
import {decrypt, encrypt} from '../util/encryption'
import {Arrays, Sets} from "../util/collection"
import {Tags} from "../util/model"

function decryptIt(key: string, filename: string): Object {
    let data: Buffer = readFileSync(filename, {encoding: null})
    return decrypt(key, data)
}
function encryptIt(key: string, filename: string, content: Object): void {
    let data: Buffer = encrypt(key, content)
    writeFileSync(filename, data, {encoding: null})
}
function upgrade(data: {index: number, images: [], blocks: Object, blockMax: number, config: Object}): Object {
    let illustrations: Illustration[] = []
    let nextIllustId = 1
    let collections: any = {}    //collection: string -> OldImage[]
    let collectionsArray = []   //{col: string, oldImages: OldImage[]}[]
    let singleImages: [] = []
    for(let image of data.images) {
        let col = image['collection']
        if(col != null) {
            let arr: [] = (collections[col]) ? collections[col] : collections[col] = []
            if(collections[col]) {
                arr = collections[col]
            }else{
                arr = []
                collections[col] = arr
                Arrays.append(collectionsArray, {col: col, oldImages: arr})
            }
            Arrays.append(arr, image)
        }else{
            Arrays.append(singleImages, image)
        }
    }
    for(let {col, oldImages} of collectionsArray) {
        let illustTitle = col
        oldImages.sort((a, b) => {
            return a.id != null && b.id != null ? (
                a.id === b.id ? 0 : a.id < b.id ? -1 : 1
            ) : a.id == null ? -1 : 1
        })
        let tags = null
        let links = []
        let images = []
        let createTime = null
        let imageIndex = 0
        for(let oldImg of oldImages) {
            let oldTags = oldImg['tags']
            if(oldTags) {
                if(tags == null) tags = Arrays.clone(oldTags)
                else tags = Sets.and(tags, oldTags)
            }
        }
        for(let oldImg of oldImages) {
            let oldImage: {
                id: number, title: string, collection: string, tags: string[], favorite: boolean, links: string[],
                resolution: {width: number, height: number}, createTime: number
            } = oldImg
            if(createTime == null || oldImage.createTime < createTime) createTime = oldImage.createTime

            let image: Image = {
                id: oldImage.id,
                index: imageIndex ++,
                subTitle: (oldImage.title && oldImage.title.indexOf(illustTitle) >= 0) ? null : oldImage.title,
                subTags: Arrays.filter(oldImage.tags, (tag: string) => !Sets.contains(tags, tag)),
                resolution: oldImage.resolution,
                createTime: oldImage.createTime
            }
            Arrays.append(images, image)

            if(oldImage.links) {
                for(let link of oldImage.links) {
                    Sets.put(links, link)
                }
            }
        }
        let illust: Illustration = {
            id: nextIllustId ++,
            title: illustTitle,
            images, links,
            tags: tags ? Arrays.map(tags, (tag: string) => {
                let oldType = tag.substring(0, 1)
                let name = tag.substring(1)
                let newType = oldType === '#' ? 'content' : oldType === '@' ? 'author' : 'theme'
                return Tags.tag(newType, name)
            }) : [],
            createTime
        }
        Arrays.append(illustrations, illust)
    }
    for(let oldImg of singleImages) {
        let oldImage: {
            id: number, title: string, collection: string, tags: string[], favorite: boolean, links: string[],
            resolution: {width: number, height: number}, createTime: number
        } = oldImg

        let image: Image = {
            id: oldImage.id,
            index: 0,
            subTitle: null,
            subTags: [],
            resolution: oldImage.resolution,
            createTime: oldImage.createTime
        }

        let illust: Illustration = {
            id: nextIllustId ++,
            title: oldImage.title,
            tags: Arrays.map(oldImage.tags, (tag: string) => {
                let oldType = tag.substring(0, 1)
                let name = tag.substring(1)
                let newType = oldType === '#' ? 'content' : oldType === '@' ? 'author' : 'theme'
                return Tags.tag(newType, name)
            }),
            createTime: oldImage.createTime,
            links: oldImage.links,
            images: [image]
        }
        Arrays.append(illustrations, illust)
    }

    let nextIndex: any = {}
    nextIndex.nextIllustrationId = nextIllustId
    nextIndex.nextImageId = data.index ? data.index : 1
    nextIndex.nextBlockIndex = data.blockMax != null ? data.blockMax + 1 : 0

    let blocks: any = data.blocks ? data.blocks : {}
    let unusedBlocks = []

    let config: any = {}
    if(data.config) {
        if(data.config['view']) {
            let oldConfig = data.config['view']
            config.view = {showTitle: oldConfig.showTitle, zoom: oldConfig.zoom, loadNum: oldConfig.loadNum}
        }
        if(data.config['pixiv']) config.pixiv = data.config['pixiv']
        if(data.config['proxy']) config.proxy = data.config['proxy']
    }
    config['tag-type'] = [
        {key: 'author', name: '作者', background: '#FFFF00', fontcolor: '#000000'},
        {key: 'theme', name: '题材', background: '#17A2B8', fontcolor: '#FFFFFF'},
        {key: 'content', name: '内容', background: '#28A745', fontcolor: '#FFFFFF'}
    ]

    return {
        version: 'v0.2.0',
        nextIndex,
        illustrations,
        blocks, unusedBlocks,
        config
    }
}
function updateV0_1_0toV0_2_0(key: string, filename: string): void {
    let data = decryptIt(key, filename)
    encryptIt(key, filename, upgrade(data as any))
}
const argv = process.argv.slice(2)
updateV0_1_0toV0_2_0(argv[0], argv[1])

/**v0.1.0的存储结构如下所示：
 * {
 *      index: number,  //下一个即将被使用的image index序列号，从1开始
 *      images: Array<{
 *          id: number,
 *          title: string,
 *          collection: string,
 *          tags: string[],
 *          favorite: boolean,
 *          links: string[],
 *          resolution: {width: number, height: number},
 *          createTime: number
 *      }>,
 *      blocks: Map<imageId: number, Map<spec: number, {blocks: number[], size: number}>>,
 *      blockMax: number,   //目前最大的block的序列号，从0开始
 *      config: {
 *          view: {showTitle: boolean, zoom: number, loadNum: number, aggregateByCollection: boolean},
 *          pixiv: {username: string, password: string},
 *          proxy: {protocol: string, host: string, port: string}
 *      }
 * }
 * v0.2.0的存储结构如下所示：
 * {
 *     version: string,
 *     nextIndex: {
 *          nextIllustrationId: number,
 *          nextImageId: number,
 *          nextBlockIndex: number
 *     },
 *     illustrations: Array<{
 *          id: number,
 *          title: number,
 *          tags: string[],
 *          links: string[],
 *          createTime: number,
 *          images: Array<{
 *              id: number,
 *              index: number,
 *              subTitle: string,
 *              subTags: string,
 *              resolution: {width: number, height: number},
 *              createTime: number
 *          }>
 *     }>,
 *     blocks: Map<imageId: number, Map<spec: number, {blocks: number[], size: number}>>,
 *     unusedBlocks: number[],
 *     config: {
 *          folder: Map<folderName: string, {virtual: boolean, items: Scale[], options: IllustrationFindOption}>,
 *          tag-type: Array<{name: string, key: string, background: string, color: string}>,
 *          view: {showTitle: boolean, zoom: number, loadNum: number},
 *          pixiv: {username: string, password: string},
 *          proxy: {protocol: string, host: string, port: string}
 *     }
 * }
 */