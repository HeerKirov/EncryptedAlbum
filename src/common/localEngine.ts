import {DataEngine, ImageSpecification, Tag, Image} from './engine'
import { Formula } from './appStorage';

class LocalDataEngine implements DataEngine {
    constructor(private storageFolder: String, key: String) {
        //TDO throw exception when wrong.
    }
    findTag(filter?: Object, order?: string[]): Tag[] {
        throw new Error("Method not implemented.");
    }    
    findImage(filter?: Object, order?: string[]): Image[] {
        throw new Error("Method not implemented.");
    }
    deleteTag(ids: Iterable<number>): number {
        throw new Error("Method not implemented.");
    }
    deleteImage(ids: Iterable<number>): number {
        throw new Error("Method not implemented.");
    }
    updateTag(tags: Iterable<Tag>): number {
        throw new Error("Method not implemented.");
    }
    updateImage(images: Iterable<Image>): number {
        throw new Error("Method not implemented.");
    }
    createTag(tags: Iterable<Tag>): number {
        throw new Error("Method not implemented.");
    }
    createImage(images: Iterable<Image>): number {
        throw new Error("Method not implemented.");
    }
    loadImageURL(id: number, specification?: ImageSpecification): string {
        throw new Error("Method not implemented.");
    }
    connect(): void {

    }
    close(): void {

    }
}

class LocalFormula implements Formula {
    type: string
    id: string
    key: string
    config: Object
    buildEngine(): DataEngine {
        try {
            return new LocalDataEngine(this.config['storage'], this.key)
        }catch(e) {
            return null
        }
    }
}