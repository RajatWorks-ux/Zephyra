// src/screens/history/ReadingHistoryScreen.tsx
import React, { useEffect, useState } from 'react'
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, LayoutAnimation } from 'react-native'
import { Video, ResizeMode } from 'expo-av'
import { BlurView } from 'expo-blur'
import { LinearGradient } from 'expo-linear-gradient'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useNavigation } from '@react-navigation/native'
import * as Haptics from 'expo-haptics'
import { useAuthStore } from '../../store/authStore'
import { getReadingHistory } from '../../services/supabase'
import { Videos } from '../../constants/videos'
import { Colors } from '../../constants/colors'
import { Fonts } from '../../constants/fonts'
import { CompatibilityScoreRing } from '../relationship/CompatibilityScoreRing'
import type { ReadingHistoryEntry } from '../../types'

export function ReadingHistoryScreen() {
  const insets = useSafeAreaInsets()
  const navigation = useNavigation<any>()
  const { session } = useAuthStore()
  const [entries, setEntries] = useState<ReadingHistoryEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<string | null>(null)

  useEffect(() => {
    if (!session?.user?.id) return
    getReadingHistory(session.user.id, 50).then(({ data }) => {
      setEntries((data || []) as ReadingHistoryEntry[])
      setLoading(false)
    })
  }, [])

  function toggleExpand(id: string) {
    Haptics.selectionAsync()
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut)
    setExpanded(e => e === id ? null : id)
  }

  function renderItem({ item }: { item: ReadingHistoryEntry }) {
    const isExpanded = expanded === item.id
    const date = new Date(item.generated_at)
    const dateStr = `${date.toLocaleDateString()} at ${date.toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}`

    return (
      <TouchableOpacity onPress={() => toggleExpand(item.id)} activeOpacity={0.9}>
        <BlurView intensity={12} tint="dark" style={st.card}>
          <View style={st.cardTop}>
            <View style={st.cardLeft}>
              <Text style={st.cardDate}>{dateStr}</Text>
              <Text style={st.cardTrigger}>{item.key_change_description || item.trigger}</Text>
              <Text style={st.cardDasha}>{item.mahadasha_at_time}–{item.antardasha_at_time} Dasha</Text>
            </View>
            <CompatibilityScoreRing score={item.daily_score_at_time} size={44} showLabel={false} />
          </View>
          {isExpanded && (
            <View style={st.expanded}>
              <View style={st.divider} />
              <View style={st.dashaChip}>
                <Text style={st.dashaChipText}>
                  During {item.mahadasha_at_time}–{item.antardasha_at_time} period
                </Text>
              </View>
              {item.reading_summary ? (
                <Text style={st.summary}>{item.reading_summary}</Text>
              ) : (
                <Text style={st.summaryNote}>Full reading text is not archived — readings update as your cosmic situation evolves. This log records when readings changed and what triggered each change.</Text>
              )}
            </View>
          )}
        </BlurView>
      </TouchableOpacity>
    )
  }

  return (
    <View style={st.root}>
      <Video source={Videos.splashBg} style={StyleSheet.absoluteFillObject}
        resizeMode={ResizeMode.COVER} isLooping shouldPlay isMuted />
      <LinearGradient colors={['rgba(5,5,15,0.4)','rgba(5,5,15,0.92)']} style={StyleSheet.absoluteFillObject} />

      <View style={[st.header, {paddingTop: insets.top + 12}]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={st.backBtn}>
          <Text style={st.backArrow}>←</Text>
        </TouchableOpacity>
        <Text style={st.headerTitle}>Reading History</Text>
        <View style={{width:40}} />
      </View>

      <View style={st.notice}>
        <Text style={st.noticeText}>
          ⟡ Full reading text is not archived. These entries record when and why your reading was regenerated.
        </Text>
      </View>

      {loading ? (
        <View style={{flex:1,alignItems:'center',justifyContent:'center'}}>
          <ActivityIndicator color={Colors.agedGold} size="large" />
        </View>
      ) : (
        <FlatList
          data={entries}
          keyExtractor={i => i.id}
          renderItem={renderItem}
          contentContainerStyle={[st.list, {paddingBottom: insets.bottom + 80}]}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={st.empty}>
              <Text style={st.emptyIcon}>✦</Text>
              <Text style={st.emptyText}>No reading history yet</Text>
              <Text style={st.emptySub}>History entries appear each time your reading regenerates</Text>
            </View>
          }
        />
      )}
    </View>
  )
}

const st = StyleSheet.create({
  root:{flex:1,backgroundColor:Colors.background},
  header:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',paddingHorizontal:20,paddingBottom:12},
  backBtn:{width:40,height:40,alignItems:'center',justifyContent:'center'},
  backArrow:{fontSize:22,color:'#C9A84C'},
  headerTitle:{fontFamily:Fonts.heading,fontSize:16,color:'#C9A84C'},
  notice:{marginHorizontal:16,marginBottom:8,backgroundColor:'rgba(201,168,76,0.06)',borderRadius:10,padding:12,borderWidth:1,borderColor:'rgba(201,168,76,0.12)'},
  noticeText:{fontFamily:Fonts.body,fontSize:11,color:Colors.textMuted,lineHeight:18},
  list:{padding:16,gap:10},
  card:{borderRadius:16,padding:16,overflow:'hidden',borderWidth:1,borderColor:'rgba(255,255,255,0.06)'},
  cardTop:{flexDirection:'row',alignItems:'center',gap:12},
  cardLeft:{flex:1,gap:4},
  cardDate:{fontFamily:Fonts.heading,fontSize:11,color:'#C9A84C'},
  cardTrigger:{fontFamily:Fonts.body,fontSize:13,color:'#E8E8FF'},
  cardDasha:{fontFamily:Fonts.mystical,fontSize:12,color:Colors.textMuted},
  expanded:{gap:12,marginTop:12},
  divider:{height:1,backgroundColor:'rgba(255,255,255,0.06)'},
  dashaChip:{alignSelf:'flex-start',backgroundColor:'rgba(123,47,190,0.2)',borderRadius:8,paddingHorizontal:10,paddingVertical:4,borderWidth:1,borderColor:'rgba(123,47,190,0.3)'},
  dashaChipText:{fontFamily:Fonts.body,fontSize:11,color:'#B090FF'},
  summary:{fontFamily:Fonts.mystical,fontSize:14,color:Colors.textSecondary,lineHeight:22,fontStyle:'italic'},
  summaryNote:{fontFamily:Fonts.body,fontSize:12,color:Colors.textMuted,lineHeight:20},
  empty:{alignItems:'center',paddingTop:80,gap:12},
  emptyIcon:{fontSize:40,color:'rgba(201,168,76,0.25)'},
  emptyText:{fontFamily:Fonts.heading,fontSize:16,color:'#C9A84C'},
  emptySub:{fontFamily:Fonts.body,fontSize:13,color:Colors.textMuted,textAlign:'center',paddingHorizontal:32},
})
