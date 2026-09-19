import assert from 'node:assert/strict';
import { answerQuestion, describeImage } from '../sources/modules/ai';

const previousKey = process.env.EXPO_PUBLIC_ZHIPU_API_KEY;
const previousVisionProvider = process.env.EXPO_PUBLIC_VISION_PROVIDER;
const previousChatProvider = process.env.EXPO_PUBLIC_CHAT_PROVIDER;

delete process.env.EXPO_PUBLIC_ZHIPU_API_KEY;
delete process.env.EXPO_PUBLIC_VISION_PROVIDER;
delete process.env.EXPO_PUBLIC_CHAT_PROVIDER;

(async () => {
    await assert.rejects(
        () => describeImage(new Uint8Array([1])),
        (error: unknown) => typeof error === 'object' && error !== null && 'code' in error && error.code === 'missing-key',
    );
    await assert.rejects(
        () => answerQuestion('system', 'question'),
        (error: unknown) => typeof error === 'object' && error !== null && 'code' in error && error.code === 'missing-key',
    );

    process.env.EXPO_PUBLIC_CHAT_PROVIDER = 'groq';
    await assert.rejects(
        () => answerQuestion('system', 'question'),
        (error: unknown) => typeof error === 'object' && error !== null && 'code' in error && error.code === 'missing-key',
    );

    if (previousKey === undefined) delete process.env.EXPO_PUBLIC_ZHIPU_API_KEY;
    else process.env.EXPO_PUBLIC_ZHIPU_API_KEY = previousKey;
    if (previousVisionProvider === undefined) delete process.env.EXPO_PUBLIC_VISION_PROVIDER;
    else process.env.EXPO_PUBLIC_VISION_PROVIDER = previousVisionProvider;
    if (previousChatProvider === undefined) delete process.env.EXPO_PUBLIC_CHAT_PROVIDER;
    else process.env.EXPO_PUBLIC_CHAT_PROVIDER = previousChatProvider;

    console.info('ai gateway tests passed');
})();
