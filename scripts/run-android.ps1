# Builds the Landloper development build and installs it on a device.
#
#   .\scripts\run-android.ps1                 # pick from connected devices
#   .\scripts\run-android.ps1 -Device <name>  # a specific phone or emulator
#   .\scripts\run-android.ps1 -Release        # field-test build (ADR 0011)
#   .\scripts\run-android.ps1 -Clean          # regenerate android/ first
#
# Use -Clean after changing app.json or adding a native module: `expo
# run:android` reuses an existing android/ folder and does not re-apply
# config plugins (permissions, services) to it.
#
# Sets up, for this window only: Node (via fnm), Java (Android Studio's
# bundled JDK) and the Android SDK paths. Then runs `npx expo run:android`,
# which builds the debug APK for that device, installs it, and starts the
# dev server. Leave the window open while using the app; Ctrl+C stops it.
#
# -Release builds the release variant instead: JavaScript bundled into the
# app, no dev server needed, so it works away from the PC (real walks).
# Signed with the debug key; for side-loading only.

param([string]$Device, [switch]$Release, [switch]$Clean)

$ErrorActionPreference = "Stop"
Set-Location (Split-Path $PSScriptRoot -Parent)

fnm env --shell powershell | Out-String | Invoke-Expression
fnm use default | Out-Null

$env:JAVA_HOME = "C:\Program Files\Android\Android Studio\jbr"
$env:ANDROID_HOME = "$env:LOCALAPPDATA\Android\Sdk"
$env:Path = "$env:JAVA_HOME\bin;$env:ANDROID_HOME\platform-tools;$env:Path"

# Route each connected device's localhost:8081 to this PC over USB, so the
# app reaches the dev server without Wi-Fi or a firewall exception. In the
# app's server list, choose http://localhost:8081.
adb devices | Select-String "`tdevice$" | ForEach-Object {
  $serial = ($_ -split "`t")[0]
  adb -s $serial reverse tcp:8081 tcp:8081 | Out-Null
}

if ($Clean) {
  npx expo prebuild --platform android --clean
}

$expoArgs = @("expo", "run:android")
if ($Device) { $expoArgs += @("--device", $Device) }
if ($Release) { $expoArgs += @("--variant", "release") }
npx @expoArgs
