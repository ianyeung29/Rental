# Capacitor preparation

Anjurentals currently uses a hosted Capacitor shell. The native app loads the deployed site while the existing Next.js server continues to handle authentication, Neon data, R2 uploads, Resend, OpenAI, and Google Maps. This keeps the Android/iOS prototype aligned with the production web app while the native release workflow is prepared.

## Current configuration

- App name: `Anjurentals`
- App ID: `com.anjurentals.app`
- Hosted URL: `https://www.anjurentals.com`
- Override the URL for a local or preview build with `CAPACITOR_SERVER_URL`.
- `capacitor-web/index.html` is a small offline fallback required by Capacitor; it is not the application UI.
- WebView top-level navigation is restricted to `anjurentals.com` and `www.anjurentals.com`.
- Google OAuth opens in the system browser and returns through `com.anjurentals.app://auth/callback` with a short-lived, single-use Neon handoff token.
- Native share sheets can share listing text, links, and generated poster files.
- Native camera/gallery actions feed the same R2 upload pipeline as the web file picker.
- Native push tokens are registered in Neon. Delivery still requires the platform provider setup below.

## Android preparation

Install the Android platform once:

```powershell
npm install @capacitor/android
npx cap add android
```

Sync and open the native project:

```powershell
npm run cap:sync
npm run cap:android:open
```

Or run directly on an attached device/emulator:

```powershell
npm run cap:android:run
```

## OAuth deep links

Google Cloud should keep the web callback URI pointed at the deployed server endpoint:

```text
https://www.anjurentals.com/api/auth/google/callback
```

The app does not use a Google redirect URI with the custom scheme. The server completes OAuth, issues a one-time handoff, and redirects to the app callback. Android includes the custom-scheme intent filter; iOS includes the custom URL scheme. For production HTTPS App Links / Universal Links, configure:

- `ANDROID_APP_SHA256_CERT_FINGERPRINT` with the release keystore SHA-256 fingerprint.
- `APPLE_TEAM_ID` with the Apple Developer Team ID.
- The generated `/.well-known/assetlinks.json` and `/.well-known/apple-app-site-association` endpoints are then served by Next.js.

## Native push prerequisites

Android needs the Firebase app configuration file at `android/app/google-services.json` (ignored by Git), plus the matching server-only `FIREBASE_SERVICE_ACCOUNT_JSON` secret. The server can then deliver Android tokens through FCM. iOS needs Push Notifications capability enabled in Xcode and an APNs key or certificate; iOS token registration is ready, but APNs delivery still needs to be connected before iOS devices receive pushes. Browser Web Push remains independent.

## Release signing

The release Gradle configuration is ready, but no private signing key is stored in the repository. Create it once on the development machine:

```powershell
New-Item -ItemType Directory -Force android\keystore
keytool -genkeypair -v -keystore android\keystore\anjurentals-release.jks -alias anjurentals -keyalg RSA -keysize 4096 -validity 10000
Copy-Item android\keystore.properties.example android\keystore.properties
# Edit android\keystore.properties with the keystore password and key password.
npx cap sync
Push-Location android
.\gradlew.bat bundleRelease
Pop-Location
```

The signed bundle will be written to `android/app/build/outputs/bundle/release/app-release.aab`. Keep the `.jks` file and `android/keystore.properties` backed up securely; losing them prevents future updates to the same Play Store app.

## Before store release

1. Add `google-services.json`, configure Firebase Cloud Messaging, and connect native delivery on the server.
2. Configure the Android release fingerprint and Apple Team ID for verified HTTPS links.
3. Test R2 file selection, camera/gallery uploads, image previews, share sheets, WeChat handoff, Maps, OAuth, push permission, and cookie/session behavior in the native web view.
4. Add final production app icons, splash screen, privacy declarations, store screenshots, and metadata.
5. Build iOS on macOS with Xcode; iOS cannot be compiled on this Windows workstation.
