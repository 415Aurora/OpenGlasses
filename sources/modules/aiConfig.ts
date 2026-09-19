export type VisionProvider = 'zhipu' | 'ollama';
export type ChatProvider = 'zhipu' | 'groq' | 'openai';
export type TtsProvider = 'browser' | 'openai';

export type AiConfig = {
    visionProvider: VisionProvider;
    chatProvider: ChatProvider;
    ttsProvider: TtsProvider;
};

export type AiErrorCode = 'invalid-provider' | 'missing-key' | 'rate-limited' | 'network' | 'unsupported-speech' | 'unknown';

export class AiProviderError extends Error {
    constructor(public readonly code: AiErrorCode, message?: string) {
        super(message);
        this.name = 'AiProviderError';
    }
}

function provider<T extends string>(value: string | undefined, fallback: T, allowed: readonly T[], label: string): T {
    const selected = value ?? fallback;
    if (!allowed.includes(selected as T)) {
        throw new AiProviderError('invalid-provider', `${label}服务配置无效：${selected}`);
    }
    return selected as T;
}

export function getAiConfig(): AiConfig {
    return {
        visionProvider: provider(process.env.EXPO_PUBLIC_VISION_PROVIDER, 'zhipu', ['zhipu', 'ollama'], '视觉'),
        chatProvider: provider(process.env.EXPO_PUBLIC_CHAT_PROVIDER, 'zhipu', ['zhipu', 'groq', 'openai'], '问答'),
        ttsProvider: provider(process.env.EXPO_PUBLIC_TTS_PROVIDER, 'browser', ['browser', 'openai'], '语音'),
    };
}

export function toUserMessage(error: unknown): string {
    if (error instanceof AiProviderError) {
        switch (error.code) {
            case 'invalid-provider':
                return error.message;
            case 'missing-key':
                return '未配置所选 AI 服务的 API Key，请检查环境变量后重启应用。';
            case 'rate-limited':
                return '免费额度已用完或请求过于频繁，请稍后再试。';
            case 'unsupported-speech':
                return '当前浏览器不支持本地语音播报。';
            case 'network':
            case 'unknown':
                return 'AI 服务暂时不可用，请检查网络后重试。';
        }
    }
    return 'AI 服务暂时不可用，请检查网络后重试。';
}
