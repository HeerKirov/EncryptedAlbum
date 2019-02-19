/**
 * 进度条管理器。用于在edit页面中，管理浮动在面板上方的进度对话框及其任务。
 * 该类为抽象类。使用时根据需要实现抽象函数。
 */
abstract class ProcessManager {
    private current: number = 0
    private max: number = 0
    private running: boolean = false
    private autoFinish: boolean = false

    /**
     * 实现这个函数。这个函数会被自动调用，设定指定的data。
     * @param data {percent in [0, 100]}.
     */
    abstract setVueData(data: {title?: string, text?: string, percent?: number}): void

    abstract setVisible(visible: boolean): void

    /**
     * 在业务逻辑中调用该函数，传入task，之后的事情会被自动执行。
     * @param config
     * @param task
     */
    submitTask(config: {title: string, autoFinish?: boolean}, task: Task): void {
        this.current = this.max = 0
        this.autoFinish = config.autoFinish
        this.running = true
        this.setVueData({title: config.title, text: '', percent: this.calcPercent()})
        this.setVisible(true)
        task(this.isRunning, this.setText, this.setMaxProgress, this.getMaxProgress, this.addCurrentProgress, this.cancelTask)
    }

    cancelTask: () => void = () => {
        this.setVisible(false)
        this.running = false
    }

    private calcPercent(): number {
        return this.max <= 0 || this.current <= 0 ? 0 : this.current > this.current ? 100 : this.current * 100 / this.max
    }

    private isRunning: () => boolean = () => {
        return this.running
    }
    private setText: (text: string) => void = (text: string) => {
        this.setVueData({text})
    }
    private setMaxProgress: (max: number) => void = (max: number) => {
        this.max = max
        this.setVueData({percent: this.calcPercent()})
    }
    private getMaxProgress: () => number = () => {
        return this.max
    }
    private addCurrentProgress: (value: number) => void = (value: number) => {
        this.current += value
        this.setVueData({percent: this.calcPercent()})
        if(this.autoFinish && this.current >= this.max) {
            this.cancelTask()
        }
    }
}

type Task = (
    isRunning: () => boolean,
    setText: (text: string) => void,
    setMaxProgress: (max: number) => void,
    getMaxProgress: () => number,
    addCurrentProgress: (current: number) => void,
    finish: () => void
) => void


export {ProcessManager, Task}