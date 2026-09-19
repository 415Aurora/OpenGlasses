import * as React from 'react';
import { ActivityIndicator, Image, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, useWindowDimensions, View } from 'react-native';
import { Agent } from '../agent/Agent';
import { CameraSource } from '../modules/cameraTransport';
import { toBase64Image } from '../utils/base64';

export const DeviceView = React.memo((props: { source: CameraSource; onBack: () => void }) => {
    const { width } = useWindowDimensions();
    const narrow = width < 820;
    const agent = React.useMemo(() => new Agent(), []);
    const agentState = agent.use();
    const [photo, setPhoto] = React.useState<Uint8Array | null>(null);
    const [captureBusy, setCaptureBusy] = React.useState(false);
    const [captureError, setCaptureError] = React.useState<string | undefined>();
    const [question, setQuestion] = React.useState('');

    React.useEffect(() => () => props.source.disconnect?.(), [props.source]);
    React.useEffect(() => {
        if (agentState.answer) void agent.speak(agentState.answer);
    }, [agent, agentState.answer]);

    const capture = React.useCallback(async () => {
        setCaptureBusy(true);
        setCaptureError(undefined);
        try {
            const nextPhoto = await props.source.capture();
            setPhoto(nextPhoto);
            await agent.addPhoto(nextPhoto);
        } catch (error) {
            setCaptureError(error instanceof Error ? error.message : String(error));
        } finally {
            setCaptureBusy(false);
        }
    }, [agent, props.source]);

    const submitQuestion = React.useCallback(() => {
        const value = question.trim();
        if (!value) return;
        void agent.answer(value);
        setQuestion('');
    }, [agent, question]);

    return (
        <SafeAreaView style={styles.safe}>
            <View style={[styles.page, narrow && styles.pageNarrow]}>
                <View style={styles.topbar}>
                    <Pressable onPress={props.onBack} style={styles.backButton}><Text style={styles.backText}>‹ 返回</Text></Pressable>
                    <View style={styles.connection}><View style={styles.dot} /><Text style={styles.connectionText}>{props.source.name}</Text></View>
                </View>
                <View style={[styles.content, narrow && styles.contentNarrow]}>
                    <View style={styles.previewColumn}>
                        <View style={[styles.previewFrame, narrow && styles.previewFrameNarrow]}>
                            {props.source.previewUrl ? <Image source={{ uri: props.source.previewUrl }} style={styles.preview} resizeMode="cover" /> : photo ? <Image source={{ uri: toBase64Image(photo) }} style={styles.preview} resizeMode="cover" /> : <View style={styles.emptyPreview}><Text style={styles.emptyTitle}>等待拍照</Text><Text style={styles.emptyText}>点击下方按钮获取一张当前画面</Text></View>}
                            {captureBusy && <View style={styles.previewOverlay}><ActivityIndicator color="#62e6b5" size="large" /><Text style={styles.overlayText}>正在读取当前画面</Text></View>}
                        </View>
                        <View style={styles.captureRow}>
                            <Pressable style={styles.captureButton} onPress={capture} disabled={captureBusy || agentState.loading}><Text style={styles.captureText}>{captureBusy || agentState.loading ? '识别中…' : '拍照识别'}</Text></Pressable>
                            {captureError && <Text style={styles.error}>{captureError}</Text>}
                        </View>
                    </View>
                    <View style={[styles.answerColumn, narrow && styles.answerColumnNarrow]}>
                        <Text style={styles.panelLabel}>CURRENT FRAME</Text>
                        <Text style={styles.panelTitle}>问问眼前画面</Text>
                        <Text style={styles.panelHint}>模型只会使用最近一次成功识别的画面，不会把旧图片混进回答。</Text>
                        <View style={styles.answerBox}>
                            {agentState.loading ? <ActivityIndicator color="#62e6b5" /> : agentState.error ? <Text style={styles.error}>{agentState.error}</Text> : agentState.answer ? <ScrollView><Text style={styles.answer}>{agentState.answer}</Text></ScrollView> : <Text style={styles.placeholder}>拍照后，在这里输入问题。</Text>}
                        </View>
                        <View style={styles.questionRow}>
                            <TextInput value={question} onChangeText={setQuestion} onSubmitEditing={submitQuestion} placeholder="例如：画面里面有什么？" placeholderTextColor="#69717c" style={styles.questionInput} editable={!agentState.loading} returnKeyType="send" />
                            <Pressable onPress={submitQuestion} style={styles.sendButton} disabled={agentState.loading || !question.trim()}><Text style={styles.sendText}>发送</Text></Pressable>
                        </View>
                        {agentState.lastDescription && <Text style={styles.lastDescription}>已更新当前画面识别结果。</Text>}
                    </View>
                </View>
            </View>
        </SafeAreaView>
    );
});

const styles = StyleSheet.create({
    safe: { flex: 1, backgroundColor: '#0d1117' },
    page: { flex: 1, maxWidth: 1180, width: '100%', alignSelf: 'center', padding: 24 },
    pageNarrow: { padding: 14 },
    topbar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', minHeight: 48, marginBottom: 18 },
    backButton: { paddingVertical: 8, paddingRight: 14 },
    backText: { color: '#d7dee8', fontSize: 15, fontWeight: '600' },
    connection: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    dot: { width: 8, height: 8, backgroundColor: '#62e6b5' },
    connectionText: { color: '#98a2b3', fontSize: 13 },
    content: { flex: 1, flexDirection: 'row', gap: 20 },
    contentNarrow: { flexDirection: 'column' },
    previewColumn: { flex: 1.25 },
    previewFrame: { flex: 1, minHeight: 440, backgroundColor: '#151b23', borderWidth: 1, borderColor: '#252d38', overflow: 'hidden', position: 'relative' },
    previewFrameNarrow: { minHeight: 260, aspectRatio: 4 / 3 },
    preview: { width: '100%', height: '100%' },
    emptyPreview: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
    emptyTitle: { color: '#f4f7fb', fontSize: 22, fontWeight: '700' },
    emptyText: { color: '#69717c', fontSize: 14, marginTop: 8, textAlign: 'center' },
    previewOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(13,17,23,0.72)', alignItems: 'center', justifyContent: 'center' },
    overlayText: { color: '#d7dee8', fontSize: 14, marginTop: 12 },
    captureRow: { marginTop: 14 },
    captureButton: { minHeight: 50, backgroundColor: '#62e6b5', alignItems: 'center', justifyContent: 'center' },
    captureText: { color: '#0d1117', fontSize: 16, fontWeight: '700' },
    answerColumn: { flex: 0.85, minWidth: 300, padding: 6 },
    answerColumnNarrow: { minWidth: 0, padding: 0 },
    panelLabel: { color: '#62e6b5', fontSize: 12, letterSpacing: 2, fontWeight: '700' },
    panelTitle: { color: '#f4f7fb', fontSize: 28, fontWeight: '700', marginTop: 10 },
    panelHint: { color: '#98a2b3', fontSize: 14, lineHeight: 21, marginTop: 10 },
    answerBox: { flex: 1, minHeight: 180, borderTopWidth: 1, borderBottomWidth: 1, borderColor: '#252d38', marginTop: 24, paddingVertical: 22 },
    placeholder: { color: '#69717c', fontSize: 17, lineHeight: 25 },
    answer: { color: '#f4f7fb', fontSize: 22, lineHeight: 32 },
    questionRow: { flexDirection: 'row', gap: 8, marginTop: 16 },
    questionInput: { flex: 1, minHeight: 46, color: '#f4f7fb', borderWidth: 1, borderColor: '#3a4553', paddingHorizontal: 12, fontSize: 15 },
    sendButton: { minWidth: 70, backgroundColor: '#252d38', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 14 },
    sendText: { color: '#f4f7fb', fontSize: 15, fontWeight: '700' },
    error: { color: '#ff8f8f', fontSize: 13, lineHeight: 19 },
    lastDescription: { color: '#62e6b5', fontSize: 12, marginTop: 12 },
});
