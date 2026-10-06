# Welcome to your Expo app 👋

This is an [Expo](https://expo.dev) project created with [`create-expo-app`](https://www.npmjs.com/package/create-expo-app).

## Get started

1. Install dependencies

   ```bash
   npm install
   ```

2. Start the app

   ```bash
   npx expo start
   ```

In the output, you'll find options to open the app in a

- [development build](https://docs.expo.dev/develop/development-builds/introduction/)
- [Android emulator](https://docs.expo.dev/workflow/android-studio-emulator/)
- [iOS simulator](https://docs.expo.dev/workflow/ios-simulator/)
- [Expo Go](https://expo.dev/go), a limited sandbox for trying out app development with Expo

You can start developing by editing the files inside the **app** directory. This project uses [file-based routing](https://docs.expo.dev/router/introduction).

### Other setup steps

- To set up ESLint for linting, run `npx expo lint`, or follow our guide on ["Using ESLint and Prettier"](https://docs.expo.dev/guides/using-eslint/)
- If you'd like to set up unit testing, follow our guide on ["Unit Testing with Jest"](https://docs.expo.dev/develop/unit-testing/)
- Learn more about the TypeScript setup in this template in our guide on ["Using TypeScript"](https://docs.expo.dev/guides/typescript/)

## Learn more

To learn more about developing your project with Expo, look at the following resources:

- [Expo documentation](https://docs.expo.dev/): Learn fundamentals, or go into advanced topics with our [guides](https://docs.expo.dev/guides).
- [Learn Expo tutorial](https://docs.expo.dev/tutorial/introduction/): Follow a step-by-step tutorial where you'll create a project that runs on Android, iOS, and the web.

## Join the community

Join our community of developers creating universal apps.

- [Expo on GitHub](https://github.com/expo/expo): View our open source platform and contribute.
- [Discord community](https://chat.expo.dev): Chat with Expo users and ask questions.

## Build the Android APK

The web deployment is a website, not an installable app. For a downloadable
`.apk`, build the native Android app with EAS Build. The `preview` profile in
`eas.json` is the APK profile (`buildType: "apk"`, internal distribution).

### Prerequisites

- A free Expo account at [expo.dev](https://expo.dev).
- The EAS CLI: `npm install -g eas-cli`
- Log in: `eas login`

### First time setup

Run `eas init` inside `EcoTrackApp/`. This registers the project and adds the
project ID to `app.json`. Commit and push that change.

### Build the APK

```bash
cd EcoTrackApp
npm run build:apk
```

This runs `eas build -p android --profile preview` in the cloud. Download the
`.apk` from the link printed in the terminal, or from
[expo.dev](https://expo.dev) → your project → Builds. Free-plan builds queue
and can take a while — leave the terminal open until it finishes.

The API address is baked in at build time via the `env` block in `eas.json`
(`EXPO_PUBLIC_API_URL`). A local `.env` is NOT uploaded to cloud builds, so
keep that value updated there. `EXPO_PUBLIC_APK_URL` is intentionally NOT in
the build env — the APK cannot link to itself.

### Installing the APK

1. Copy the `.apk` to the phone (download link, USB, or file sharing).
2. Open it and allow **"Install unknown apps"** for the browser/file manager
   once when prompted.
3. Google Play Protect may warn that the app is from outside the Play Store —
   this is expected for sideloaded builds.

### Publishing the download button

The login page shows a "DOWNLOAD ANDROID APP (APK)" button on web only, and
only when `EXPO_PUBLIC_APK_URL` is set.

1. Upload the `.apk` to GitHub Releases (e.g. tag `v1.0.0`) and copy the direct
   file link.
2. Set `EXPO_PUBLIC_APK_URL` to that link in the Vercel project's environment
   variables.
3. Redeploy — the value is inlined at build time, so a redeploy is required.

### Updating

- Bump `"version"` in `app.json` for each release.
- Installing a newer APK over the old one only works if it is signed with the
  **same keystore**. Keep the EAS-managed credentials and run
  `eas credentials` once to download a backup — never commit keystores,
  tokens, or real secrets to the repo.
