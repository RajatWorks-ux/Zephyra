// src/components/relationship/RelationshipTypeGrid.tsx
import React from 'react'
import { View, Text, TouchableOpacity, StyleSheet, Animated } from 'react-native'
import { BlurView } from 'expo-blur'
import { LinearGradient } from 'expo-linear-gradient'
import * as Haptics from 'expo-haptics'
import { Fonts } from '../../constants/fonts'
import type { RelationshipType } from '../../types'

const TYPES: Array<{ id: RelationshipType; icon: string; label: string }> = [
  { id: 'romantic',        icon: '♡',   label: 'Romantic'         },
  { id: 'marriage',        icon: '◎',   label: 'Marriage'         },
  { id: 'business',        icon: '◈',   label: 'Business'         },
  { id: 'friendship',      icon: '✦',   label: 'Friendship'       },
  { id: 'family_parent',   icon: '◉',   label: 'Parent'           },
  { id: 'family_child',    icon: '◌',   label: 'Child'            },
  { id: 'family_sibling',  icon: '◍',   label: 'Sibling'          },
  { id: 'teacher_student', icon: '◬',   label: 'Mentor'           },
  { id: 'rivalry',         icon: '⊗',   label: 'Rival'            },
  { id: 'colleague',       icon: '⊕',   label: 'Colleague'        },
  { id: 'healer',          icon: '✚',   label: 'Healer'           },
  { id: 'creative_partner',icon: '✎',   label: 'Creative'         },
]

interface Props {
  selected: RelationshipType[]
  onToggle: (type: RelationshipType) => void
}

export function RelationshipTypeGrid({ selected, onToggle }: Props) {
  return (
    <View style={st.grid}>
      {TYPES.map(t => {
        const active = selected.includes(t.id)
        return (
          <TouchableOpacity
            key={t.id}
            style={st.cell}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
              onToggle(t.id)
            }}
            activeOpacity={0.8}
          >
            <BlurView intensity={active ? 25 : 10} tint="dark" style={[st.card, active && st.cardActive]}>
              {active && (
                <LinearGradient
                  colors={['rgba(201,168,76,0.18)', 'rgba(123,47,190,0.12)']}
                  style={StyleSheet.absoluteFillObject}
                />
              )}
              <Text style={[st.icon, active && st.iconActive]}>{t.icon}</Text>
              <Text style={[st.label, active && st.labelActive]}>{t.label}</Text>
            </BlurView>
          </TouchableOpacity>
        )
      })}
    </View>
  )
}

const st = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  cell: { width: '30%' },
  card: {
    borderRadius: 14, padding: 12, alignItems: 'center', gap: 5,
    overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)',
    minHeight: 72,
  },
  cardActive: { borderColor: '#C9A84C' },
  icon: { fontSize: 20, color: 'rgba(255,255,255,0.4)' },
  iconActive: { color: '#C9A84C' },
  label: { fontFamily: 'Inter_400Regular', fontSize: 10, color: 'rgba(255,255,255,0.4)', textAlign: 'center' },
  labelActive: { color: '#E8E8FF', fontFamily: 'Inter_600SemiBold' },
})
