Add-Type -AssemblyName System.Drawing

$outPath = Join-Path $PSScriptRoot "database_er_diagram.png"

$bmp = New-Object System.Drawing.Bitmap 1600, 1100
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$g.Clear([System.Drawing.Color]::White)

$titleFont = New-Object System.Drawing.Font("Arial", 16, [System.Drawing.FontStyle]::Bold)
$headFont = New-Object System.Drawing.Font("Arial", 11, [System.Drawing.FontStyle]::Bold)
$textFont = New-Object System.Drawing.Font("Arial", 9)
$labelFont = New-Object System.Drawing.Font("Arial", 10, [System.Drawing.FontStyle]::Italic)
$black = [System.Drawing.Brushes]::Black
$white = [System.Drawing.Brushes]::White
$pen = New-Object System.Drawing.Pen([System.Drawing.Color]::Black, 2)
$arrowPen = New-Object System.Drawing.Pen([System.Drawing.Color]::Black, 2)
$arrowPen.CustomEndCap = New-Object System.Drawing.Drawing2D.AdjustableArrowCap(4, 6)

function Draw-Table($x, $y, $w, $header, $rows, $headerFill, $bodyFill) {
    $headerBrush = New-Object System.Drawing.SolidBrush([System.Drawing.ColorTranslator]::FromHtml($headerFill))
    $bodyBrush = New-Object System.Drawing.SolidBrush([System.Drawing.ColorTranslator]::FromHtml($bodyFill))
    $rowHeight = 32
    $h = 40 + ($rows.Count * $rowHeight)

    $g.FillRectangle($bodyBrush, $x, $y, $w, $h)
    $g.DrawRectangle($pen, $x, $y, $w, $h)
    $g.FillRectangle($headerBrush, $x, $y, $w, 40)
    $g.DrawRectangle($pen, $x, $y, $w, 40)
    $g.DrawString($header, $headFont, $black, $x + 12, $y + 11)

    $typeX = $x + 12
    $nameX = $x + 120
    $keyX = $x + $w - 80
    $lineY = $y + 40

    foreach ($row in $rows) {
        $g.DrawLine($pen, $x, $lineY, $x + $w, $lineY)
        $g.DrawString($row[0], $textFont, $black, $typeX, $lineY + 9)
        $g.DrawString($row[1], $textFont, $black, $nameX, $lineY + 9)
        $g.DrawString($row[2], $textFont, $black, $keyX, $lineY + 9)
        $lineY += $rowHeight
    }

    $headerBrush.Dispose()
    $bodyBrush.Dispose()

    return @{
        X = $x; Y = $y; W = $w; H = $h;
        MidTopX = $x + ($w / 2); MidTopY = $y;
        MidBottomX = $x + ($w / 2); MidBottomY = $y + $h;
        MidLeftX = $x; MidLeftY = $y + ($h / 2);
        MidRightX = $x + $w; MidRightY = $y + ($h / 2);
    }
}

$g.DrawString("Database ER Diagram", $titleFont, $black, 650, 20)

$auth = Draw-Table 620 80 360 "AUTH_USERS" @(
    @("uuid", "id", "PK")
) "#BFDBFE" "#EFF6FF"

$profiles = Draw-Table 1050 80 430 "PROFILES" @(
    @("uuid", "id", "PK, FK"),
    @("text", "display_name", ""),
    @("int", "age", ""),
    @("numeric(5,1)", "weight", ""),
    @("int", "height", ""),
    @("text", "fitness_level", ""),
    @("int", "xp", ""),
    @("int", "streak", ""),
    @("int", "best_streak", ""),
    @("text", "last_session_date", ""),
    @("jsonb", "equipped_cosmetics", ""),
    @("text[]", "unlocked_cosmetics", ""),
    @("timestamptz", "created_at", "")
) "#D1FAE5" "#F0FDF4"

$sessions = Draw-Table 230 520 400 "SESSIONS" @(
    @("uuid", "id", "PK"),
    @("uuid", "user_id", "FK"),
    @("text", "date", ""),
    @("text", "exercise", ""),
    @("text", "type", ""),
    @("int", "target", ""),
    @("boolean", "completed", ""),
    @("timestamptz", "created_at", "")
) "#FDE68A" "#FFFBEB"

$walks = Draw-Table 820 480 430 "WALK_SESSIONS" @(
    @("uuid", "id", "PK"),
    @("uuid", "user_id", "FK"),
    @("text", "date", ""),
    @("text", "objective", ""),
    @("text", "obj_type", ""),
    @("numeric(10,2)", "obj_value", ""),
    @("numeric(10,2)", "distance_m", ""),
    @("int", "duration_s", ""),
    @("int", "xp_earned", ""),
    @("boolean", "completed", ""),
    @("jsonb", "route", ""),
    @("timestamptz", "created_at", "")
) "#E9D5FF" "#FAF5FF"

# Relationships
$g.DrawLine($arrowPen, $auth.MidRightX, $auth.MidRightY, $profiles.MidLeftX, $profiles.MidLeftY)
$g.DrawString("1 to 1", $labelFont, $black, 1000, 210)

$g.DrawLine($arrowPen, $auth.MidBottomX - 80, $auth.MidBottomY, $sessions.MidTopX, $sessions.MidTopY)
$g.DrawString("1 to many", $labelFont, $black, 480, 420)

$g.DrawLine($arrowPen, $auth.MidBottomX + 40, $auth.MidBottomY, $walks.MidTopX, $walks.MidTopY)
$g.DrawString("1 to many", $labelFont, $black, 860, 390)

$g.DrawString("profiles.id references auth.users.id", $labelFont, $black, 1090, 520)
$g.DrawString("sessions.user_id references auth.users.id", $labelFont, $black, 180, 870)
$g.DrawString("walk_sessions.user_id references auth.users.id", $labelFont, $black, 760, 920)

$bmp.Save($outPath, [System.Drawing.Imaging.ImageFormat]::Png)

$arrowPen.Dispose()
$pen.Dispose()
$titleFont.Dispose()
$headFont.Dispose()
$textFont.Dispose()
$labelFont.Dispose()
$g.Dispose()
$bmp.Dispose()

Write-Output $outPath
