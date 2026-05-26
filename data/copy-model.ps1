$src  = "$env:USERPROFILE\.ollama\models"
$dest = "C:\Alan\deepseek\projects\OpenTutor\ver7.0\data\models"

# 1. Copy the manifest for qwen2.5-coder:3b
Copy-Item "$src\manifests\registry.ollama.ai\library\qwen2.5-coder\3b" `
          "$dest\manifests\registry.ollama.ai\library\qwen2.5-coder\" `
          -Recurse -Force

# 2. Find the blob hashes referenced by that manifest and copy only those
$manifest = Get-Content "$src\manifests\registry.ollama.ai\library\qwen2.5-coder\3b" | ConvertFrom-Json
$hashes = @($manifest.config.digest) + ($manifest.layers | ForEach-Object { $_.digest })

foreach ($hash in $hashes) {
    $filename = $hash -replace ":", "-"
    $srcBlob  = "$src\blobs\$filename"
    if (Test-Path $srcBlob) {
        Write-Host "Copying $filename..."
        Copy-Item $srcBlob "$dest\blobs\" -Force
    }
}

Write-Host "Done."