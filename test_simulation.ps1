# Test script for SafeEscape simulation setup

$BackendUrl = "http://localhost:8000"

# Step 1: Create a simple grid layout
Write-Host "Step 1: Creating grid layout..." -ForegroundColor Green
$gridData = @(
    @("empty", "empty", "empty", "empty", "empty"),
    @("empty", "room", "room", "room", "empty"),
    @("empty", "room", "room", "room", "empty"),
    @("empty", "room", "exit", "room", "empty"),
    @("empty", "empty", "empty", "empty", "empty")
)

$payload = @{
    grid_data = @{
        grid = $gridData
    }
} | ConvertTo-Json -Depth 10

Write-Host "Payload: $payload" -ForegroundColor Yellow

# Step 2: Parse grid to create graph
Write-Host "`nStep 2: Parsing grid layout..." -ForegroundColor Green
try {
    $parseResponse = Invoke-RestMethod -Uri "$BackendUrl/parse-grid" `
        -Method Post `
        -ContentType "application/json" `
        -Body $payload
    
    Write-Host "Parse Response: $($parseResponse | ConvertTo-Json)" -ForegroundColor Cyan
    Write-Host "[OK] Grid parsed successfully!" -ForegroundColor Green
}
catch {
    Write-Host "[FAIL] Failed to parse grid: $_" -ForegroundColor Red
    exit 1
}

# Step 3: Setup simulation
Write-Host "`nStep 3: Setting up simulation..." -ForegroundColor Green
try {
    $setupPayload = @{
        agent_count = 10
        start_room = "room_0"
        fire_origin = "room_1"
    } | ConvertTo-Json
    
    $setupResponse = Invoke-RestMethod -Uri "$BackendUrl/setup-simulation" `
        -Method Post `
        -ContentType "application/json" `
        -Body $setupPayload
    
    Write-Host "Setup Response: $($setupResponse | ConvertTo-Json)" -ForegroundColor Cyan
    Write-Host "[OK] Simulation setup successful!" -ForegroundColor Green
}
catch {
    Write-Host "[FAIL] Failed to setup simulation: $_" -ForegroundColor Red
    exit 1
}

Write-Host "`n[OK] All tests passed!" -ForegroundColor Green
