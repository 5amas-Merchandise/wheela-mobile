// src/utils/auth.js
import AsyncStorage from '@react-native-async-storage/async-storage';

export const TOKEN_KEY = 'WHEELA_TOKEN';
export const USER_KEY = 'WHEELA_USER';
export const ROLE_KEY = 'WHEELA_ROLE';

export const getAuthToken = async () => {
  try {
    return await AsyncStorage.getItem(TOKEN_KEY);
  } catch (e) {
    console.error('Error getting token:', e);
    return null;
  }
};

export const getStoredUser = async () => {
  try {
    const json = await AsyncStorage.getItem(USER_KEY);
    return json ? JSON.parse(json) : null;
  } catch (e) {
    console.error('Error getting user:', e);
    return null;
  }
};

// This is the correct logout function
export const logout = async () => {
  try {
    await AsyncStorage.multiRemove([TOKEN_KEY, USER_KEY, ROLE_KEY]);
    console.log('User logged out successfully');
  } catch (e) {
    console.error('Error during logout:', e);
  }
};