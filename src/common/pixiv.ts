const request = require('request')
import {writeFileSync} from 'fs'

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

const proxy = {
    host: 'localhost',
    port: '1087'
}

const headers = {
    referer: "https://accounts.pixiv.net/login?lang=zh&source=pc&view_type=page&ref=wwwtop_accounts_index",
    origin: "https://accounts.pixiv.net"
}

class PixivClient {
    private jar = request.jar()
    constructor() {}
    login(username: string, password: string, callback?: (boolean) => void) {
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
                request.post({url: URL.login(), form: data, headers: headers, proxy: proxy, jar: this.jar}, (e, res, body) => {
                    if(res && res.statusCode === 200) {
                        callback(true)
                    }else{
                        callback(false)
                    }
                })
            }
        })
    }
    private getLoginKey(callback: (key: string) => void): void {
        request.get({url: URL.loginPage(), headers: headers, proxy: proxy, jar: this.jar}, (e, res, body) => {
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
    loadIllust(pixivId: string, callback?: (illust: PixivIllust) => void): void {
        request.get({url: URL.illust(pixivId), proxy: proxy, jar: this.jar}, (e, res, body) => {
            let match = body.match(/\(({.*})\)/)
            if(match) {
                let data = (new Function('return ' + match[1]))()
                console.log(data)
            }
            if(callback) callback({
                pid: '',
                uid: '',
                member: '',
                title: '',
                description: '',
                tags: [],
                webLink: '',
                imageLink: []
            })
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
    imageLink: string[] //原图链接
}

export {PixivClient, PixivIllust}