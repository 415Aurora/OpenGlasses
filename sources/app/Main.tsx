import * as React from 'react';
import { Pressable, SafeAreaView, StyleSheet, Text, TextInput, useWindowDimensions, View } from 'react-native';
import { DeviceView } from './DeviceView';
import { WifiCameraSource } from '../modules/cameraTransport';

type Mode = 'wifi' | null;
const ADDRESS_KEY = 'openglasses.camera.address';

function readSavedAddress(): string {
    try {
        return typeof localStorage === 'undefined' ? '' : localStorage.getItem(ADDRESS_KEY) || '';
    } catch {
        return '';
    }
}

function saveAddress(value: string): void {
    try {
        if (typeof localStorage !== 'undefined') localStorage.setItem(ADDRESS_KEY, value);
    } catch {
        // Storage can be unavailable in private browser contexts.
    }
}

export const Main = React.memo(() => {
    const { width } = useWindowDimensions();
    const narrow = width < 720;
    const [mode, setMode] = React.useState<Mode>(null);
    const [address, setAddress] = React.useState(readSavedAddress);
    const [wifiSource, setWifiSource] = React.useState<WifiCameraSource | null>(null);
    const [wifiError, setWifiError] = React.useState<string | undefined>();

    if (mode === 'wifi' && wifiSource) {
        return <DeviceView source={wifiSource} onBack={() => setWifiSource(null)} />;
    }

    const openWifi = () => {
        try {
            const source = new WifiCameraSource(address);
            saveAddress(address.trim());
            setWifiSource(source);
            setWifiError(undefined);
        } catch (error) {
            setWifiError(error instanceof Error ? error.message : String(error));
        }
    };

    return (
        <SafeAreaView style={styles.safe}>
            <View style={[styles.shell, narrow && styles.shellNarrow]}>
                <View style={styles.header}>
                    <Text style={styles.eyebrow}>OPENGLASS / CAMERA LINK</Text>
                    <Text style={styles.title}>连接你的画面</Text>
                    <Text style={styles.subtitle}>选择传输方式。视频预览只在 Wi‑Fi 模式启用，AI 仅处理你手动拍下的这一帧。</Text>
                </View>
                <View style={[styles.modeRow, narrow && styles.modeRowNarrow]}>
                    <View style={[styles.modeCard, mode === 'wifi' && styles.modeCardActive]}>
                        <Text style={styles.modeIndex}>01</Text>
                        <Text style={styles.modeTitle}>Wi‑Fi 摄像头</Text>
                        <Text style={styles.modeDescription}>使用 ESP32 CameraWebServer，获得连续预览和稳定抓拍。</Text>
                        {mode === 'wifi' ? (
                            <View style={styles.form}>
                                <TextInput value={address} onChangeText={setAddress} placeholder="例如 192.168.1.42" placeholderTextColor="#69717c" autoCapitalize="none" autoCorrect={false} style={styles.input} onSubmitEditing={openWifi} />
                                <Pressable style={styles.actionButton} onPress={openWifi}><Text style={styles.actionText}>打开摄像头</Text></Pressable>
                                {wifiError && <Text style={styles.error}>{wifiError}</Text>}
                            </View>
                        ) : <Pressable style={styles.secondaryButton} onPress={() => setMode('wifi')}><Text style={styles.secondaryText}>输入地址</Text></Pressable>}
                    </View>
                </View>
                <Text style={styles.footer}>当前为 Wi‑Fi 摄像头模式。摄像头与电脑需连接同一局域网。</Text>
            </View>
        </SafeAreaView>
    );
});

const styles = StyleSheet.create({
    safe: { flex: 1, backgroundColor: '#0d1117' },
    shell: { flex: 1, maxWidth: 1040, width: '100%', alignSelf: 'center', padding: 32, justifyContent: 'center' },
    shellNarrow: { padding: 18, justifyContent: 'flex-start' },
    header: { marginBottom: 36 },
    eyebrow: { color: '#62e6b5', letterSpacing: 2, fontSize: 12, fontWeight: '700', marginBottom: 12 },
    title: { color: '#f4f7fb', fontSize: 42, fontWeight: '700' },
    subtitle: { color: '#98a2b3', fontSize: 16, lineHeight: 24, maxWidth: 640, marginTop: 12 },
    modeRow: { flexDirection: 'row', gap: 16 },
    modeRowNarrow: { flexDirection: 'column' },
    modeCard: { flex: 1, minHeight: 260, borderWidth: 1, borderColor: '#252d38', backgroundColor: '#151b23', padding: 24 },
    modeCardActive: { borderColor: '#62e6b5', backgroundColor: '#17251f' },
    modeIndex: { color: '#657180', fontSize: 12, fontWeight: '700', letterSpacing: 1, marginBottom: 26 },
    modeTitle: { color: '#f4f7fb', fontSize: 26, fontWeight: '700' },
    modeDescription: { color: '#98a2b3', fontSize: 15, lineHeight: 22, marginTop: 10, minHeight: 50 },
    actionButton: { marginTop: 22, backgroundColor: '#62e6b5', minHeight: 44, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 18 },
    actionText: { color: '#0d1117', fontSize: 15, fontWeight: '700' },
    secondaryButton: { marginTop: 22, borderWidth: 1, borderColor: '#556171', minHeight: 44, justifyContent: 'center', alignItems: 'center' },
    secondaryText: { color: '#d7dee8', fontSize: 15, fontWeight: '700' },
    form: { marginTop: 18 },
    input: { color: '#f4f7fb', borderWidth: 1, borderColor: '#3a4553', minHeight: 44, paddingHorizontal: 12, fontSize: 15 },
    error: { color: '#ff8f8f', fontSize: 13, lineHeight: 19, marginTop: 10 },
    footer: { color: '#69717c', fontSize: 13, lineHeight: 20, marginTop: 30 },
});
