import AsyncStorage from '@react-native-async-storage/async-storage';

const AUTH_TOKEN_KEY = 'miniledger.authToken';

export function getAuthToken() {
  return AsyncStorage.getItem(AUTH_TOKEN_KEY);
}

export function saveAuthToken(token: string) {
  return AsyncStorage.setItem(AUTH_TOKEN_KEY, token);
}

export function removeAuthToken() {
  return AsyncStorage.removeItem(AUTH_TOKEN_KEY);
}
