// src/components/ui/LanguagePicker.tsx
// Searchable bottom sheet for selecting a reading language.

import React, { useState, useCallback, useMemo } from 'react'
import {
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  Modal,
  StyleSheet,
  SafeAreaView,
  Platform,
  StatusBar,
} from 'react-native'
import { BlurView } from 'expo-blur'
import { LinearGradient } from 'expo-linear-gradient'
import * as Haptics from 'expo-haptics'
import { LANGUAGES, useSettingsStore } from '../../store/settingsStore'
import type { Language } from '../../types'
import { Fonts } from '../../constants/fonts'

interface LanguagePickerProps {
  visible: boolean
  onClose: () => void
  onSelect: (lang: Language) => void
}

export function LanguagePicker({ visible, onClose, onSelect }: LanguagePickerProps) {
  const { selectedLanguage } = useSettingsStore()
  const [query, setQuery] = useState('')

  // BUG #9 FIX: reset search query whenever the picker is dismissed (Cancel or backdrop tap)
  const handleClose = useCallback(() => {
    setQuery('')
    onClose()
  }, [onClose])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return LANGUAGES
    return LANGUAGES.filter(
      (l) =>
        l.name.toLowerCase().includes(q) ||
        l.nativeName.toLowerCase().includes(q) ||
        l.code.toLowerCase().includes(q)
    )
  }, [query])

  const handleSelect = useCallback(
    (lang: Language) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
      onSelect(lang)
      setQuery('')
      onClose()
    },
    [onSelect, onClose]
  )

  // BUG #13 FIX: memoize renderItem to prevent FlatList re-rendering all rows on every keystroke
  const renderItem = useCallback(({ item }: { item: Language }) => {
    const isSelected = item.code === selectedLanguage.code
    return (
      <TouchableOpacity
        style={[s.langRow, isSelected && s.langRowSelected]}
        onPress={() => handleSelect(item)}
        activeOpacity={0.7}
      >
        <Text style={s.flag}>{item.flag}</Text>
        <View style={s.langNames}>
          <Text style={[s.langName, isSelected && s.langNameSelected]}>{item.name}</Text>
          <Text style={s.langNative}>{item.nativeName}</Text>
        </View>
        {isSelected && (
          <View style={s.checkBadge}>
            <Text style={s.checkText}>✦</Text>
          </View>
        )}
      </TouchableOpacity>
    )
  }, [selectedLanguage.code, handleSelect])

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleClose}
      statusBarTranslucent
    >
      <View style={s.overlay}>
        <TouchableOpacity style={s.backdrop} onPress={handleClose} activeOpacity={1} />

        <View style={s.sheet}>
          <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFillObject} />
          <LinearGradient
            colors={['rgba(13,13,43,0.98)', 'rgba(5,5,15,0.99)']}
            style={StyleSheet.absoluteFillObject}
          />

          {/* Handle */}
          <View style={s.handle} />

          {/* Header */}
          <View style={s.header}>
            <Text style={s.title}>🌐 Select Language</Text>
            <Text style={s.subtitle}>Your reading will be regenerated in the chosen language</Text>
          </View>

          {/* Search */}
          <View style={s.searchWrap}>
            <Text style={s.searchIcon}>⌕</Text>
            <TextInput
              style={s.searchInput}
              value={query}
              onChangeText={setQuery}
              placeholder="Search languages..."
              placeholderTextColor="rgba(255,255,255,0.25)"
              autoCorrect={false}
              autoCapitalize="none"
              returnKeyType="search"
            />
            {query.length > 0 && (
              <TouchableOpacity onPress={() => setQuery('')} style={s.clearBtn}>
                <Text style={s.clearText}>✕</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Language list */}
          <FlatList
            data={filtered}
            keyExtractor={(item) => item.code}
            renderItem={renderItem}
            style={s.list}
            contentContainerStyle={s.listContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            ListEmptyComponent={
              <View style={s.empty}>
                <Text style={s.emptyText}>No languages found for "{query}"</Text>
              </View>
            }
          />

          {/* Close button */}
          <SafeAreaView>
            <TouchableOpacity style={s.closeBtn} onPress={handleClose} activeOpacity={0.8}>
              <Text style={s.closeBtnText}>Cancel</Text>
            </TouchableOpacity>
          </SafeAreaView>
        </View>
      </View>
    </Modal>
  )
}

const s = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  sheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    overflow: 'hidden',
    maxHeight: '85%',
    borderTopWidth: 1,
    borderColor: 'rgba(201,168,76,0.2)',
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 8,
  },
  header: {
    paddingHorizontal: 24,
    paddingBottom: 16,
    paddingTop: 4,
  },
  title: {
    fontFamily: Fonts.heading,
    fontSize: 18,
    color: '#C9A84C',
    marginBottom: 6,
  },
  subtitle: {
    fontFamily: Fonts.body,
    fontSize: 12,
    color: 'rgba(255,255,255,0.35)',
    lineHeight: 18,
  },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: 14,
    marginHorizontal: 16,
    marginBottom: 12,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: 'rgba(201,168,76,0.2)',
  },
  searchIcon: {
    fontSize: 18,
    color: 'rgba(255,255,255,0.3)',
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontFamily: Fonts.body,
    fontSize: 15,
    color: '#fff',
    paddingVertical: 12,
  },
  clearBtn: {
    padding: 6,
  },
  clearText: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.3)',
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  langRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 13,
    paddingHorizontal: 14,
    borderRadius: 14,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    backgroundColor: 'rgba(255,255,255,0.03)',
    gap: 12,
  },
  langRowSelected: {
    backgroundColor: 'rgba(201,168,76,0.1)',
    borderColor: 'rgba(201,168,76,0.4)',
  },
  flag: {
    fontSize: 22,
    width: 32,
    textAlign: 'center',
  },
  langNames: {
    flex: 1,
  },
  langName: {
    fontFamily: Fonts.bodySemiBold,
    fontSize: 15,
    color: 'rgba(255,255,255,0.8)',
    marginBottom: 2,
  },
  langNameSelected: {
    color: '#C9A84C',
  },
  langNative: {
    fontFamily: Fonts.body,
    fontSize: 12,
    color: 'rgba(255,255,255,0.3)',
  },
  checkBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(201,168,76,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#C9A84C',
  },
  checkText: {
    fontSize: 10,
    color: '#C9A84C',
  },
  empty: {
    padding: 32,
    alignItems: 'center',
  },
  emptyText: {
    fontFamily: Fonts.body,
    fontSize: 14,
    color: 'rgba(255,255,255,0.3)',
    textAlign: 'center',
  },
  closeBtn: {
    margin: 16,
    paddingVertical: 16,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  closeBtnText: {
    fontFamily: Fonts.bodySemiBold,
    fontSize: 16,
    color: 'rgba(255,255,255,0.5)',
  },
})
  
