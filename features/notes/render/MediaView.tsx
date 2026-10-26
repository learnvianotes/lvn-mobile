import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio'
import { Image } from 'expo-image'
import { useVideoPlayer, VideoView } from 'expo-video'
import { FileText, ImageIcon, Pause, Play } from 'lucide-react-native'
import { Pressable, View } from 'react-native'
import { useCSSVariable } from 'uniwind'
import { Text } from '@/components/ui/text'
import type { Inline } from '@/lib/contracts/validation'
import { openExternal } from '@/lib/open-external'
import { httpUrl, localMediaUri } from '@/lib/safe-url'
import { useTheme } from '@/lib/theme'
import { useMediaFile } from '../media/NoteMedia'
import { InlineText } from './RichText'

type MediaContent = { fileId?: string; alt?: string; caption?: Inline }
const LABEL = { image: 'picture', video: 'video', audio: 'recording', file: 'file' } as const

/**
 * A media card on the phone (lvn-backend §8.1, ADR-0041): the picture at the size the server made for phones, the
 * video's 720p transcode with the system's controls, the recording with play and pause, or the file opened outside
 * the app. Offline, or before the server has the file, a placeholder says why.
 */
export function MediaView({ type, content }: { type: 'image' | 'video' | 'audio' | 'file'; content: MediaContent }) {
  const { file, localUri } = useMediaFile(content.fileId)
  const caption = content.caption?.length ? <InlineText content={content.caption} className="text-muted-foreground text-sm" /> : null
  const remote = httpUrl(type === 'image' ? (file?.mediumUrl ?? file?.url) : (file?.playbackUrl ?? file?.url))
  const uri = remote ?? localMediaUri(localUri)
  if (!uri) return <Placeholder type={type} />
  return (
    <View className="gap-1.5">
      {type === 'image' ? (
        <Image
          source={{ uri }}
          accessibilityLabel={content.alt || 'A picture'}
          contentFit="contain"
          style={{ width: '100%', aspectRatio: file?.width && file.height ? file.width / file.height : 4 / 3, borderRadius: 16 }}
        />
      ) : type === 'video' ? (
        <Video uri={uri} />
      ) : type === 'audio' ? (
        <Audio uri={uri} name={file?.fileName ?? 'Recording'} />
      ) : (
        <FileLink url={remote} name={file?.fileName ?? 'File'} />
      )}
      {caption}
    </View>
  )
}

function Placeholder({ type }: { type: keyof typeof LABEL }) {
  const muted = String(useCSSVariable('--color-muted-foreground') ?? '#3d4b63')
  return (
    <View className="border-border flex-row items-center gap-2 rounded-2xl border border-dashed p-4">
      <ImageIcon size={18} color={muted} />
      <Text className="text-muted-foreground flex-1 text-sm">A {LABEL[type]} — connect to the internet to see it.</Text>
    </View>
  )
}

function Video({ uri }: { uri: string }) {
  const player = useVideoPlayer(uri)
  return <VideoView player={player} nativeControls contentFit="contain" accessibilityLabel="A video" style={{ width: '100%', aspectRatio: 16 / 9, borderRadius: 16, backgroundColor: '#000' }} />
}

const clock = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`

function Audio({ uri, name }: { uri: string; name: string }) {
  const accent = String(useCSSVariable('--color-primary') ?? '#1e4d8c')
  const onBrand = useTheme().palette.brandForeground
  const player = useAudioPlayer(uri)
  const status = useAudioPlayerStatus(player)
  const playing = status.playing
  return (
    <View className="bg-secondary flex-row items-center gap-3 rounded-2xl p-3">
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={playing ? `Pause ${name}` : `Play ${name}`}
        onPress={() => {
          if (playing) player.pause()
          else {
            if (status.duration && status.currentTime >= status.duration) void player.seekTo(0)
            player.play()
          }
        }}
        className="bg-primary size-11 items-center justify-center rounded-full"
      >
        {playing ? <Pause size={20} color={onBrand} /> : <Play size={20} color={onBrand} />}
      </Pressable>
      <View className="flex-1">
        <Text className="font-semibold" numberOfLines={1}>
          {name}
        </Text>
        <Text className="text-muted-foreground text-xs">
          {clock(status.currentTime ?? 0)}
          {status.duration ? ` / ${clock(status.duration)}` : ''}
        </Text>
      </View>
      <View style={{ width: 4, height: 28, borderRadius: 2, backgroundColor: accent, opacity: playing ? 1 : 0.3 }} />
    </View>
  )
}

function FileLink({ url, name }: { url: string | null; name: string }) {
  const accent = String(useCSSVariable('--color-primary') ?? '#1e4d8c')
  return (
    <Pressable accessibilityRole="link" accessibilityLabel={`Open ${name}`} disabled={!url} onPress={() => openExternal(url)} className="border-border flex-row items-center gap-3 rounded-2xl border p-3">
      <FileText size={20} color={accent} />
      <Text className="flex-1 font-semibold" numberOfLines={1}>
        {name}
      </Text>
    </Pressable>
  )
}
