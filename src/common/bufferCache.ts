import { ImageSpecification } from "./engine"

class BufferCache<T> {
    constructor() {
        this.memory = {}
        this.memory[ImageSpecification.Thumbnail] = {}
        this.memory[ImageSpecification.Exhibition] = {}
        this.memory[ImageSpecification.Origin] = {}
    }

    get(specification: ImageSpecification, id: number): T {
        return this.memory[specification][id]
    }
    set(specification: ImageSpecification, id: number, obj: T) {
        this.memory[specification][id] = obj
    }
    remove(id: number): boolean {
        let f = false
        if(id in this.memory[ImageSpecification.Thumbnail]) {
            this.memory[ImageSpecification.Thumbnail][id] = undefined
            f = true
        }
        if(id in this.memory[ImageSpecification.Exhibition]) {
            this.memory[ImageSpecification.Exhibition][id] = undefined
            f = true
        }
        if(id in this.memory[ImageSpecification.Origin]) {
            this.memory[ImageSpecification.Origin][id] = undefined
            f = true
        }
        return f
    }

    private readonly memory: {}
}

export {BufferCache}