import * as SecureStore from 'expo-secure-store';

const AUTH_TOKEN_KEY = 'miniledger.authToken';

export function getAuthToken() {
  return SecureStore.getItemAsync(AUTH_TOKEN_KEY);
}

export function saveAuthToken(token: string) {
  return SecureStore.setItemAsync(AUTH_TOKEN_KEY, token);
}

export function removeAuthToken() {
  return SecureStore.deleteItemAsync(AUTH_TOKEN_KEY);
}
