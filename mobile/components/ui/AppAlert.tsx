import { Modal, View, Text, TouchableOpacity, StyleSheet } from 'react-native'

export interface AlertButton {
  text: string
  onPress?: () => void
  style?: 'default' | 'cancel' | 'destructive'
}

export interface AlertConfig {
  title: string
  message?: string
  buttons: AlertButton[]
}

interface Props {
  visible: boolean
  config: AlertConfig | null
  onClose: () => void
}

export function AppAlert({ visible, config, onClose }: Props) {
  if (!config) return null
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={s.overlay}>
        <View style={s.dialog}>
          <View style={s.header}>
            <Text style={s.title}>{config.title}</Text>
          </View>
          {config.message ? (
            <Text style={s.message}>{config.message}</Text>
          ) : null}
          <View style={[s.btnRow, config.buttons.length === 1 && { justifyContent: 'center' }]}>
            {config.buttons.map((btn, i) => (
              <TouchableOpacity
                key={i}
                activeOpacity={0.8}
                style={[
                  s.btn,
                  btn.style === 'cancel'      && s.btnCancel,
                  btn.style === 'destructive' && s.btnDestructive,
                  btn.style !== 'cancel' && btn.style !== 'destructive' && s.btnPrimary,
                  config.buttons.length === 1 && { flex: 0, minWidth: 120 },
                ]}
                onPress={() => { onClose(); btn.onPress?.() }}
              >
                <Text style={[
                  s.btnText,
                  btn.style === 'cancel'      && s.btnTextCancel,
                  btn.style === 'destructive' && s.btnTextDestructive,
                ]}>
                  {btn.text}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </View>
    </Modal>
  )
}

const s = StyleSheet.create({
  overlay:        { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center', padding: 32 },
  dialog:         { backgroundColor: '#fff', borderRadius: 20, width: '100%', overflow: 'hidden', shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 16, elevation: 8 },
  header:         { backgroundColor: '#0d9488', paddingHorizontal: 20, paddingVertical: 16 },
  title:          { color: '#fff', fontSize: 16, fontWeight: '800', textAlign: 'center' },
  message:        { fontSize: 14, color: '#374151', lineHeight: 21, paddingHorizontal: 20, paddingVertical: 16, textAlign: 'center' },
  btnRow:         { flexDirection: 'row', gap: 10, paddingHorizontal: 16, paddingBottom: 16, paddingTop: 4 },
  btn:            { flex: 1, paddingVertical: 12, borderRadius: 12, alignItems: 'center' },
  btnPrimary:     { backgroundColor: '#0d9488' },
  btnCancel:      { backgroundColor: '#f0fdfa', borderWidth: 1, borderColor: '#99f6e4' },
  btnDestructive: { backgroundColor: '#fee2e2', borderWidth: 1, borderColor: '#fca5a5' },
  btnText:        { fontSize: 14, fontWeight: '700', color: '#fff' },
  btnTextCancel:  { color: '#0d9488' },
  btnTextDestructive: { color: '#dc2626' },
})
