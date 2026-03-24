# Deploy Firestore Rules Script
# Since Firebase CLI deployment requires billing, use Firebase Console instead

Write-Host "📋 FIRESTORE RULES DEPLOYMENT INSTRUCTIONS" -ForegroundColor Cyan
Write-Host "============================================`n" -ForegroundColor Cyan

Write-Host "Since Firebase CLI requires billing enabled, please deploy manually:" -ForegroundColor Yellow
Write-Host "`n1. Go to: https://console.firebase.google.com/project/bharat-museum-tickets/firestore/rules`n" -ForegroundColor White

Write-Host "2. Replace the entire content with this:`n" -ForegroundColor White
Write-Host "---START COPY---" -ForegroundColor Green

Get-Content "D:\P\FYP\Bharat_Museum_Tickets\firestore.rules" | Write-Host -ForegroundColor Cyan

Write-Host "---END COPY---`n" -ForegroundColor Green

Write-Host "3. Click 'Publish' button`n" -ForegroundColor White

Write-Host "✅ These rules are more permissive for testing" -ForegroundColor Green
Write-Host "⚠️  Remember to tighten security after testing is complete`n" -ForegroundColor Yellow

Write-Host "Press any key to open Firebase Console..." -ForegroundColor Cyan
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")

Start-Process "https://console.firebase.google.com/project/bharat-museum-tickets/firestore/rules"
