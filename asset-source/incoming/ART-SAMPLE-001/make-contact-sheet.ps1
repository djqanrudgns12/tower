$ErrorActionPreference='Stop'
Add-Type -AssemblyName System.Drawing
$assetDir=$PSScriptRoot
$order=@('tower.archer','tower.cannon','tower.frost','map.gate','tower.archer.weapon','tower.cannon.weapon','tower.frost.weapon','deco.stele','enemy.walker.0','enemy.walker.1','enemy.walker.2','enemy.walker.3','enemy.walker.hit','enemy.boss.0','enemy.boss.1','deco.tree')
$sheet=[System.Drawing.Bitmap]::new(1080,530,[System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$g=[System.Drawing.Graphics]::FromImage($sheet)
$g.Clear([System.Drawing.ColorTranslator]::FromHtml('#e9e3d3'))
$g.InterpolationMode=[System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$g.PixelOffsetMode=[System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
$font=[System.Drawing.Font]::new('Segoe UI',14)
$brush=[System.Drawing.SolidBrush]::new([System.Drawing.ColorTranslator]::FromHtml('#3a291e'))
$pen=[System.Drawing.Pen]::new([System.Drawing.ColorTranslator]::FromHtml('#bcb5a4'))
for($panel=0;$panel -lt 3;$panel++){
  $size=@(32,48,64)[$panel]
  $px=$panel*360
  $g.DrawString("$($size)px",$font,$brush,[single]($px+16),[single]12)
  for($i=0;$i -lt 16;$i++){
    $col=$i%4; $row=[math]::Floor($i/4)
    $cx=$px+45+$col*88; $cy=84+$row*96
    $path=Join-Path $assetDir "$($order[$i]).r1.png"
    if(Test-Path -LiteralPath $path){
      $im=[System.Drawing.Bitmap]::new($path)
      $g.DrawImage($im,[int]($cx-$size/2),[int]($cy-$size/2),[int]$size,[int]$size)
      $im.Dispose()
    }
  }
  $g.DrawLine($pen,$px+12,414,$px+348,414)
  # Combined previews: body stays at the chosen texture width and weapon uses
  # the exact displayCells ratio 0.8/1.1. These are inspection composites only.
  for($t=0;$t -lt 3;$t++){
    $id=@('archer','cannon','frost')[$t]
    $body=[System.Drawing.Bitmap]::new((Join-Path $assetDir "tower.$id.r1.png"))
    $weapon=[System.Drawing.Bitmap]::new((Join-Path $assetDir "tower.$id.weapon.r1.png"))
    $cx=$px+64+$t*112; $by=495-$size*.8125
    $g.DrawImage($body,[single]($cx-$size*.5),[single]$by,[single]$size,[single]$size)
    $ws=$size*.8/1.1
    $wy= switch($id){'archer'{$by+$size*.36};'cannon'{$by+$size*.40};'frost'{$by+$size*.31}}
    $g.DrawImage($weapon,[single]($cx-$ws*.5),[single]($wy-$ws*.5),[single]$ws,[single]$ws)
    $body.Dispose();$weapon.Dispose()
  }
}
$g.Dispose();$font.Dispose();$brush.Dispose();$pen.Dispose()
$sheet.Save((Join-Path $assetDir 'contact-sheet.png'),[System.Drawing.Imaging.ImageFormat]::Png)
$sheet.Dispose()
Write-Output 'contact-sheet.png: 1080x530, 32/48/64px, unlabeled sprites and tower composite previews'
