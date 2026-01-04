# Kill any process using port 60006
$connections = netstat -ano | Select-String ':60006.*LISTENING'
foreach ($conn in $connections) {
    $parts = $conn -split '\s+'
    $pid = $parts[-1]
    if ($pid -match '^\d+$') {
        Write-Host "Killing PID $pid on port 60006"
        Stop-Process -Id $pid -Force -ErrorAction SilentlyContinue
    }
}
Write-Host "Done - port 60006 should be free"
