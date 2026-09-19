import { AiProviderError } from './aiConfig';

type SpeechUtteranceLike = {
    lang: string;
};

type SpeechSynthesisLike = {
    cancel: () => void;
    speak: (utterance: SpeechUtteranceLike) => void;
};

type BrowserSpeechOptions = {
    speechSynthesis?: SpeechSynthesisLike;
    createUtterance?: (text: string) => SpeechUtteranceLike;
};

export function speakInBrowser(text: string, options: BrowserSpeechOptions = {}): void {
    const speech = options.speechSynthesis ?? (typeof window === 'undefined'
        ? undefined
        : window.speechSynthesis as unknown as SpeechSynthesisLike);
    const createUtterance = options.createUtterance ?? (typeof SpeechSynthesisUtterance === 'undefined'
        ? undefined
        : (value: string) => new SpeechSynthesisUtterance(value));

    if (!speech || !createUtterance) {
        throw new AiProviderError('unsupported-speech');
    }

    const utterance = createUtterance(text);
    utterance.lang = 'zh-CN';
    speech.cancel();
    speech.speak(utterance);
}
