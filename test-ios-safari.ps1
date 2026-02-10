$iphoneUA = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1"
$androidUA = "Mozilla/5.0 (Linux; Android 14; Pixel 8 Pro) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.6099.144 Mobile Safari/537.36"
$desktopUA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"

Write-Host "=== TESTING iOS Safari UA ==="
try {
    $r = Invoke-WebRequest -Uri "http://localhost:8081" -UseBasicParsing -UserAgent $iphoneUA -TimeoutSec 10
    Write-Host "Status: $($r.StatusCode)"
    Write-Host "Content-Length: $($r.Content.Length)"
    Write-Host "Content-Type: $($r.Headers['Content-Type'])"
    Write-Host "First 1000 chars:"
    Write-Host $r.Content.Substring(0, [Math]::Min(1000, $r.Content.Length))
} catch {
    Write-Host "ERROR: $_"
}

Write-Host ""
Write-Host "=== TESTING Android UA ==="
try {
    $r2 = Invoke-WebRequest -Uri "http://localhost:8081" -UseBasicParsing -UserAgent $androidUA -TimeoutSec 10
    Write-Host "Status: $($r2.StatusCode)"
    Write-Host "Content-Length: $($r2.Content.Length)"
    Write-Host "Content-Type: $($r2.Headers['Content-Type'])"
    Write-Host "First 1000 chars:"
    Write-Host $r2.Content.Substring(0, [Math]::Min(1000, $r2.Content.Length))
} catch {
    Write-Host "ERROR: $_"
}

Write-Host ""
Write-Host "=== COMPARING RESPONSES ==="
if ($r -and $r2) {
    if ($r.Content -eq $r2.Content) {
        Write-Host "SAME HTML returned for both user agents"
    } else {
        Write-Host "DIFFERENT HTML returned!"
        Write-Host "iOS length: $($r.Content.Length) | Android length: $($r2.Content.Length)"
    }
}

