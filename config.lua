Config = {}

Config.Security = {}
Config.Security.RequireConnected = false -- Should only players who are connected to your server be able to upload media?
Config.Security.ApiKey = "your_api_key"  -- set to false to disable
Config.Security.RequireOrigin = false
-- Config.Security.RequireOrigin = {
-- 	"https://cfx-nui-lb-phone",
-- 	"https://cfx-nui-lb-tablet",
-- }

Config.Limits = {}
Config.Limits.FileSize = 50 -- in MB
Config.Limits.Mimes = {     -- set to false to allow uploading any file types
	"audio/mpeg",
	"audio/ogg",
	"audio/opus",
	"audio/webm",
	"audio/mp3",

	"video/mp4",
	"video/webm",
	"video/mpeg",
	"video/ogg",

	"image/jpeg",
	"image/png",
	"image/webp"
}

Config.AzureStorage = {}
Config.AzureStorage.AccountName = "your_storage_account_name"
Config.AzureStorage.AccountKey = "your_storage_account_key"
Config.AzureStorage.ContainerName = {}
Config.AzureStorage.ContainerName.Images = "images"
Config.AzureStorage.ContainerName.Videos = "videos"
Config.AzureStorage.ContainerName.Audio = "audio"
