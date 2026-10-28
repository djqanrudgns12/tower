$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
$assetDir = $PSScriptRoot

function Get-PngInfo([string]$path) {
  $im = [System.Drawing.Bitmap]::new($path)
  $left=$im.Width; $top=$im.Height; $right=-1; $bottom=-1
  $zero=0L; $partial=0L; $opaque=0L
  for ($y=0; $y -lt $im.Height; $y++) {
    for ($x=0; $x -lt $im.Width; $x++) {
      $a=$im.GetPixel($x,$y).A
      if ($a -eq 0) {$zero++} else {
        if ($a -eq 255) {$opaque++} else {$partial++}
        if ($a -ge 32) {
          if ($x -lt $left) {$left=$x}; if ($x -gt $right) {$right=$x}
          if ($y -lt $top) {$top=$y}; if ($y -gt $bottom) {$bottom=$y}
        }
      }
    }
  }
  $bytes=[System.IO.File]::ReadAllBytes($path)
  $info=[ordered]@{width=$im.Width;height=$im.Height;colorType=[int]$bytes[25];zero=$zero;partial=$partial;opaque=$opaque;boundsThreshold=32;bounds=@($left,$top,($right+1),($bottom+1))}
  $im.Dispose()
  return $info
}

function Save-Sprite($spec) {
  $source=Join-Path $assetDir $spec.source
  $info=Get-PngInfo $source
  if ($info.colorType -ne 6 -or $info.zero -eq 0 -or ($info.partial+$info.opaque) -eq 0) {throw "No genuine RGBA alpha: $($spec.id)"}
  $src=[System.Drawing.Bitmap]::new($source)
  $dst=[System.Drawing.Bitmap]::new([int]$spec.size,[int]$spec.size,[System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $g=[System.Drawing.Graphics]::FromImage($dst)
  $g.Clear([System.Drawing.Color]::Transparent)
  $g.CompositingMode=[System.Drawing.Drawing2D.CompositingMode]::SourceCopy
  $g.CompositingQuality=[System.Drawing.Drawing2D.CompositingQuality]::HighQuality
  $g.InterpolationMode=[System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $g.PixelOffsetMode=[System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
  $b=$info.bounds
  # Use visible bounds only to calculate placement. Draw the complete original;
  # never threshold, erase, recolor, or replace its alpha channel.
  $sx=$spec.drawWidth/($b[2]-$b[0]); $sy=$spec.drawHeight/($b[3]-$b[1])
  $rect=[System.Drawing.RectangleF]::new([single]($spec.left-$b[0]*$sx),[single]($spec.top-$b[1]*$sy),[single]($src.Width*$sx),[single]($src.Height*$sy))
  $srcRect=[System.Drawing.RectangleF]::new(0,0,[single]$src.Width,[single]$src.Height)
  $g.DrawImage($src,$rect,$srcRect,[System.Drawing.GraphicsUnit]::Pixel)
  $g.Dispose()
  $file="$($spec.id).r1.png"
  $dst.Save((Join-Path $assetDir $file),[System.Drawing.Imaging.ImageFormat]::Png)
  $src.Dispose();$dst.Dispose()
  return [ordered]@{id=$spec.id;source=$spec.source;sourceInfo=$info;file=$file;transform=$spec;artifactInfo=(Get-PngInfo (Join-Path $assetDir $file));sourceHash=(Get-FileHash -LiteralPath $source -Algorithm SHA256).Hash.ToLower();artifactHash=(Get-FileHash -LiteralPath (Join-Path $assetDir $file) -Algorithm SHA256).Hash.ToLower()}
}

if (Test-Path -LiteralPath (Join-Path $assetDir 'layout.json')) {
  $layout=Get-Content -LiteralPath (Join-Path $assetDir 'layout.json') -Raw | ConvertFrom-Json
  $report=@(foreach($spec in $layout) {Save-Sprite $spec})
  $report | ConvertTo-Json -Depth 12 | Set-Content -LiteralPath (Join-Path $assetDir 'technical-evidence.json') -Encoding utf8
  $report | ForEach-Object {[pscustomobject]@{id=$_.id;size="$($_.artifactInfo.width)x$($_.artifactInfo.height)";rgba=$_.artifactInfo.colorType;bounds=($_.artifactInfo.bounds -join ',')}} | Format-Table
}
