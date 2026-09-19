import * as React from 'react';
import { AsyncLock } from '../utils/lock';
import { toUserMessage } from '../modules/aiConfig';
import { answerQuestion, describeImage, speakAnswer } from '../modules/ai';

type AgentState = {
    lastDescription?: string;
    answer?: string;
    error?: string;
    loading: boolean;
};

type AgentDependencies = {
    describeImage: (photo: Uint8Array) => Promise<string>;
    answerQuestion: (system: string, question: string) => Promise<string>;
    speakAnswer: (text: string) => Promise<void>;
};

const defaultDependencies: AgentDependencies = { describeImage, answerQuestion, speakAnswer };

export class Agent {
    #lock = new AsyncLock();
    #latestDescription: string | undefined;
    #state: AgentState = { loading: false };
    #stateCopy: AgentState = { loading: false };
    #stateListeners: (() => void)[] = [];
    #deps: AgentDependencies;

    constructor(deps: Partial<AgentDependencies> = {}) {
        this.#deps = { ...defaultDependencies, ...deps };
    }

    async addPhoto(photo: Uint8Array): Promise<void> {
        this.#state.loading = true;
        this.#state.error = undefined;
        this.#state.answer = undefined;
        this.#notify();
        await this.#lock.inLock(async () => {
            try {
                this.#latestDescription = await this.#deps.describeImage(photo);
                this.#state.lastDescription = this.#latestDescription;
            } catch (error) {
                this.#latestDescription = undefined;
                this.#state.lastDescription = undefined;
                this.#state.error = toUserMessage(error);
                console.error('Failed to describe image:', error);
            } finally {
                this.#state.loading = false;
                this.#notify();
            }
        });
    }

    async answer(question: string): Promise<void> {
        if (this.#state.loading) return;
        if (!this.#latestDescription) {
            this.#state.error = '请先点击“拍照识别”，再询问当前画面。';
            this.#notify();
            return;
        }
        this.#state.loading = true;
        this.#state.error = undefined;
        this.#state.answer = undefined;
        this.#notify();
        try {
            await this.#lock.inLock(async () => {
                this.#state.answer = await this.#deps.answerQuestion(
                    `你是一个根据当前相机画面回答问题的助手。

当前最新画面的识别结果：
${this.#latestDescription}

只使用上述信息回答，不要提到“图片”“描述”或推测不存在的内容。回答简洁、具体。`,
                    question,
                );
            });
        } catch (error) {
            this.#state.error = toUserMessage(error);
            console.error('Failed to answer question:', error);
        } finally {
            this.#state.loading = false;
            this.#notify();
        }
    }

    async speak(text: string): Promise<void> {
        try {
            await this.#deps.speakAnswer(text);
        } catch (error) {
            this.#state.error = toUserMessage(error);
            this.#notify();
            console.error('Failed to speak answer:', error);
        }
    }

    getState(): AgentState {
        return { ...this.#stateCopy };
    }

    #notify = () => {
        this.#stateCopy = { ...this.#state };
        for (const listener of this.#stateListeners) listener();
    };

    use() {
        const [state, setState] = React.useState(this.#stateCopy);
        React.useEffect(() => {
            const listener = () => setState(this.#stateCopy);
            this.#stateListeners.push(listener);
            return () => {
                this.#stateListeners = this.#stateListeners.filter((item) => item !== listener);
            };
        }, []);
        return state;
    }
}
