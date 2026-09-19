import assert from 'node:assert/strict';
import { zhipuChat, zhipuVisionDescription } from '../sources/modules/zhipu';

type RecordedRequest = {
    url: string;
    body: unknown;
    headers: unknown;
};

function fakePost(result: unknown, recorded: RecordedRequest[]) {
    return async (url: string, body: unknown, config: { headers: unknown }) => {
        recorded.push({ url, body, headers: config.headers });
        return { data: result };
    };
}

(async () => {
    const requests: RecordedRequest[] = [];
    const answer = await zhipuChat('system', 'question', {
        apiKey: 'test-key',
        post: fakePost({ choices: [{ message: { content: 'answer' } }] }, requests),
    });

    assert.equal(answer, 'answer');
    assert.deepEqual(requests[0], {
        url: 'https://open.bigmodel.cn/api/paas/v4/chat/completions',
        body: {
            model: 'glm-4.7-flash',
            messages: [
                { role: 'system', content: 'system' },
                { role: 'user', content: 'question' },
            ],
            thinking: { type: 'disabled' },
        },
        headers: {
            Authorization: 'Bearer test-key',
            'Content-Type': 'application/json',
        },
    });

    const visionRequests: RecordedRequest[] = [];
    const description = await zhipuVisionDescription(new Uint8Array([1, 2, 3]), 'describe this', {
        apiKey: 'test-key',
        post: fakePost({ choices: [{ message: { content: 'description' } }] }, visionRequests),
    });

    assert.equal(description, 'description');
    assert.deepEqual(visionRequests[0], {
        url: 'https://open.bigmodel.cn/api/paas/v4/chat/completions',
        body: {
            model: 'glm-4.6v-flash',
            messages: [{
                role: 'user',
                content: [
                    { type: 'text', text: 'describe this' },
                    { type: 'image_url', image_url: { url: 'data:image/jpeg;base64,AQID' } },
                ],
            }],
        },
        headers: {
            Authorization: 'Bearer test-key',
            'Content-Type': 'application/json',
        },
    });

    await assert.rejects(
        () => zhipuChat('system', 'question', { apiKey: '' }),
        (error: unknown) => typeof error === 'object' && error !== null && 'code' in error && error.code === 'missing-key',
    );

    console.info('zhipu tests passed');
})();
