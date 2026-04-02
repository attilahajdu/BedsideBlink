# BedsideBlink

Blink-controlled communicator for bed-bound patients on Samsung S24 Ultra.

## Requirements

- Android 15 (API 35)
- Samsung S24 Ultra front camera
- **Gesture**: Long blink only (eyes open probability < 0.3 for 700ms)
- No head movement, no gaze tracking, no calibration needed

## Run locally (no Android Studio)

### Browser (MacBook) – recommended

**One command** – from Terminal:

```bash
cd ~/BedsideBlink
./serve.sh
```

Then open **http://localhost:8080** in your browser. Allow camera access when prompted.

- Runs entirely in the browser – no build, no APK
- Same flow: Calibration → Region → Need → Message
- Works on MacBook Pro webcam (or any device on same WiFi: `http://YOUR_MAC_IP:8080`)

Custom port: `./serve.sh 9000`

**iPad / iPhone on the same Wi‑Fi:** Opening `http://YOUR_MAC_IP:8080` in Safari **will not enable the camera** — the page is not a “secure context,” so `navigator.mediaDevices` stays unavailable and you may see a cryptic error. For real device testing you need **HTTPS** (your production URL, GitHub Pages, or a dev tunnel such as [ngrok](https://ngrok.com/) / Cloudflare Tunnel that serves `https://…`). `http://localhost:8080` only works for camera when the browser runs **on the same machine** as the server (e.g. testing on the Mac).

#### Browser support (web)

Verify the web app on **Chrome (desktop)** and **Safari on iPad** over **HTTPS** in production (localhost is fine for development).

**Release gate:** Do not ship a web release without manual checks on **Tier A** (Chrome desktop) and **Tier B** (Safari on iPad, portrait and landscape). Record iPad model, iPadOS version, and whether testing used a normal tab or **Add to Home Screen**.

| Tier | Environment | Role |
|------|-------------|------|
| **A** | Chrome (macOS/Windows) | Primary development and regression |
| **B** | Safari on iPad (same Wi‑Fi as the server URL) | Touch, safe areas, camera permissions, split view |
| **C** | Safari on iPhone (optional) | Narrow viewport smoke test |

**For bedside IT / nursing staff**

- Serve over **HTTPS** on the ward network; browsers only expose the camera in a secure context (with an exception for `http://localhost` during setup).
- **Lighting:** soft, even light on the face; avoid a bright window behind the patient.
- **Mount:** stable tablet stand at roughly arm’s length, front camera unobstructed.
- **Permissions:** if the camera never starts, use Safari → **aA** in the address bar → **Website Settings** → **Camera**, or **Settings → Safari → Camera**, then reload the page.
- If a device policy blocks required scripts, try **Chrome** on the same tablet when allowed.
- **If something breaks:** reload the page, confirm camera permission for this site, try a private tab to rule out stale settings, and use **Chrome on a laptop** as a fallback when hospital policy allows.

**Supported (web):** latest **Chrome** on desktop; latest **Safari** on iPad. Stable Wi‑Fi for the **first** load (MediaPipe assets). Same mounting and lighting expectations as the native app: prop the device so the front camera sees the patient’s face clearly.

### Android APK (optional)

```bash
./run.sh          # build APK
./install.sh      # install via adb (USB debugging on)
```

## Setup (with Android Studio)

1. Open the project in **Android Studio** (File → Open → select `BedsideBlink` folder).
2. Wait for Gradle sync to complete.
3. Connect Samsung S24 Ultra via USB with USB debugging enabled.
4. Click **Run** (green triangle) or press Shift+F10.

## Permissions

- CAMERA (front camera for face/blink detection)
- POST_NOTIFICATIONS (optional)

## Flow

1. **Calibration** – Position phone 40–60cm from face. Hold still for 10s. Green outline when face detected. Tap START when enabled.
2. **Region Select** – 4 body regions cycle every 4s (configurable). BLINK to select. Orange highlight = current.
3. **Need Select** – 4 needs per region cycle. BLINK to select.
4. **Message** – Full-screen alert with region + need, TTS readout, 10s display. Red RESET to go back.

## Settings (FAB top-right)

- Cycle speed: 3s, 4s, 5s, 6s
- TTS volume slider
- Test blink button
- Back to calibration

## Error Handling

- No face for 30s on Region/Need → overlay countdown → auto return to Calibration.

## Test Vertical Slice

1. Run app → Calibration screen.
2. Hold face in view 10s → START enabled.
3. Tap START → Region select.
4. Blink long (~700ms) when desired region highlighted → advances to Need select.
5. Check LogCat for `BLINK!` when blink detected.

## Technical Stack

- Jetpack Compose, Material3
- CameraX + ML Kit Face Detection
- min(leftEyeProb, rightEyeProb) < 0.3 for 700ms = blink
