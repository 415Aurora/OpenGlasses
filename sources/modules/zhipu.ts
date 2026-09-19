import axios from 'axios';
import { keys } from '../keys';
import { toBase64Image } from '../utils/base64';
import { AiProviderError } from './aiConfig';

const ZHIPU_CHAT_URL = 'https://open.bigmodel.cn/api/paas/v4/chat/completions';

type HttpPost = (url: string, body: unknown, config: { headers: Record<string, string> }) => Promise<{ data: unknown }>;

type ZhipuOptions = {
    apiKey?: string;
    post?: HttpPost;
};

function contentFrom(response: unknown): string {
    const content = (response as { choices?: { message?: { content?: unknown } }[] })
        .choices?.[0]?.message?.content;
    if (typeof content !== 'string' || !content.trim()) {
        throw new AiProviderError('unknown', '智谱服务未返回有效内容。');
    }
    return content.trim();
}

function asProviderError(error: unknown): AiProviderError {
    if (error instanceof AiProviderError) {
        return error;
    }
    if (axios.isAxiosError(error)) {
        if (error.response?.status === 401 || error.response?.status === 403) {
            return new AiProviderError('missing-key');
        }
        if (error.response?.status === 429) {
            return new AiProviderError('rate-limited');
        }
        return new AiProviderError('network');
    }
    return new AiProviderError('unknown');
}

async function request(body: unknown, options: ZhipuOptions = {}): Promise<string> {
    const apiKey = options.apiKey ?? keys.zhipu;
    if (!apiKey) {
        throw new AiProviderError('missing-key');
    }

    try {
        const response = await (options.post ?? axios.post)(ZHIPU_CHAT_URL, body, {
            headers: {
                Authorization: `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
            },
        });
        return contentFrom(response.data);
    } catch (error) {
        throw asProviderError(error);
    }
}

export function zhipuChat(systemPrompt: string, userPrompt: string, options?: ZhipuOptions): Promise<string> {
    return request({
        model: 'glm-4.7-flash',
        messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
        ],
        thinking: { type: 'disabled' },
    }, options);
}

export function zhipuVisionDescription(image: Uint8Array, prompt: string, options?: ZhipuOptions): Promise<string> {
    return request({
        model: 'glm-4.6v-flash',
        messages: [{
            role: 'user',
            content: [
                { type: 'text', text: prompt },
                { type: 'image_url', image_url: { url: toBase64Image(image) } },
            ],
        }],
    }, options);
}
