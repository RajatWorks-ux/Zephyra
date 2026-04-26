import React, { useState } from 'react'
import {
  View,
  TextInput,
  Text,
  StyleSheet,
  TouchableOpacity,
  ViewStyle,
  KeyboardTypeOptions,
} from 'react-native'
import { Colors } from '../../constants/colors'
import { Fonts } from '../../constants/fonts'

interface InputProps {
  label?: string
  placeholder?: string
  value: string
  onChangeText: (text: string) => void
  secureTextEntry?: boolean
  error?: string
  keyboardType?: KeyboardTypeOptions
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters'
  maxLength?: number
  multiline?: boolean
  style?: ViewStyle
  editable?: boolean
}

export function Input({
  label,
  placeholder,
  value,
  onChangeText,
  secureTextEntry = false,
  error,
  keyboardType = 'default',
  autoCapitalize = 'none',
  maxLength,
  multiline = false,
  style,
  editable = true,
}: InputProps) {
  const [focused, setFocused] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  return (
    <View style={[styles.container, style]}>
      {label && <Text style={styles.label}>{label}</Text>}
      <View
        style={[
          styles.inputWrapper,
          focused && styles.inputWrapperFocused,
          error ? styles.inputWrapperError : null,
        ]}
      >
        <TextInput
          style={[styles.input, multiline && styles.multiline]}
          placeholder={placeholder}
          placeholderTextColor={Colors.textMuted}
          value={value}
          onChangeText={onChangeText}
          secureTextEntry={secureTextEntry && !showPassword}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          maxLength={maxLength}
          multiline={multiline}
          editable={editable}
          selectionColor={Colors.starGold}
        />
        {secureTextEntry && (
          <TouchableOpacity
            onPress={() => setShowPassword(!showPassword)}
            style={styles.eyeButton}
          >
            <Text style={styles.eyeText}>{showPassword ? 'HIDE' : 'SHOW'}</Text>
          </TouchableOpacity>
        )}
      </View>
      {error && <Text style={styles.errorText}>{error}</Text>}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  label: {
    fontFamily: Fonts.accent,
    fontSize: 11,
    color: Colors.textMuted,
    letterSpacing: 1.5,
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.inputBg,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  inputWrapperFocused: {
    borderColor: Colors.primaryViolet,
  },
  inputWrapperError: {
    borderColor: Colors.marsRed,
  },
  input: {
    flex: 1,
    height: 50,
    paddingHorizontal: 16,
    fontFamily: Fonts.body,
    fontSize: 15,
    color: Colors.textPrimary,
  },
  multiline: {
    height: 100,
    paddingTop: 14,
    textAlignVertical: 'top',
  },
  eyeButton: {
    paddingHorizontal: 14,
  },
  eyeText: {
    fontFamily: Fonts.accent,
    fontSize: 10,
    color: Colors.textMuted,
    letterSpacing: 1,
  },
  errorText: {
    fontFamily: Fonts.body,
    fontSize: 12,
    color: Colors.marsRed,
    marginTop: 6,
    paddingHorizontal: 4,
  },
})