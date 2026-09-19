import assert from 'node:assert/strict';
import { Agent } from '../sources/agent/Agent';

(async () => {
    const descriptions: string[] = [];
    let systemPrompt = '';
    const agent = new Agent({
        describeImage: async (photo) => {
            const description = `frame-${photo[0]}`;
            descriptions.push(description);
            return description;
        },
        answerQuestion: async (system, question) => {
            systemPrompt = `${system}\n${question}`;
            return 'answer';
        },
        speakAnswer: async () => undefined,
    });

    await agent.addPhoto(new Uint8Array([1]));
    await agent.addPhoto(new Uint8Array([2]));
    await agent.answer('画面里面有什么？');

    assert.deepEqual(descriptions, ['frame-1', 'frame-2']);
    assert.match(systemPrompt, /frame-2/);
    assert.doesNotMatch(systemPrompt, /frame-1/);
    assert.equal(agent.getState().answer, 'answer');

    console.info('agent tests passed');
})();
