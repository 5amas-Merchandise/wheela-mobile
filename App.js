// App.js
import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createDrawerNavigator } from '@react-navigation/drawer';

// Auth Screens
import SplashScreenComponent from './src/screens/SplashScreen';
import WelcomeScreen from './src/screens/auth/WelcomeScreen';
import SignupScreen from './src/screens/auth/SignupScreen';
import LoginScreen from './src/screens/auth/LoginScreen';
import OTPVerifyScreen from './src/screens/auth/OTPVerifyScreen';

// Passenger Screens
import PassengerHomeScreen from './src/screens/passenger/PassengerHomeScreen';
import TripHistoryScreen from './src/screens/passenger/TripHistoryScreen';
import ProfileScreen from './src/screens/passenger/ProfileScreen';
import WalletScreen from './src/screens/passenger/WalletScreen';
import CityToCityScreen from './src/screens/passenger/CityToCityScreen';
import SearchDestinationScreen from './src/screens/passenger/SearchDestinationScreen';
import DriverMatchingScreen from './src/screens/passenger/DriverMatchingScreen';
import TripInProgressScreen from './src/screens/passenger/TripInProgressScreen';
import TripCompletedScreen from './src/screens/passenger/TripCompletedScreen';
import NotificationScreen from './src/screens/passenger/NotificationScreen';

// Driver Screens
import DriverHomeOfflineScreen from './src/screens/driver/DriverHomeOfflineScreen';
import DriverOnlineMapScreen from './src/screens/driver/DriverOnlineMapScreen';
import DriverOnboardingScreen from './src/screens/driver/DriverOnboardingScreen';
import DriverProfileVerificationScreen from './src/screens/driver/DriverProfileVerificationScreen';
import DriverNotificationScreen from './src/screens/driver/DriverNotificationScreen';
import RideRequestScreen from './src/screens/driver/RideRequestCardScreen';
import TripFlowScreen from './src/screens/driver/TripFlowScreen';
import EarningsScreen from './src/screens/driver/EarningsScreen';
import LuxuryEarningsScreen from './src/screens/driver/LuxuryEarningsScreen';
import SubscriptionStatusScreen from './src/screens/driver/SubscriptionStatusScreen';

// Custom Drawer
import SideDrawer from './src/screens/SideDrawer';
import HaulageLogisticsScreen from './src/screens/passenger/HaulageLogisticsScreen';
import PaymentMethodsScreen from './src/screens/passenger/PaymentMethodsScreen';
import PromotionsScreen from './src/screens/passenger/PromotionsScreen';
import HelpScreen from './src/screens/passenger/HelpScreen';
import SettingsScreen from './src/screens/passenger/SettingsScreen';

const Stack = createNativeStackNavigator();
const Drawer = createDrawerNavigator();

// Passenger Drawer with multiple screens inside (Bolt-style)
function PassengerDrawerNavigator() {
  return (
    <Drawer.Navigator
      drawerContent={(props) => <SideDrawer {...props} />}
      screenOptions={{
        headerShown: false,
        drawerPosition: 'left',
        drawerType: 'front',
        overlayColor: 'rgba(0,0,0,0.5)',
        swipeEdgeWidth: 300,
      }}
    >
      <Drawer.Screen name="PassengerHome" component={PassengerHomeScreen} />
      <Drawer.Screen name="TripHistory" component={TripHistoryScreen} />
      <Drawer.Screen name="CityToCity" component={CityToCityScreen} />
      <Drawer.Screen name="Profile" component={ProfileScreen} />
      <Drawer.Screen name="Wallet" component={WalletScreen} />
      <Drawer.Screen name="Notification" component={NotificationScreen} />
      <Drawer.Screen name="HaulageLogistics" component={HaulageLogisticsScreen} />
      <Drawer.Screen name="PaymentMethods" component={PaymentMethodsScreen} />
      <Drawer.Screen name="Promotions" component={PromotionsScreen} />
      <Drawer.Screen name="Help" component={HelpScreen} />
      <Drawer.Screen name="Settings" component={SettingsScreen} />
      {/* Add more main screens here later */}
    </Drawer.Navigator>
  );
}

export default function App() {
  return (
    <NavigationContainer>
      <Stack.Navigator initialRouteName="Splash" screenOptions={{ headerShown: false }}>
        {/* Auth Flow */}
        <Stack.Screen name="Splash" component={SplashScreenComponent} />
        <Stack.Screen name="Welcome" component={WelcomeScreen} />
        <Stack.Screen name="Signup" component={SignupScreen} />
        <Stack.Screen name="Login" component={LoginScreen} />
        <Stack.Screen name="OTPVerify" component={OTPVerifyScreen} />

        {/* Main Passenger App with Drawer */}
        <Stack.Screen name="PassengerMain" component={PassengerDrawerNavigator} />

        {/* Full-screen modals (no drawer access) */}
        <Stack.Screen name="SearchDestination" component={SearchDestinationScreen} />
        <Stack.Screen name="DriverMatching" component={DriverMatchingScreen} />
        <Stack.Screen name="TripInProgress" component={TripInProgressScreen} />
        <Stack.Screen name="TripCompleted" component={TripCompletedScreen} />

        {/* Driver Screens */}
        <Stack.Screen name="DriverHomeOffline" component={DriverHomeOfflineScreen} />
        <Stack.Screen name="DriverOnlineMap" component={DriverOnlineMapScreen} />
        <Stack.Screen name="DriverOnboarding" component={DriverOnboardingScreen} />
        <Stack.Screen name="DriverProfileVerification" component={DriverProfileVerificationScreen} />
        <Stack.Screen name="DriverNotification" component={DriverNotificationScreen} />
        <Stack.Screen name="RideRequestCard" component={RideRequestScreen} />
        <Stack.Screen name="TripFlow" component={TripFlowScreen} />
        <Stack.Screen name="Earnings" component={EarningsScreen} />
        <Stack.Screen name="LuxuryEarnings" component={LuxuryEarningsScreen} />
        <Stack.Screen name="SubscriptionStatus" component={SubscriptionStatusScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}