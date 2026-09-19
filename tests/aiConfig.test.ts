import assert from 'node:assert/strict';
import {
    AiProviderError,
    getAiConfig,
    toUserMessage,
} from '../sources/modules/aiConfig';

function withEnvironment(values: Record<string, string | undefined>, run: () => void) {
    const previous = new Map<string, string | undefined>();
    for (const [key, value] of Object.entries(values)) {
        previous.set(key, process.env[key]);
        if (value === undefined) {
            delete process.env[key];
        } else {
            process.env[key] = value;
        }
    }

    try {
        run();
    } finally {
        for (const [key, value] of previous) {
            if (value === undefined) {
                delete process.env[key];
            } else {
                process.env[key] = value;
            }
        }
    }
}

withEnvironment({
    EXPO_PUBLIC_VISION_PROVIDER: undefined,
    EXPO_PUBLIC_CHAT_PROVIDER: undefined,
    EXPO_PUBLIC_TTS_PROVIDER: undefined,
}, () => {
    assert.deepEqual(getAiConfig(), {
        visionProvider: 'zhipu',
        chatProvider: 'zhipu',
        ttsProvider: 'browser',
    });
});

withEnvironment({ EXPO_PUBLIC_CHAT_PROVIDER: 'groq' }, () => {
    assert.equal(getAiConfig().chatProvider, 'groq');
});

withEnvironment({ EXPO_PUBLIC_CHAT_PROVIDER: 'unsupported' }, () => {
    assert.throws(
        () => getAiConfig(),
        (error: unknown) => error instanceof AiProviderError
            && error.code === 'invalid-provider'
            && error.message === '问答服务配置无效：unsupported',
    );
});

assert.equal(
    toUserMessage(new AiProviderError('missing-key')),
    '未配置所选 AI 服务的 API Key，请检查环境变量后重启应用。',
);
assert.equal(
    toUserMessage(new AiProviderError('rate-limited')),
    '免费额度已用完或请求过于频繁，请稍后再试。',
);
assert.equal(
    toUserMessage(new AiProviderError('network')),
    'AI 服务暂时不可用，请检查网络后重试。',
);

console.info('aiConfig tests passed');
