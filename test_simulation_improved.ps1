# Improved test script with proper building layout including exits

$BackendUrl = "http://localhost:8000"

Write-Host "SafeEscape Simulation Test with Complete Building Layout" -ForegroundColor Cyan
Write-Host "=========================================================`n" -ForegroundColor Cyan

# Create a layout with separated rooms, corridors connecting them, and exits
# Grid visualization with walls (wall separates rooms):
# ┌─────────┬─────────┐
# │ room_0  │ room_1  │
# │ (exit)  │         │
# ├─────────┼─────────┤
# │ room_2  │ room_3  │
# │         │ (exit)  │
# └─────────┴─────────┘

Write-Host "Creating building layout with 4 separated rooms..." -ForegroundColor Green
$gridData = @(
    @("empty", "empty", "empty", "empty", "empty", "empty", "empty", "empty", "empty"),
    @("empty", "room", "room", "wall", "room", "room", "wall", "exit", "empty"),
    @("empty", "room", "exit", "wall", "room", "room", "wall", "room", "empty"),
    @("empty", "room", "room", "wall", "room", "room", "wall", "room", "empty"),
    @("empty", "wall", "wall", "wall", "wall", "wall", "wall", "wall", "empty"),
    @("empty", "room", "room", "wall", "room", "room", "wall", "room", "empty"),
    @("empty", "room", "room", "wall", "room", "exit", "wall", "room", "empty"),
    @("empty", "room", "room", "wall", "room", "room", "wall", "room", "empty"),
    @("empty", "empty", "empty", "empty", "empty", "empty", "empty", "empty", "empty")
)

$payload = @{
    grid_data = @{
        grid = $gridData
    }
} | ConvertTo-Json -Depth 10

Write-Host "Step 1: Parsing grid layout to create graph..." -ForegroundColor Green
try {
    $parseResponse = Invoke-RestMethod -Uri "$BackendUrl/parse-grid" `
        -Method Post `
        -ContentType "application/json" `
        -Body $payload
    
    Write-Host "Parse Response:" -ForegroundColor Yellow
    Write-Host ($parseResponse | ConvertTo-Json) -ForegroundColor White
    Write-Host "`n[OK] Grid parsed - $($parseResponse.room_count) rooms detected" -ForegroundColor Green
    
    # Display room info
    Write-Host "`nRoom Details:" -ForegroundColor Cyan
    $parseResponse.rooms.PSObject.Properties | ForEach-Object {
        $room = $_.Value
        Write-Host "  $($room.id): at ($($room.x),$($room.y)) size $($room.width)x$($room.height) - Exit: $($room.is_exit)" -ForegroundColor Gray
    }
    
    # Display corridor info
    Write-Host "`nCorridors: $($parseResponse.corridors.Count) connections" -ForegroundColor Cyan
    $parseResponse.corridors | ForEach-Object {
        Write-Host "  $($_.from) <-> $($_.to)" -ForegroundColor Gray
    }
}
catch {
    Write-Host "[FAIL] Failed to parse grid: $_" -ForegroundColor Red
    exit 1
}

Write-Host "`nStep 2: Setting up simulation..." -ForegroundColor Green
try {
    $setupPayload = @{
        agent_count = 20
        start_room = "room_0"
        fire_origin = "room_1"
    } | ConvertTo-Json
    
    $setupResponse = Invoke-RestMethod -Uri "$BackendUrl/setup-simulation" `
        -Method Post `
        -ContentType "application/json" `
        -Body $setupPayload
    
    Write-Host "Setup Response:" -ForegroundColor Yellow
    Write-Host ($setupResponse | ConvertTo-Json) -ForegroundColor White
    Write-Host "[OK] Simulation setup successful!" -ForegroundColor Green
}
catch {
    Write-Host "[FAIL] Failed to setup simulation: $_" -ForegroundColor Red
    exit 1
}

Write-Host "`nStep 3: Testing WebSocket connection..." -ForegroundColor Green
Write-Host "NOTE: WebSocket test requires special handling. Use the frontend UI instead." -ForegroundColor Yellow
Write-Host "      Navigate to http://localhost:5175 and click 'Start Simulation'" -ForegroundColor Yellow

Write-Host "`n[OK] Backend simulation ready!" -ForegroundColor Green
Write-Host "Next: Open http://localhost:5175 in your browser to see the simulation" -ForegroundColor Cyan
