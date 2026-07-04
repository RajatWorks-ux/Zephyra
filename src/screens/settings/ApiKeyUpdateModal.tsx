// src/components/settings/ApiKeyUpdateModal.tsx
import React, { useState } from 'react'
import { View, Text, Modal, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Alert } from 'react-native'
import { BlurView } from 'expo-blur'
import { LinearGradient } from 'expo-linear-gradient'
import * as Haptics from 'expo-haptics'
import { setKey, KEY_OPENROUTER, KEY_NVIDIA_TTS } from '../../services/secureKeyStore'
import { Fonts } from '../../constants/fonts'

interface Props {
  visible: boolean
  keyType: 'nvidia_text' | 'nvidia_tts'
  onClose: () => void
  onSaved: () => void
}

export function ApiKeyUpdateModal({ visible, keyType, onClose, onSaved }: Props) {
  const [value, setValue] = useState('')
  const [saving, setSaving] = useState(false)

  const label = keyType === 'nvidia_text' ? 'NVIDIA Text AI Key' : 'NVIDIA TTS Voice Key'
  const placeholder = 'nvapi-...'

  async function handleSave() {
    if (!value.startsWith('nvapi-')) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
      Alert.alert('Invalid Key', 'Key must start with nvapi-')
      return
    }
    setSaving(true)
    try {
      const storeKey = keyType === 'nvidia_text' ? KEY_OPENROUTER : KEY_NVIDIA_TTS
      await setKey(storeKey, value.trim())
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      setValue('')
      onSaved()
    } catch {
      Alert.alert('Error', 'Failed to save key')
    } finally { setSaving(false) }
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={st.overlay}>
        <BlurView intensity={40} tint="dark" style={st.sheet}>
          <View style={st.handle} />
          <Text style={st.title}>Update {label}</Text>
          <Text style={st.sub}>Paste your new key below. It's stored encrypted on this device only.</Text>
          <TextInput
            value={value}
            onChangeText={setValue}
            placeholder={placeholder}
            placeholderTextColor="rgba(255,255,255,0.25)"
            style={st.input}
            autoCapitalize="none"
            secureTextEntry
          />
          <TouchableOpacity onPress={handleSave} disabled={saving} activeOpacity={0.85} style={{ borderRadius: 14, overflow: 'hidden', marginTop: 8 }}>
            <LinearGradient colors={['#7B2FBE', '#C9A84C']} style={st.btn} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
              {saving ? <ActivityIndicator color="#fff" /> : <Text style={st.btnText}>Save Key</Text>}
            </LinearGradient>
          </TouchableOpacity>
          <TouchableOpacity onPress={onClose} style={st.cancel}>
            <Text style={st.cancelText}>Cancel</Text>
          </TouchableOpacity>
        </BlurView>
      </View>
    </Modal>
  )
}

const st = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.7)' },
  sheet: { borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 28, paddingTop: 16, borderTopWidth: 1, borderColor: 'rgba(201,168,76,0.2)' },
  handle: { width: 36, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.2)', alignSelf: 'center', marginBottom: 20 },
  title: { fontFamily: 'CinzelDecorative_400Regular', fontSize: 16, color: '#C9A84C', marginBottom: 8 },
  sub: { fontFamily: 'Inter_400Regular', fontSize: 13, color: 'rgba(255,255,255,0.5)', lineHeight: 20, marginBottom: 20 },
  input: { backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: 'rgba(201,168,76,0.2)', borderRadius: 12, padding: 14, fontFamily: 'Inter_400Regular', fontSize: 14, color: '#E8E8FF', marginBottom: 8 },
  btn: { height: 52, alignItems: 'center', justifyContent: 'center', borderRadius: 14 },
  btnText: { fontFamily: 'CinzelDecorative_400Regular', fontSize: 14, color: '#fff' },
  cancel: { alignItems: 'center', marginTop: 14 },
  cancelText: { fontFamily: 'Inter_400Regular', fontSize: 14, color: 'rgba(255,255,255,0.35)' },
})
