# Builds the Landloper development build and installs it on a device.
#
#   .\scripts\run-android.ps1                 # pick from connected devices
#   .\scripts\run-android.ps1 -Device <name>  # a specific phone or emulator
#
# Sets up, for this window only: Node (via fnm), Java (Android Studio's
# bundled JDK) and the Android SDK paths. Then runs `npx expo run:android`,
# which builds the debug APK for that device, installs it, and starts the
# dev server. Leave the window open while using the app; Ctrl+C stops it.

param([string]$Device)

$ErrorActionPreference = "Stop"
Set-Location (Split-Path $PSScriptRoot -Parent)

fnm env --shell powershell | Out-String | Invoke-Expression
fnm use default | Out-Null

$env:JAVA_HOME = "C:\Program Files\Android\Android Studio\jbr"
$env:ANDROID_HOME = "$env:LOCALAPPDATA\Android\Sdk"
$env:Path = "$env:JAVA_HOME\bin;$env:ANDROID_HOME\platform-tools;$env:Path"

if ($Device) {
  npx expo run:android --device $Device
} else {
  npx expo run:android
}
