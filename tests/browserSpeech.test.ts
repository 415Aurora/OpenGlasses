import assert from 'node:assert/strict';
import { speakInBrowser } from '../sources/modules/browserSpeech';

const events: string[] = [];
const utterance = { text: '', lang: '' };

speakInBrowser('你好，世界', {
    speechSynthesis: {
        cancel: () => events.push('cancel'),
        speak: (value) => {
            events.push('speak');
            assert.equal(value, utterance);
        },
    },
    createUtterance: (text) => {
        utterance.text = text;
        return utterance;
    },
});

assert.deepEqual(events, ['cancel', 'speak']);
assert.equal(utterance.text, '你好，世界');
assert.equal(utterance.lang, 'zh-CN');

assert.throws(
    () => speakInBrowser('hello', { speechSynthesis: undefined }),
    (error: unknown) => typeof error === 'object' && error !== null && 'code' in error && error.code === 'unsupported-speech',
);

console.info('browserSpeech tests passed');
