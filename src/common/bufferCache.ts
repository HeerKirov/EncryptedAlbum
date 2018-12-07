import { ImageSpecification } from "./engine";

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

    private memory: {}
}

export {BufferCache}