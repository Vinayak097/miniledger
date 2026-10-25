# MiniLedger Mobile

An Expo / React Native app for tracking money lent to friends. Sign in with a phone number and one-time code, review the ledger summary, add an entry, and mark entries as paid back.

The signed-in session is saved locally so closing or refreshing the app does not sign you out. On Android and iOS, the token uses Expo SecureStore; on web, it uses browser storage. Use **Sign out** to remove the saved session.

## Run the app

Configure the API URL in `miniledger-mobile/.env` before starting Expo. For the Android Studio emulator, copy `.env.example` as `.env`; it uses `http://10.0.2.2:3000`. For Expo Go on a physical phone, set the URL to your computer's LAN IP, for example `http://192.168.1.20:3000`. The phone and computer must be on the same network. Find the computer's LAN IP in its network settings, and make sure its firewall allows connections to port `3000`.

On a physical device using Expo Go, the app also tries to use the host from the Expo development server automatically. Setting `EXPO_PUBLIC_API_URL` explicitly is recommended if that host is not reachable from the device.

```bash
npm install
npm run start
```

For example, in PowerShell from `miniledger-mobile`:

```powershell
Copy-Item .env.example .env
npm run start
```

After changing `.env`, restart Expo so the public environment variable is reloaded. The app defaults to `http://localhost:3000` for web and iOS simulators, and `http://10.0.2.2:3000` for Android emulators.

Start the API in a second terminal from `backend` with `npm install` and `npm run start`. It listens on port `3000` by default; set `PORT` to use another port. The API enables CORS for browser requests from the Expo web app.

## Backend notes

The API provides OTP authentication, loan listing, creation, repayment, and summary endpoints. No SMS provider is configured, so the development OTP is printed in the backend terminal. Production requests return an explicit error until an SMS provider is configured.

## Checks

```bash
npx expo lint
npx tsc --noEmit
```
