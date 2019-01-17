import {applicationRun} from './application'

const argv = process.argv.slice(2)
const debug = argv.indexOf('--debug') >= 0 || argv.indexOf('-d') >= 0

applicationRun({debugMode: debug})