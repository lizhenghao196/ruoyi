Add-Type -AssemblyName System.Drawing
$img1 = [System.Drawing.Image]::FromFile("E:\code\2026\RuoYi-Vue-master\RuoYi-Vue-master\.codex\img\1.jpg")
$img1.Save("E:\code\2026\RuoYi-Vue-master\RuoYi-Vue-master\.codex\img\1.png", [System.Drawing.Imaging.ImageFormat]::Png)
$img1.Dispose()
$img2 = [System.Drawing.Image]::FromFile("E:\code\2026\RuoYi-Vue-master\RuoYi-Vue-master\.codex\img\2.jpg")
$img2.Save("E:\code\2026\RuoYi-Vue-master\RuoYi-Vue-master\.codex\img\2.png", [System.Drawing.Imaging.ImageFormat]::Png)
$img2.Dispose()
Write-Output "Done"
