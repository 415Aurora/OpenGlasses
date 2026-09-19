import { groqRequest } from './groq-llama3';
import { textToSpeech, gptRequest } from './openai';
import { ollamaInference } from './ollama';
import { getAiConfig, AiProviderError } from './aiConfig';
import { speakInBrowser } from './browserSpeech';
import { zhipuChat, zhipuVisionDescription } from './zhipu';
import { keys } from '../keys';

function requireResult(result: string | null): string {
    if (!result) {
        throw new AiProviderError('unknown');
    }
    return result;
}

function requireConfiguration(value: string): void {
    if (!value) {
        throw new AiProviderError('missing-key');
    }
}

export async function describeImage(src: Uint8Array): Promise<string> {
    const { visionProvider } = getAiConfig();
    if (visionProvider === 'zhipu') {
        return zhipuVisionDescription(
            src,
            'Describe the image precisely. Transcribe any text you can see. Respond in the language used by the user when possible.',
        );
    }

    requireConfiguration(keys.ollama);
    return ollamaInference({
        model: 'moondream:1.8b-v2-fp16',
        messages: [{
            role: 'system',
            content: 'You are a very advanced model and your task is to describe the image as precisely as possible. Transcribe any text you see.',
        }, {
            role: 'user',
            content: 'Describe the scene',
            images: [src],
        }],
    });
}

export async function answerQuestion(systemPrompt: string, question: string): Promise<string> {
    const { chatProvider } = getAiConfig();
    if (chatProvider === 'zhipu') {
        return zhipuChat(systemPrompt, question);
    }
    if (chatProvider === 'groq') {
        requireConfiguration(keys.groq);
        return requireResult(await groqRequest(systemPrompt, question));
    }
    requireConfiguration(keys.openai);
    return requireResult(await gptRequest(systemPrompt, question));
}

export async function speakAnswer(text: string): Promise<void> {
    const { ttsProvider } = getAiConfig();
    if (ttsProvider === 'browser') {
        speakInBrowser(text);
        return;
    }
    requireConfiguration(keys.openai);
    const result = await textToSpeech(text);
    if (!result) {
        throw new AiProviderError('unknown');
    }
}
