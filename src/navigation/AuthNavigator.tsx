import React from 'react'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { SplashScreen } from '../screens/auth/SplashScreen'
import { OnboardingScreen } from '../screens/auth/OnboardingScreen'
import { SignInScreen } from '../screens/auth/SignInScreen'
import { PhoneOTPScreen } from '../screens/auth/PhoneOTPScreen'
import { ForgotPasswordScreen } from '../screens/auth/ForgotPasswordScreen'

export type AuthStackParams = {
  Splash: undefined
  Onboarding: undefined
  SignIn: undefined
  PhoneOTP: { phone: string }
  ForgotPassword: undefined
}

const Stack = createNativeStackNavigator<AuthStackParams>()

export function AuthNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        animation: 'fade',
        contentStyle: { backgroundColor: '#05050F' },
      }}
    >
      <Stack.Screen name="Splash" component={SplashScreen} />
      <Stack.Screen name="Onboarding" component={OnboardingScreen} />
      <Stack.Screen name="SignIn" component={SignInScreen} />
      <Stack.Screen name="PhoneOTP" component={PhoneOTPScreen} />
      <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
    </Stack.Navigator>
  )
}