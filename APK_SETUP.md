# Android APK Setup

This project is now configured with two Android build profiles:

- `preview`: installable `.apk` for direct phone testing
- `production`: Play Store `.aab`

## 1. Set the backend URL

Create or update your local `.env` file:

```env
EXPO_PUBLIC_API_BASE_URL=https://your-live-backend.example.com
```

Use your real hosted backend URL here. A phone build cannot use `localhost`, `127.0.0.1`, or `10.0.2.2`.

## 2. Optional: store the same value in EAS

If you want Expo cloud builds to keep using the same backend URL, add it to EAS:

```powershell
eas env:create --name EXPO_PUBLIC_API_BASE_URL --value https://your-live-backend.example.com --environment preview --visibility plaintext
eas env:create --name EXPO_PUBLIC_API_BASE_URL --value https://your-live-backend.example.com --environment production --visibility plaintext
```

## 3. Log in to Expo

```powershell
npm install -g eas-cli
eas login
```

## 4. Build the APK

```powershell
eas build --platform android --profile preview
```

This creates an installable Android `.apk`.

## 5. Install on your phone

- Open the build link from Expo on your Android phone.
- Download the APK.
- Allow installs from unknown sources if Android asks.
- Install the app.

## 6. Production build later

When you want the Play Store file instead:

```powershell
eas build --platform android --profile production
```
