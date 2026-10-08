/**
 * Plays a straight walk northwards into a device's GPS, so the real
 * GpsProvider → background task → engine → notification chain can be
 * exercised at a desk (ADR 0012).
 *
 *   npm run walk -- --metres 300                      # emulator
 *   npm run walk -- --metres 300 --phone --serial X   # USB phone
 *
 * --metres  how far to walk (default 300)
 * --speed   metres per second (default 1.4, a normal walking pace)
 * --every   seconds between fixes (default 2)
 * --serial  adb device (default emulator-5554)
 * --phone   a real phone (Android 12+): temporarily replaces its GPS with a
 *           test provider, and removes it again at the end or on Ctrl+C.
 *           While it runs, the phone's real GPS is not used.
 *
 * The emulator mode uses `adb emu geo fix`, which needs an emulator whose
 * Google Play services is recent enough for expo-location.
 *
 * Needs adb on PATH, or ANDROID_HOME / LOCALAPPDATA to find it.
 */

import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";

const { values } = parseArgs({
  options: {
    metres: { type: "string", default: "300" },
    speed: { type: "string", default: "1.4" },
    every: { type: "string", default: "2" },
    serial: { type: "string", default: "emulator-5554" },
    phone: { type: "boolean", default: false },
  },
});

const metres = Number(values.metres);
const speed = Number(values.speed);
const every = Number(values.every);
const serial = values.serial!;

function findAdb(): string {
  const sdk = process.env.ANDROID_HOME ?? path.join(process.env.LOCALAPPDATA ?? "", "Android", "Sdk");
  const candidate = path.join(sdk, "platform-tools", process.platform === "win32" ? "adb.exe" : "adb");
  return existsSync(candidate) ? candidate : "adb";
}

const adbPath = findAdb();
function adb(...args: string[]): void {
  execFileSync(adbPath, ["-s", serial, ...args], { stdio: ["ignore", "ignore", "inherit"] });
}

const M_PER_DEG_LAT = (2 * Math.PI * 6_371_008.8) / 360;
// Start point: Utrecht, Netherlands. Any point works.
const START = { lat: 52.0907, lon: 5.1214 };

function sendFix(northM: number): void {
  const lat = (START.lat + northM / M_PER_DEG_LAT).toFixed(7);
  const lon = START.lon.toFixed(7);
  if (values.phone) {
    adb("shell", "cmd", "location", "providers", "set-test-provider-location", "gps",
      "--location", `${lat},${lon}`, "--accuracy", "5");
  } else {
    // geo fix takes longitude first.
    adb("emu", "geo", "fix", lon, lat);
  }
}

function setUpPhone(): void {
  adb("shell", "appops", "set", "com.android.shell", "android:mock_location", "allow");
  adb("shell", "cmd", "location", "providers", "add-test-provider", "gps",
    "--requiresSatellite", "--supportsAltitude", "--supportsSpeed", "--supportsBearing");
  adb("shell", "cmd", "location", "providers", "set-test-provider-enabled", "gps", "true");
}

let cleanedUp = false;
function restorePhone(): void {
  if (!values.phone || cleanedUp) return;
  cleanedUp = true;
  try {
    adb("shell", "cmd", "location", "providers", "remove-test-provider", "gps");
    adb("shell", "appops", "set", "com.android.shell", "android:mock_location", "default");
    console.log("Phone GPS restored.");
  } catch (error) {
    console.error(`Could not restore the phone's GPS: ${String(error)}`);
    console.error("Restart the phone to be sure real GPS is back.");
  }
}

process.on("SIGINT", () => {
  restorePhone();
  process.exit(130);
});

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

if (values.phone) setUpPhone();
try {
  const steps = Math.ceil(metres / (speed * every));
  console.log(
    `Walking ${metres} m at ${speed} m/s, a fix every ${every} s (${steps} fixes, ~${Math.round(steps * every)} s).`,
  );
  for (let i = 0; i <= steps; i++) {
    const north = Math.min(metres, i * speed * every);
    sendFix(north);
    if (i % 10 === 0) console.log(`  ${north.toFixed(0)} m`);
    await sleep(every * 1000);
  }
  console.log("Done.");
} finally {
  restorePhone();
}
