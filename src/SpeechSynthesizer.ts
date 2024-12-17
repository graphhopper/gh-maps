export interface SpeechSynthesizer {
    synthesize(text: string): void
}

export class SpeechSynthesizerImpl implements SpeechSynthesizer {
    private readonly locale: string
    private readonly speechSynthesisAPIAvailable: boolean

    constructor(locale: string) {
        this.locale = locale
        this.speechSynthesisAPIAvailable = 'speechSynthesis' in window
    }

    synthesize(text: string) {
        if (this.speechSynthesisAPIAvailable) {
            let utterance = new SpeechSynthesisUtterance(text)
            utterance.lang = this.locale
            if (speechSynthesis.pending) speechSynthesis.cancel()
            speechSynthesis.speak(utterance)
        } else {
            console.log('no speechSynthesis API available')
        }
    }
}
