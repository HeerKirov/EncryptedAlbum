import {DataEngine, ImageSpecification, ImageFindOption, TagFindOption, Image} from './engine'
import { Formula, decrypt } from './appStorage';
import { BufferCache } from './bufferCache';
import { writeFileSync, readFileSync, existsSync } from 'fs';
import { encrypt } from './utils';
import { NativeImage } from 'electron';
import { translateNativeImage } from './imageTool';

const STORAGE = 'data.db'

const BLOCK_SIZE = 1024 * 64 //64KB
const BLOCK_IN_FILE = 1024 //1024 blocks(64MB) in max case
function BLOCK_NAME(index: number): string {
    return `block-${(index + 0xa000).toString(16)}.dat`
}

class LocalDataEngine implements DataEngine {
    constructor(private storageFolder: string, private key: string) {
        //TODO throw exception when wrong.
    }
    findImage(options?: ImageFindOption): Image[] {
        throw new Error("Method not implemented.");
    }
    createImage(images: Image[]): Image[] {
        throw new Error("Method not implemented.");
    }
    updateImage(images: Image[]): Image[] {
        throw new Error("Method not implemented.");
    }
    deleteImage(images: (number | Image)[]): number {
        throw new Error("Method not implemented.");
    }
    loadImageURL(id: number, specification?: ImageSpecification): string {
        let spec = specification ? specification : ImageSpecification.Origin
        let cache = this.imageDataCache.get(spec, id)
        if(cache != null) {
            return cache
        }
        let originBuf = this.imageBufferCache.get(ImageSpecification.Origin, id)
        if(originBuf != null) {
            let native = NativeImage.createFromBuffer(originBuf)
            let goalNative = translateNativeImage(native, spec)
            let dataUrl = goalNative.toDataURL()
            this.imageDataCache.set(spec, id, dataUrl)
            return dataUrl
        }
        let blocks = this.blockMemory[id]
        if(!blocks) {
            return null
        }
        let buffer = loadImageBuffer(this.storageFolder, blocks)
        if(buffer != null) {
            let native = NativeImage.createFromBuffer(buffer)
            let goalNative = translateNativeImage(native, spec)
            let dataUrl = goalNative.toDataURL()
            this.imageDataCache.set(spec, id, dataUrl)
            this.imageBufferCache.set(ImageSpecification.Origin, id, buffer)
            return dataUrl
        }
        return null
    }
    findTag(options?: TagFindOption): string[] {
        throw new Error("Method not implemented.");
    }

    connect(): void {
        this.load()
    }
    close(): void {
        this.save()
    }

    private load(): boolean {
        if(existsSync(`${this.storageFolder}/${STORAGE}`)) {
            let buf = readFileSync(`${this.storageFolder}/${STORAGE}`)
            let data = decrypt(this.key, buf)
            if(data != null) {
                this.imageMemory = data['images']
                this.indexMemory = data['index']
                this.blockMemory = data['blocks']
                this.tagMemory = []
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
            return true
        }
    }
    private save() {
        let buf = encrypt(this.key, {
            index: this.indexMemory,
            images: this.imageMemory,
            blocks: this.blockMemory
        })
        writeFileSync(`${this.storageFolder}/${STORAGE}`, buf)
    }

    private indexMemory: number = null
    private imageMemory: Image[] = []
    private tagMemory: string[] = []
    private blockMemory: {} = {}
    private imageDataCache: BufferCache<string> = new BufferCache()
    private imageBufferCache: BufferCache<Buffer> = new BufferCache()
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

function loadImageBuffer(folder: string, blocks: number[]): Buffer {
    return Buffer.alloc(0) //TODO
}

export {LocalDataEngine, LocalFormula}