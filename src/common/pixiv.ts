const request = require('request')
import {containsOnlyWord} from './utils'

class URL {
    static homePage(): string {return 'https://www.pixiv.net/'}
    static loginPage(): string {return 'https://accounts.pixiv.net/login?lang=zh'}
    static login(): string {return 'https://accounts.pixiv.net/api/login?lang=zh'}
    static illust(illustId: string): string {return `https://www.pixiv.net/member_illust.php?mode=medium&illust_id=${illustId}`}
    static pximage(year: string, month: string, day: string, hour: string, minute: string, second: string, pid: string, p: string, ext: string): string {
        return `https://i.pximg.net/img-original/img/${year}/${month}/${day}/${hour}/${minute}/${second}/${pid}_p${p}.${ext}`
    }
    static member(uid: string, page: number): string {
        return `https://www.pixiv.net/member_illust.php?id=${uid}&type=all&p=${page}`
    }
}

const headers = {
    referer: "https://accounts.pixiv.net/login?lang=zh&source=pc&view_type=page&ref=wwwtop_accounts_index",
    origin: "https://accounts.pixiv.net"
}

function getFieldPath(obj: Object, ...path: any[]): any {
    let o = obj
    for(let p of path) {
        if(typeof o === 'object' && p in o) {
            o = o[p]
        }else{
            return null
        }
    }
    return o
}

/**
 * 从pixiv的tag json里提出一个最优的tag。
 * @param tag
 */
function takeTag(tag: Object): string {
    if(tag) {
        let titleJP = ('tag' in tag) ? tag['tag'] : null
        let titleEn = getFieldPath(tag, 'translation', 'en')    //愚蠢的p站，中文翻译也在这个值上……
        let titleRM = ('romaji' in tag) ? tag['romaji'] : null
        return titleEn && !containsOnlyWord(titleEn) ? titleEn : titleJP ? titleJP : titleRM ? titleRM : null
    }else{
        return null
    }
}

function takePid(str: string): string {
    if(/^\d+$/.test(str)) {
        return str
    }else{
        let match = str.match(/pixiv.net\/.*\?.*illust_id=(\d+)/)
        if(match) {
            return match[1]
        }else{
            return null
        }
    }
}

class PixivClient {
    private jar = request.jar()
    private proxy = undefined
    private session = undefined
    constructor() {}
    login(username: string, password: string, callback?: (boolean) => void) {
        this.generateSession()
        this.getLoginKey((key: string) => {
            if(key == null) {
                callback(false)
            }else{
                let data = {
                    'pixiv_id': username,
                    'password': password,
                    'captcha': '',
                    'g_recaptcha_response': '',
                    'post_key': key,
                    'source': 'pc',
                    'ref': 'wwwtop_accounts_index',
                    'return_to': URL.homePage()
                }
                this.session.post({url: URL.login(), form: data, headers: headers}, (e, res, body) => {
                    if(res && res.statusCode === 200) {
                        let data = JSON.parse(body)
                        if(data['error']) {
                            callback(false)
                        }else if('body' in data && 'success' in data.body) {
                            callback(true)
                        }else{
                            callback(false)
                        }
                    }else{
                        callback(false)
                    }
                })
            }
        })
    }
    setProxy(proxy: any): PixivClient {
        this.proxy = proxy
        return this
    }
    private generateSession() {
        if(this.session == undefined) {
            if(this.proxy == undefined) this.session = request.defaults({jar: this.jar})
            else this.session = request.defaults({jar: this.jar, proxy: this.proxy})
        }
    }
    private getLoginKey(callback: (key: string) => void): void {
        this.session.get({url: URL.loginPage(), headers: headers}, (e, res, body) => {
            if(res && res.statusCode === 200) {
                let matched = body.match(/"pixivAccount.postKey":"([\w]*)"/)
                if(matched) {
                    callback(matched[1])
                }else{
                    callback(null)
                }
            }else{
                callback(null)
            }
        })
    }

    /**
     * 解析一个pid的信息及其所有图片内容。
     * @param pixivId, 或者包含pixivId的url
     * @param illustCallback 回调图片信息。
     * @param imageCallback 依次回调图片buffer。其下标从0开始。数值为-1的回调也会发生，以通知所有的图片下载均已完成。
     */
    loadIllust(pixivId: string, illustCallback?: (illust: PixivIllust) => void, imageCallback?: (index: number, buf: Buffer) => void): void {
        this.generateSession()
        pixivId = takePid(pixivId)
        this.session.get({url: URL.illust(pixivId)}, (e, res, body) => {
            if(res && res.statusCode === 200) {
                let match = body.match(/\(({.*})\)/)
                if(match) {
                    let data;
                    try {
                        data = (new Function('return ' + match[1]))()
                    }catch (e) {
                        if(illustCallback) illustCallback(null)
                        return
                    }
                    let id = parseInt(pixivId)
                    let dataTags = getFieldPath(data, 'preload', 'illust', id, 'tags', 'tags')
                    let tags = []
                    if(dataTags) {
                        for(let dataTag of dataTags) {
                            let tag = takeTag(dataTag)
                            if(tag) tags[tags.length] = tag
                        }
                    }
                    let illust: PixivIllust = {
                        pid: pixivId,
                        uid: getFieldPath(data, 'preload', 'illust', id, 'userId'),
                        member: getFieldPath(data, 'preload', 'illust', id, 'userName'),
                        title: getFieldPath(data, 'preload', 'illust', id, 'illustTitle'),
                        description: getFieldPath(data, 'preload', 'illust', id, 'description'),
                        webLink: URL.illust(pixivId),
                        imageLink: getFieldPath(data, 'preload', 'illust', id, 'urls', 'original'),
                        tags: tags,
                        pageCount: getFieldPath(data, 'preload', 'illust', id, 'pageCount')
                    }
                    if(illustCallback) illustCallback(illust)
                    if(imageCallback) {
                        let webUrl: string = illust.webLink
                        let baseUrl: string = illust.imageLink
                        let count = illust.pageCount
                        let cnt = count
                        for(let i = 0; i < count; ++i) {
                            let url = baseUrl.replace(/([0-9]*)_p[0-9]\./, `$1_p${i}.`)
                            this.loadImageBuffer(url, i, webUrl, (buf: Buffer, idx: number) => {
                                cnt --
                                imageCallback(idx, buf)
                                if(cnt <= 0) {
                                    imageCallback(-1, null)
                                }
                            })
                        }
                    }
                }else{
                    if(illustCallback) illustCallback(null)
                }
            }else{
                if(illustCallback) illustCallback(null)
            }
        })
    }

    loadImageBuffer(url: string, id: number, referer: string, callback: (buffer: Buffer, id: number) => void): void {
        this.generateSession()
        this.session.get({url: url, headers: {Referer: referer}, encoding: null}, (e, res, body) => {
            if(res && res.statusCode === 200) {
                if(callback) callback(body, id)
            }else{
                if(callback) callback(null, id)
            }
        })
    }
}

interface PixivIllust {
    pid: string,    //pixiv id
    uid: string,    //user id
    member: string, //user name
    title: string,      //标题
    description: string,//介绍信息
    tags: string[],     //标签
    webLink: string,    //web页面的链接
    imageLink: string,//原图链接
    pageCount: number
}

export {PixivClient, PixivIllust}