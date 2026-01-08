import * as Notifications from 'expo-notifications'
import { Platform } from 'react-native'

export async function registerForPushNotificationsAsync() {
  let token
  const { status: existingStatus } = await Notifications.getPermissionsAsync()
  let finalStatus = existingStatus
  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync()
    finalStatus = status
  }
  if (finalStatus !== 'granted') {
    return null
  }
  token = (await Notifications.getExpoPushTokenAsync()).data
  return token
}

export function sendLocalNotification({ title, body, sound = true }) {
  Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      sound: sound ? 'default' : undefined,
    },
    trigger: null,
  })
}

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
})