import { setHttpCallback } from '@citizenfx/http-wrapper'
import { v4 as uuid } from 'uuid'
import mime from 'mime'
import Koa from 'koa'
import Router from '@koa/router'
import multer from '@koa/multer'
import { BlobServiceClient, StorageSharedKeyCredential } from '@azure/storage-blob'

const app = new Koa()
const router = new Router()
const upload = multer()

const MB = 1024 * 1024

type Config = {
    Security: {
        RequireConnected: boolean
        ApiKey: string | false
        RequireOrigin: string[] | false
    }
    Limits: {
        FileSize: number | false
        Mimes: string[] | false
    }
    AzureStorage: {
        AccountName: string
        AccountKey: string
        ContainerName: {
            Images: string
            Videos: string
            Audio: string
        }
    }
}

let config: Config = {
    Security: {
        RequireConnected: false,
        ApiKey: false,
        RequireOrigin: false
    },
    Limits: {
        FileSize: false,
        Mimes: false
    },
    AzureStorage: {
        AccountName: '',
        AccountKey: '',
        ContainerName: {
            Images: 'images',
            Videos: 'videos',
            Audio: 'audio'
        }
    }
}

on('onServerResourceStart', (resourceName: string) => {
    if (resourceName !== GetCurrentResourceName()) return

    try {
        config = exports[GetCurrentResourceName()].GetConfig() as Config
    } catch (err) {
        console.log('^1[ERROR]Failed to load config from config.lua:^0', err)
        return
    }

})

let blobServiceClient: BlobServiceClient | null = null
const initializedContainers = new Set<string>()

async function ensureContainer(containerName: string): Promise<void> {
    if (!blobServiceClient) {
        const { AccountName, AccountKey } = config.AzureStorage
        if (!AccountName || !AccountKey) throw new Error('Azure Storage account name or key is not configured')
        const credential = new StorageSharedKeyCredential(AccountName, AccountKey)
        blobServiceClient = new BlobServiceClient(`https://${AccountName}.blob.core.windows.net`, credential)
    }
    if (initializedContainers.has(containerName)) return
    const containerClient = blobServiceClient.getContainerClient(containerName)
    const { succeeded } = await containerClient.createIfNotExists({ access: 'blob' })
    initializedContainers.add(containerName)
    if (succeeded) console.log(`^7[INFO]Container "${config.AzureStorage.AccountName}/${containerName}" created.^0`)
}

function isIpConnected(ipToCheck: string) {
    for (let i = 0; i < GetNumPlayerIndices(); i++) {
        const source = GetPlayerFromIndex(i)
        const ip = GetPlayerEndpoint(source)

        if (ipToCheck === ip) {
            return true
        }
    }

    return false
}

router.post('', upload.single('file'), async (ctx) => {
    const { Security, Limits, AzureStorage } = config
    const { ApiKey: apiKey, RequireOrigin: requireOrigin, RequireConnected: requireConnected } = Security
    const { Mimes: mimes, FileSize: fileSize } = Limits
    const { mimetype, buffer } = ctx.file

    if (mimes && !mimes.includes(mimetype)) {
        ctx.status = 415
        ctx.body = 'Unallowed mime type'
        console.log('^3[WARN]Unallowed mime type' + mimetype + '^0')
        return
    }

    if (fileSize && ctx.file.size > fileSize * MB) {
        ctx.status = 413
        ctx.body = 'File is too large'
        console.log('^3[WARN]File is too large ' + ctx.file.size / MB + 'MB^0')
        return
    }

    if (ctx.file.size === 0) {
        ctx.status = 400
        ctx.body = 'Invalid empty file uploaded'
        console.log('^3[WARN]Invalid empty file uploaded^0')
        return
    }

    const extension = mime.getExtension(mimetype)

    if (!extension || !buffer) {
        ctx.status = 400
        ctx.body = 'Invalid file type'
        console.log('^3[WARN]Invalid file type^0')
        return
    }

    if (apiKey && apiKey !== ctx.headers.authorization) {
        ctx.status = 401
        ctx.body = 'Invalid API key'
        console.log('^3[WARN]Invalid API key^0')
        return
    }

    if (requireOrigin && (typeof ctx.headers.origin !== 'string' || !requireOrigin.includes(ctx.headers.origin))) {
        ctx.status = 403
        ctx.body = 'Invalid origin'
        console.log('^3[WARN]Invalid origin^0')
        return
    }

    if (requireConnected && ctx.ip !== '127.0.0.1' && !isIpConnected(ctx.ip)) {
        ctx.status = 403
        ctx.body = 'Not connected to FiveM server'
        console.log('^3[WARN]Not connected to FiveM server^0')
        return
    }

    const { ContainerName } = AzureStorage
    let containerName: string
    if (mimetype.startsWith('image/')) {
        containerName = ContainerName.Images
    } else if (mimetype.startsWith('video/')) {
        containerName = ContainerName.Videos
    } else {
        containerName = ContainerName.Audio
    }

    try {
        await ensureContainer(containerName)
    } catch (err) {
        ctx.status = 503
        ctx.body = 'Storage container unavailable'
        console.error('^1[ERROR]Failed to ensure container:^0', err)
        return
    }

    const filename = `${uuid()}.${extension}`
    const containerClient = blobServiceClient.getContainerClient(containerName)
    const blockBlobClient = containerClient.getBlockBlobClient(filename)
    try {
        await blockBlobClient.upload(buffer, buffer.length)
    } catch (err) {
        ctx.status = 500
        ctx.body = 'Upload failed'
        console.error('^1[ERROR]Upload failed:^0', err)
        return
    }

    const link = blockBlobClient.url

    ctx.status = 200
    ctx.body = { filename, link }
})

app.use(router.routes())
app.use(router.allowedMethods())

setHttpCallback(app.callback())
