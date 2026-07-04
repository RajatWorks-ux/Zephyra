// src/screens/relationship/RelationshipChatScreen.tsx
import React, { useState, useRef, useEffect } from 'react'
import {
  View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity,
  KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native'
import { Video, ResizeMode } from 'expo-av'
import { BlurView } from 'expo-blur'
import { LinearGradient } from 'expo-linear-gradient'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useNavigation } from '@react-navigation/native'
import * as Haptics from 'expo-haptics'
import { useRelationshipStore } from '../../store/relationshipStore'
import { useAuthStore } from '../../store/authStore'
import { useReadingStore } from '../../store/readingStore'
import { useAudioStore } from '../../store/audioStore'
import { speakText, stopAllAudio } from '../../services/audioService'
import { getKey, KEY_OPENROUTER } from '../../services/secureKeyStore'
import { Videos } from '../../constants/videos'
import { Colors } from '../../constants/colors'
import { Fonts } from '../../constants/fonts'

interface Message { id: string; role: 'user' | 'assistant'; content: string }

const PLACEHOLDERS: Record<string, string> = {
  romantic: 'Ask about your romantic connection...',
  marriage: 'Ask about your bond as partners...',
  business: 'Ask about your business partnership...',
  friendship: 'Ask about your friendship...',
  default: 'Ask about your connection...',
}

export function RelationshipChatScreen() {
  const insets = useSafeAreaInsets()
  const navigation = useNavigation<any>()
  const { activeProfile, activeResult } = useRelationshipStore()
  const { profile, birthProfile } = useAuthStore()
  const { chartData } = useReadingStore()
  const { selectedVoice, setIsPlaying } = useAudioStore()

  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const flatRef = useRef<FlatList>(null)

  const primaryType = activeProfile?.relationship_types?.[0] || 'default'
  const placeholder = PLACEHOLDERS[primaryType] || PLACEHOLDERS.default

  // Welcome message
  useEffect(() => {
    if (activeProfile && activeResult) {
      setMessages([{
        id: 'welcome',
        role: 'assistant',
        content: `✦ Welcome. I hold both your chart and ${activeProfile.person_name}'s chart in full view.\n\nYour ${primaryType} connection carries a Koota score of ${activeResult.koota_score.total}/36 (${activeResult.koota_score.tier}), with an overall compatibility of ${activeResult.overall_score}/100.\n\nWhat would you like to explore about this bond?`,
      }])
    }
  }, [])

  async function sendMessage() {
    if (!input.trim() || isLoading) return
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)

    const userMsg: Message = { id: Date.now().toString(), role: 'user', content: input.trim() }
    setMessages(prev => [...prev, userMsg])
    setInput('')
    setIsLoading(true)

    try {
      const apiKey = await getKey(KEY_OPENROUTER)
      if (!apiKey) throw new Error('No API key')

      // Build dual-chart context
      const p1Chart = chartData?.vedic
      let chart2: any = null
      try {
        const cache = activeProfile?.chart_data_cache
        chart2 = typeof cache === 'string' ? JSON.parse(cache as string) : cache
      } catch {}

      const systemPrompt = `You are Zephyra, a deeply wise Vedic astrology AI. You have BOTH birth charts in full view.

PERSON 1 (${profile?.display_name || 'User'}): ${p1Chart?.lagna} Lagna, ${p1Chart?.nakshatra} nakshatra, Moon in ${p1Chart?.moonRashi}.
PERSON 2 (${activeProfile?.person_name}): ${chart2?.lagna || 'Unknown'} Lagna, ${chart2?.nakshatra || 'Unknown'} nakshatra.

RELATIONSHIP TYPE: ${primaryType}
KOOTA SCORE: ${activeResult?.koota_score?.total || 0}/36 (${activeResult?.koota_score?.tier || 'unknown'})
OVERALL COMPATIBILITY: ${activeResult?.overall_score || 0}/100
KEY YOGAS: ${activeResult?.yogas?.slice(0,3).map((y: any) => y.headline).join('; ') || 'None detected'}

LANGUAGE RULES FOR ${primaryType.toUpperCase()}:
${primaryType === 'romantic' || primaryType === 'marriage' ? 'Use: partner, intimacy, love, attraction. Discuss physical compatibility openly.' : ''}
${primaryType === 'business' ? 'Use: partner, venture, financial synergy. Never use romantic language.' : ''}
${primaryType === 'friendship' ? 'Use: friend, loyalty, shared karma. Never use romantic or business language.' : ''}
${['family_parent','family_child','family_sibling'].includes(primaryType) ? 'Use: family bond, ancestral karma, generational patterns.' : ''}

Every response must cite a specific planet or house from at least one of the two charts.
Be direct, mystical, and deeply insightful. Never generic.`

      const history = messages.map(m => ({ role: m.role, content: m.content }))

      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          messages: [
            { role: 'system', content: systemPrompt },
            ...history,
            { role: 'user', content: userMsg.content },
          ],
          max_tokens: 600,
          temperature: 0.82,
        }),
      })

      const data = await response.json()
      const reply = data.choices?.[0]?.message?.content || 'The cosmic currents are momentarily still. Please try again.'

      const assistantMsg: Message = { id: (Date.now()+1).toString(), role: 'assistant', content: reply }
      setMessages(prev => [...prev, assistantMsg])
      setTimeout(() => flatRef.current?.scrollToEnd({ animated: true }), 100)
    } catch {
      setMessages(prev => [...prev, { id: 'err', role: 'assistant', content: 'The stars are momentarily quiet. Check your API connection.' }])
    } finally { setIsLoading(false) }
  }

  async function handleLongPress(text: string) {
    setIsPlaying(true)
    await speakText(text, 'en-US', selectedVoice)
    setIsPlaying(false)
  }

  function renderMessage({ item }: { item: Message }) {
    const isUser = item.role === 'user'
    return (
      <View style={[msg.wrap, isUser && msg.wrapUser]}>
        {!isUser && (
          <View style={msg.avatar}>
            <LinearGradient colors={['#7B2FBE','#2FBEBE']} style={StyleSheet.absoluteFillObject} />
            <Text style={msg.avatarText}>✦</Text>
          </View>
        )}
        <TouchableOpacity
          onLongPress={() => !isUser && handleLongPress(item.content)}
          style={[msg.bubble, isUser ? msg.bubbleUser : msg.bubbleAI]}
          activeOpacity={0.95}
        >
          <Text style={[msg.text, isUser && msg.textUser]}>{item.content}</Text>
          {!isUser && (
            <Text style={msg.longPressHint}>long-press to hear</Text>
          )}
        </TouchableOpacity>
      </View>
    )
  }

  return (
    <View style={st.root}>
      <Video source={Videos.splashBg} style={StyleSheet.absoluteFillObject}
        resizeMode={ResizeMode.COVER} isLooping shouldPlay isMuted />
      <LinearGradient colors={['rgba(5,5,15,0.5)','rgba(5,5,15,0.95)']} style={StyleSheet.absoluteFillObject} />

      {/* Header */}
      <View style={[st.header, {paddingTop: insets.top + 12}]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={st.backBtn}>
          <Text style={st.backArrow}>←</Text>
        </TouchableOpacity>
        <View style={st.headerCenter}>
          <Text style={st.headerTitle} numberOfLines={1}>
            {profile?.display_name?.split(' ')[0]} {'◈'} {activeProfile?.person_name?.split(' ')[0]}
          </Text>
          <Text style={st.headerSub}>{primaryType} oracle</Text>
        </View>
        <View style={{width:40}} />
      </View>

      <KeyboardAvoidingView style={{flex:1}} behavior={Platform.OS==='ios'?'padding':undefined}>
        <FlatList
          ref={flatRef}
          data={messages}
          keyExtractor={i => i.id}
          renderItem={renderMessage}
          contentContainerStyle={[st.list, {paddingBottom: insets.bottom + 80}]}
          showsVerticalScrollIndicator={false}
          onContentSizeChange={() => flatRef.current?.scrollToEnd({ animated: true })}
        />

        {isLoading && (
          <View style={st.typingWrap}>
            <BlurView intensity={20} tint="dark" style={st.typingBlur}>
              <ActivityIndicator color="#C9A84C" size="small" />
              <Text style={st.typingText}>Reading the stars...</Text>
            </BlurView>
          </View>
        )}

        {/* Input */}
        <BlurView intensity={25} tint="dark" style={[st.inputBar, {paddingBottom: insets.bottom + 8}]}>
          <TextInput
            value={input} onChangeText={setInput}
            placeholder={placeholder} placeholderTextColor={Colors.textMuted}
            style={st.input} multiline maxLength={500}
            returnKeyType="send" onSubmitEditing={sendMessage}
          />
          <TouchableOpacity
            onPress={sendMessage} disabled={isLoading || !input.trim()}
            style={[st.sendBtn, (!input.trim() || isLoading) && st.sendBtnDisabled]}
          >
            <LinearGradient colors={['#7B2FBE','#C9A84C']} style={st.sendGrad} start={{x:0,y:0}} end={{x:1,y:1}}>
              <Text style={st.sendIcon}>↑</Text>
            </LinearGradient>
          </TouchableOpacity>
        </BlurView>
      </KeyboardAvoidingView>
    </View>
  )
}

const st = StyleSheet.create({
  root:{flex:1,backgroundColor:Colors.background},
  header:{flexDirection:'row',alignItems:'center',paddingHorizontal:20,paddingBottom:12},
  backBtn:{width:40,height:40,alignItems:'center',justifyContent:'center'},
  backArrow:{fontSize:22,color:'#C9A84C'},
  headerCenter:{flex:1,alignItems:'center'},
  headerTitle:{fontFamily:Fonts.heading,fontSize:14,color:'#C9A84C'},
  headerSub:{fontFamily:Fonts.body,fontSize:10,color:Colors.textMuted,marginTop:2},
  list:{padding:16,gap:14},
  typingWrap:{paddingHorizontal:16,marginBottom:8},
  typingBlur:{flexDirection:'row',alignItems:'center',gap:10,borderRadius:12,padding:12,overflow:'hidden',borderWidth:1,borderColor:'rgba(201,168,76,0.15)',alignSelf:'flex-start'},
  typingText:{fontFamily:Fonts.body,fontSize:12,color:Colors.textMuted},
  inputBar:{borderTopWidth:1,borderTopColor:'rgba(201,168,76,0.15)',paddingHorizontal:16,paddingTop:12,flexDirection:'row',gap:10,alignItems:'flex-end'},
  input:{flex:1,backgroundColor:'rgba(255,255,255,0.05)',borderWidth:1,borderColor:'rgba(255,255,255,0.1)',borderRadius:16,paddingHorizontal:14,paddingVertical:11,fontFamily:Fonts.body,fontSize:14,color:'#E8E8FF',maxHeight:100},
  sendBtn:{width:44,height:44,borderRadius:22,overflow:'hidden'},
  sendBtnDisabled:{opacity:0.4},
  sendGrad:{flex:1,alignItems:'center',justifyContent:'center'},
  sendIcon:{fontSize:18,color:'#fff'},
})
const msg = StyleSheet.create({
  wrap:{flexDirection:'row',gap:10,alignItems:'flex-end'},
  wrapUser:{flexDirection:'row-reverse'},
  avatar:{width:32,height:32,borderRadius:16,overflow:'hidden',alignItems:'center',justifyContent:'center'},
  avatarText:{fontSize:14,color:'#fff',zIndex:1},
  bubble:{maxWidth:'80%',borderRadius:16,padding:14},
  bubbleUser:{backgroundColor:'rgba(123,47,190,0.35)',borderBottomRightRadius:4,borderWidth:1,borderColor:'rgba(123,47,190,0.5)'},
  bubbleAI:{backgroundColor:'rgba(15,15,35,0.8)',borderBottomLeftRadius:4,borderWidth:1,borderColor:'rgba(255,255,255,0.07)'},
  text:{fontFamily:Fonts.body,fontSize:14,color:'#E8E8FF',lineHeight:22},
  textUser:{color:'#fff'},
  longPressHint:{fontFamily:Fonts.body,fontSize:9,color:Colors.textMuted,marginTop:6,opacity:0.5},
})
