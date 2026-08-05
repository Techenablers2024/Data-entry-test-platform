import * as SecureStore from 'expo-secure-store'

const TOKEN_KEY   = 'auth_token'
const DEVICE_KEY  = 'device_id'

export const storage = {
  getToken:   () => SecureStore.getItemAsync(TOKEN_KEY),
  setToken:   (v: string) => SecureStore.setItemAsync(TOKEN_KEY, v),
  removeToken: () => SecureStore.deleteItemAsync(TOKEN_KEY),
  getDeviceId: () => SecureStore.getItemAsync(DEVICE_KEY),
  setDeviceId: (v: string) => SecureStore.setItemAsync(DEVICE_KEY, v),
}
