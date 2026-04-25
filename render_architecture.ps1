Add-Type -AssemblyName System.Drawing

$outPath = Join-Path $PSScriptRoot "architecture_diagram.png"

$bmp = New-Object System.Drawing.Bitmap 1800, 1200
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$g.Clear([System.Drawing.Color]::White)

$titleFont = New-Object System.Drawing.Font("Arial", 16, [System.Drawing.FontStyle]::Bold)
$headFont = New-Object System.Drawing.Font("Arial", 11, [System.Drawing.FontStyle]::Bold)
$textFont = New-Object System.Drawing.Font("Arial", 9)
$black = [System.Drawing.Brushes]::Black
$white = [System.Drawing.Brushes]::White
$pen = New-Object System.Drawing.Pen([System.Drawing.Color]::Black, 2)
$arrowPen = New-Object System.Drawing.Pen([System.Drawing.Color]::Black, 2)
$arrowPen.CustomEndCap = New-Object System.Drawing.Drawing2D.AdjustableArrowCap(4, 6)

function Draw-Box($x, $y, $w, $h, $fill, $label, $font, $brush) {
    $b = New-Object System.Drawing.SolidBrush([System.Drawing.ColorTranslator]::FromHtml($fill))
    $g.FillRectangle($b, $x, $y, $w, $h)
    $g.DrawRectangle($pen, $x, $y, $w, $h)
    $sf = New-Object System.Drawing.StringFormat
    $sf.Alignment = [System.Drawing.StringAlignment]::Center
    $sf.LineAlignment = [System.Drawing.StringAlignment]::Center
    $g.DrawString($label, $font, $brush, [System.Drawing.RectangleF]::new($x, $y, $w, $h), $sf)
    $sf.Dispose()
    $b.Dispose()
}

function Draw-Section($x, $y, $w, $h, $header, $headerFill, $bodyFill, $items) {
    $body = New-Object System.Drawing.SolidBrush([System.Drawing.ColorTranslator]::FromHtml($bodyFill))
    $headerBrush = New-Object System.Drawing.SolidBrush([System.Drawing.ColorTranslator]::FromHtml($headerFill))
    $g.FillRectangle($body, $x, $y, $w, $h)
    $g.DrawRectangle($pen, $x, $y, $w, $h)
    $g.FillRectangle($headerBrush, $x, $y, $w, 34)
    $g.DrawRectangle($pen, $x, $y, $w, 34)
    $g.DrawString($header, $headFont, $black, $x + 10, $y + 8)

    $iy = $y + 48
    foreach ($item in $items) {
        $g.FillRectangle([System.Drawing.Brushes]::White, $x + 12, $iy, $w - 24, 28)
        $g.DrawRectangle($pen, $x + 12, $iy, $w - 24, 28)
        $g.DrawString($item, $textFont, $black, $x + 22, $iy + 7)
        $iy += 38
    }

    $body.Dispose()
    $headerBrush.Dispose()
}

Draw-Box 780 20 220 46 "#FFFFFF" "User" $titleFont $black
Draw-Box 520 90 760 50 "#FFFFFF" "Mobile Client: Expo / React Native" $titleFont $black
Draw-Box 520 160 760 42 "#4B5563" "App.js Root Controller" $titleFont $white

$g.DrawLine($arrowPen, 890, 66, 890, 90)
$g.DrawLine($arrowPen, 890, 140, 890, 160)

Draw-Section 30 260 250 430 "Feature Screens" "#BFDBFE" "#EFF6FF" @(
    "LoginScreen",
    "OnboardingScreen",
    "HomeScreen",
    "ProgressScreen",
    "OracleScreen",
    "ExerciseScreen",
    "WalkScreen",
    "ProfileScreen",
    "FailedScreen"
)

Draw-Section 310 260 250 320 "Shared UI Components" "#D1FAE5" "#F0FDF4" @(
    "CalorieChart",
    "TimerDisplay",
    "RepCounter",
    "WeaponBadge",
    "WeaponBadgesModal",
    "LevelUpModal"
)

Draw-Section 590 260 320 360 "Domain Logic Inside App.js" "#BAE6FD" "#EFF6FF" @(
    "Exercise Catalog",
    "Weapon Catalog",
    "Calorie Logic",
    "Calendar Logic",
    "Progression Logic",
    "Adaptive Difficulty",
    "AI Workout Gen",
    "AI Walk Gen",
    "groupWorkoutSessions"
)

Draw-Section 940 260 300 130 "lib/supabase.js" "#E5E7EB" "#F9FAFB" @(
    "Shared Supabase client",
    "Auth session persistence",
    "Database access"
)

Draw-Section 30 760 250 190 "Device / Expo APIs" "#FED7AA" "#FFF7ED" @(
    "expo-location",
    "expo-linking",
    "expo-av Video",
    "AsyncStorage"
)

Draw-Section 310 760 420 280 "src/utils/walk.js" "#BBF7D0" "#ECFDF5" @(
    "destinationPoint",
    "haversineDistance (approx.)",
    "save/load/clearActiveWalkState",
    "Google Maps URL builders",
    "buildWalkSessionEntry",
    "computeWalkProgress",
    "formatDistance / formatElapsedTime"
)

Draw-Section 1260 700 330 260 "External Services / Data Layer" "#DDD6FE" "#F5F3FF" @(
    "Supabase Auth",
    "profiles table",
    "sessions table",
    "walk_sessions table",
    "Groq LLM API",
    "Supabase Storage"
)

# Main arrows
$g.DrawLine($arrowPen, 650, 202, 150, 260)
$g.DrawLine($arrowPen, 800, 202, 420, 260)
$g.DrawLine($arrowPen, 900, 202, 740, 260)
$g.DrawLine($arrowPen, 1060, 202, 1090, 260)
$g.DrawLine($arrowPen, 150, 690, 150, 760)
$g.DrawLine($arrowPen, 420, 580, 420, 760)
$g.DrawLine($arrowPen, 1090, 390, 1090, 760)
$g.DrawLine($arrowPen, 730, 900, 1260, 900)

# Labels
$g.DrawString("Groq is used by AI workout generation, AI walk generation, and Oracle chat.", $textFont, $black, 910, 650)
$g.DrawString("Supabase Storage mainly serves exercise video assets.", $textFont, $black, 910, 670)
$g.DrawString("Expo Location + Linking are mainly used by WalkScreen.", $textFont, $black, 30, 730)
$g.DrawString("Expo AV is mainly used by ExerciseScreen.", $textFont, $black, 30, 745)

$bmp.Save($outPath, [System.Drawing.Imaging.ImageFormat]::Png)

$arrowPen.Dispose()
$pen.Dispose()
$titleFont.Dispose()
$headFont.Dispose()
$textFont.Dispose()
$g.Dispose()
$bmp.Dispose()

Write-Output $outPath
