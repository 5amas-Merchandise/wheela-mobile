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

export const getUserRole = async () => {
  try {
    return await AsyncStorage.getItem(ROLE_KEY);
  } catch (e) {
    console.error('Error getting role:', e);
    return null;
  }
};

export const setAuthToken = async (token) => {
  try {
    await AsyncStorage.setItem(TOKEN_KEY, token);
  } catch (e) {
    console.error('Error setting token:', e);
  }
};

export const setStoredUser = async (user) => {
  try {
    await AsyncStorage.setItem(USER_KEY, JSON.stringify(user));
  } catch (e) {
    console.error('Error setting user:', e);
  }
};

export const setUserRole = async (role) => {
  try {
    await AsyncStorage.setItem(ROLE_KEY, role);
  } catch (e) {
    console.error('Error setting role:', e);
  }
};

export const logout = async () => {
  try {
    await AsyncStorage.multiRemove([TOKEN_KEY, USER_KEY, ROLE_KEY]);
    console.log('User logged out successfully');
  } catch (e) {
    console.error('Error during logout:', e);
  }
};

export const isAuthenticated = async () => {
  const token = await getAuthToken();
  return !!token;
};