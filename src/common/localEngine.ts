import {close, existsSync, open, read, readFileSync, write, writeFileSync} from 'fs'
import {
    DataEngine,
    Image,
    ImageFindOption, TagFindOption,
    ImageSpecification,
    caseImage, caseTag,
    sortImage, sortTag,
} from './engine'
import {Formula} from './appStorage'
import {BufferCache} from './bufferCache'
import {decrypt, encrypt} from './utils'
import {translateDataURL} from './imageTool'

const PREFIX = 'data:image/jpeg;base64,'
const PREFIX_LENGTH = PREFIX.length
const STORAGE = 'data.db'

const BLOCK_SIZE = 1024 * 64 //64KB
const BLOCK_IN_FILE = 1024 //1024 blocks(64MB) in max case
function FILE_NAME(index: number): string {
    return `block-${(index + 0xa).toString(16)}.dat`
}

class LocalDataEngine implements DataEngine {
    constructor(private storageFolder: string, private key: string) { }
    findImage(options?: ImageFindOption): Image[] {
        if(options) {
            let ret = []
            for(let image of this.imageMemory) {
                if(caseImage(image, options)) {
                    ret[ret.length] = image
                }
            }
            if(options.order) {
                sortImage(ret, options.order, options.desc !== undefined ? options.desc : true)
            }else if(options.desc !== undefined && options.desc === false) {
                ret.reverse()
            }
            return ret
        }else{
            return this.imageMemory
        }
    }
    createImage(images: Image[]): Image[] {
        let maxIndex = 0
        for(let image of images) {
            if(image.id > maxIndex) {
                maxIndex = image.id
            }
            this.imageMemory[this.imageMemory.length] = image
            for(let tag of image.tags) {
                if(!(tag in this.tagMemory)) {
                    this.tagMemory[this.tagMemory.length] = tag
                }
            }
        }
        if(maxIndex >= this.indexMemory) {
            this.indexMemory = maxIndex + 1
        }
        return images
    }
    updateImage(images: Image[]): Image[] {
        let success = []
        for(let image of images) {
            for(let idx in this.imageMemory) {
                if(this.imageMemory[idx].id === image.id) {
                    for(let tag of image.tags) {
                        if((!(tag in this.imageMemory[idx].tags))&&(!(tag in this.tagMemory))) {
                            this.tagMemory[this.tagMemory.length] = tag
                        }
                    }
                    //TODO 追加对image的更改
                    this.imageMemory[idx] = image
                    success[success.length] = image
                    break
                }
            }
        }
        return success
    }
    deleteImage(images: (number | Image)[]): number {
        let ret = 0
        for(let i of images) {
            let idx = typeof i === "number" ? i : i.id
            for(let i = 0; i < this.imageMemory.length; ++i) {
                if(this.imageMemory[i].id === idx) {
                    this.imageMemory.splice(i, 1)
                    ret ++
                    this.imageURLCache.remove(idx)
                    this.blockMemory[idx] = undefined
                    //目前的删除方案：从缓存区删除缓存；从分区表中删除分区，但是不删除实体文件中的内容
                    //可以做的改进：整理分区表，重新利用被删除的分区以覆盖和复用。
                    break
                }
            }
        }
        return ret
    }
    findTag(options?: TagFindOption): string[] {
        if(options) {
            let ret = []
            for(let tag of this.tagMemory) {
                if(caseTag(tag, options)) {
                    ret[ret.length] = tag
                }
            }
            if(options.order) {
                sortTag(ret, options.order, options.desc !== undefined ? options.desc : false)
            }else if(options.desc !== undefined && options.desc === false) {
                ret.reverse()
            }
            return ret
        }else{
            return this.tagMemory
        }
    }
    getNextId(): number {
        return this.indexMemory
    }
    //TODO 添加加密/解密流程
    saveImageURL(id: number, dataURL: string, callback?: () => void): void {
        if(dataURL.substr(0, PREFIX_LENGTH) === PREFIX) {
            dataURL = dataURL.substring(PREFIX_LENGTH)
        }
        let buf = Buffer.from(dataURL, 'base64')
        saveImageBuffer(this.storageFolder, buf, this.blockMaxMemory, (blocks) => {
            for(let b of blocks) {
                if(b > this.blockMaxMemory) {
                    this.blockMaxMemory = b
                }
            }
            if(!this.blockMemory[id]) this.blockMemory[id] = {}
            this.blockMemory[id][ImageSpecification.Origin] = {
                size: buf.byteLength,
                blocks: blocks
            }
            let exhibitionURL = translateDataURL(dataURL, ImageSpecification.Exhibition).substring(PREFIX_LENGTH)
            let exhibitionBuf = Buffer.from(exhibitionURL, 'base64')
            saveImageBuffer(this.storageFolder, exhibitionBuf, this.blockMaxMemory, (blocks) => {
                for(let b of blocks) {
                    if(b > this.blockMaxMemory) {
                        this.blockMaxMemory = b
                    }
                }
                if(!this.blockMemory[id]) this.blockMemory[id] = {}
                this.blockMemory[id][ImageSpecification.Exhibition] = {
                    size: exhibitionBuf.byteLength,
                    blocks: blocks
                }
                if(callback != undefined) callback()
            })
        })

    }
    loadImageURL(id: number, specification?: ImageSpecification, callback?: (string: string) => void): void {
        let spec = specification === ImageSpecification.Origin ? ImageSpecification.Origin : ImageSpecification.Exhibition
        let cache = this.imageURLCache.get(spec, id)
        if(cache != null) {
            if(callback !== undefined) callback(cache)
            return
        }
        if(!this.blockMemory[id]) {
            if(callback != undefined) callback(null)
            return
        }
        let {blocks, size} = this.blockMemory[id][spec]
        if(!blocks) {
            if(callback !== undefined) callback(null)
        }else{
            loadImageBuffer(this.storageFolder, blocks, size, (buf: Buffer) => {
                if(buf != null) {
                    let dataUrl = PREFIX + buf.toString('base64')
                    this.imageURLCache.set(spec, id, dataUrl)
                    if(callback !== undefined) callback(dataUrl)
                }else{
                    if(callback !== undefined) callback(null)
                }
            })
        }
    }

    getConfig(key: string): any {
        return this.config[key]
    }
    putConfig(key: string, value: any): void {
        this.config[key] = value
    }
    existConfig(key: string): boolean {
        return key in this.config
    }

    connect(): boolean {
        return this.load()
    }
    close(): void {
        this.save()
    }
    load(): boolean {
        if(existsSync(`${this.storageFolder}/${STORAGE}`)) {
            let buf = readFileSync(`${this.storageFolder}/${STORAGE}`)
            let data = decrypt(this.key, buf)
            if(data != null) {
                this.imageMemory = data['images']
                this.indexMemory = data['index']
                this.blockMemory = data['blocks']
                this.blockMaxMemory = data['blockMax']
                this.tagMemory = []
                if('config' in data) {
                    this.config = data['config']
                }
                for(let image of this.imageMemory) {
                    for(let tag of image.tags) {
                        if(!(tag in this.tagMemory)) {
                            this.tagMemory[this.tagMemory.length] = tag
                        }
                    }
                }
                return true
            }
            return false
        }else{
            this.indexMemory = 1
            this.imageMemory = []
            this.tagMemory = []
            this.blockMemory = {}
            this.blockMaxMemory = -1
            this.config = {}
            return true
        }
    }
    save() {
        let buf = encrypt(this.key, {
            index: this.indexMemory,
            images: this.imageMemory,
            blocks: this.blockMemory,
            blockMax: this.blockMaxMemory,
            config: this.config
        })
        writeFileSync(`${this.storageFolder}/${STORAGE}`, buf)
    }

    private indexMemory: number = null  //下一个即将被使用的index序列号
    private imageMemory: Image[] = []   //保存images的数据组
    private tagMemory: string[] = []    //暂存tags方便查询的数据组
    private blockMemory: {} = {}        //number(imageId) -> {spec: {blocks: number[], size: number}} (blocks index array)的缓存映射
    private blockMaxMemory: number = -1 //当前正在使用的block的最大序号。因为block从0开始因此该序号最小值为-1
    private config: Object = {}         //保存一些杂项配置信息

    private imageURLCache: BufferCache<string> = new BufferCache()  //缓存已经提取的dataURL的缓存器
}

class LocalFormula implements Formula {
    constructor(id?: string, key?: string, storage?: string) {
        this.type = 'local'
        if(id) this.id = id
        if(key) this.key = key
        if(storage) this.storage = storage
    }
    type: string
    id: string
    key: string
    storage: string
    buildEngine(): DataEngine {
        try {
            return new LocalDataEngine(this.storage, this.key)
        }catch(e) {
            return null
        }
    }
}
function loadImageBuffer(folder: string, blocks: number[], size: number, callback?: (Buffer) => void): void {
    let map = {}
    for(let i = 0; i < blocks.length; ++i) {
        let block = blocks[i]
        let filename = `${folder}/${FILE_NAME(Math.floor(block / BLOCK_IN_FILE))}`
        if(filename in map) {
            let arr = map[filename]
            arr[arr.length] = {id: i, block: block % BLOCK_IN_FILE, size: (i === blocks.length - 1) ? size % BLOCK_SIZE : BLOCK_SIZE}
        }else{
            map[filename] = [{id: i, block: block % BLOCK_IN_FILE, size: (i === blocks.length - 1) ? size % BLOCK_SIZE : BLOCK_SIZE}]
        }
    }
    let buf = Buffer.alloc(size)
    for(let filename in map) {
        let blocks = map[filename]
        let flag = blocks.length
        open(filename, 'r', (err, fd) => {
            for(let {id, block, size} of blocks) {
                read(fd, buf, id * BLOCK_SIZE, size, block * BLOCK_SIZE, (err, read, buffer) => {
                    flag -= 1
                    if(flag <= 0) {
                        if(callback !== undefined) callback(buf)
                        close(fd, () => {})
                    }
                })
            }
        })
    }
}

function saveImageBuffer(folder: string, buffer: Buffer, blockMaxIndex: number, callback?: (Array) => void): void {
    let blockNum = Math.floor(buffer.byteLength / BLOCK_SIZE) + 1
    let blocks = []
    for(let i = 0; i < blockNum; ++i) {
        blocks[i] = blockMaxIndex + i + 1
    }
    let map = {}
    for(let i = 0; i < blocks.length; ++i) {
        let block = blocks[i]
        let filename = `${folder}/${FILE_NAME(Math.floor(block / BLOCK_IN_FILE))}`
        if(filename in map) {
            let arr = map[filename]
            arr[arr.length] = {id: i, block: block % BLOCK_IN_FILE, size: (i === blocks.length - 1) ? buffer.byteLength % BLOCK_SIZE : BLOCK_SIZE}
        }else{
            map[filename] = [{id: i, block: block % BLOCK_IN_FILE, size: (i === blocks.length - 1) ? buffer.byteLength % BLOCK_SIZE : BLOCK_SIZE}]
        }
    }
    for(let filename in map) {
        let mapBlock = map[filename]
        let flag = mapBlock.length
        open(filename, 'a', (err, fd) => {
            for(let {id, block, size} of mapBlock) {
                write(fd, buffer, id * BLOCK_SIZE, size, block * BLOCK_SIZE, (err, read, buf) => {
                    flag -= 1
                    if(flag <= 0) {
                        if(callback != undefined) callback(blocks)
                        close(fd, () => {})
                    }
                })
            }
        })
    }
}

export {LocalDataEngine, LocalFormula}