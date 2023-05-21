import { useState, useEffect, useMemo, useRef } from 'react';
import type { VoiceInfo } from 'microsoft-cognitiveservices-speech-sdk'
import {
    AudioConfig,
    CancellationErrorCode,
    SpeakerAudioDestination,
    SpeechConfig,
    SpeechRecognizer,
    SpeechSynthesizer,
} from 'microsoft-cognitiveservices-speech-sdk'

const azureRegion = process.env.TTS_REGION || '';
const azureKey = process.env.TTS_SCRIPTION_KEY || '';
const ttsPassword = process.env.TTS_ACCESS_PASSWORD || '';

interface Config {
    langs?: readonly ['fr-FR', 'ja-JP', 'en-US', 'zh-CN', 'zh-HK', 'ko-KR', 'de-DE']
    isFetchAllVoice?: boolean
}
export const useSpeechService = (config: Config = {})   => {
    const { langs = ['fr-FR', 'ja-JP', 'en-US', 'zh-CN', 'zh-HK', 'ko-KR', 'de-DE'], isFetchAllVoice = true } = config;

    const [languages, setLanguages] = useState(langs);
    const [language, setLanguage] = useState(langs[0]);
    const [voiceName, setVoiceName] = useState('en-US-JennyMultilingualNeural');
    const [isRecognizing, setIsRecognizing] = useState(false); // 语音识别中
    const [isSynthesizing, setIsSynthesizing] = useState(false); // 语音合成中
    const [isSynthesError, setIsSynthesError] = useState(false); // 语音失败
    const [isRecognizReadying, setIsRecognizReadying] = useState(false); // 语音合成准备中
    const [isPlaying, setIsPlaying] = useState(false) // 语音播放中
    const [isPlayend, setIsPlayend] = useState(false) // 语音播放结束
    const [count, setCount] = useState(0) // 语音播放结束
    const [rate, setRate] = useState(1); // 语速 (0,2]
    const [style, setStyle] = useState('Neural'); // 情感

    const [audioBlob, setAudioBlob] = useState(new Blob());

    const [allVoices, setAllVoices] = useState<VoiceInfo[]>([]);
    const player = useRef(new SpeakerAudioDestination())
    const resultAzureKey = azureKey;

    const resultAzureRegion = azureRegion;
    const speechConfig = useMemo(() => SpeechConfig.fromSubscription(resultAzureKey, resultAzureRegion), [resultAzureKey, resultAzureRegion]);
    const [recognizer, setRecognizer] = useState(new SpeechRecognizer(speechConfig))
    const [synthesizer, setSynthesizer] = useState(new SpeechSynthesizer(speechConfig))

    useEffect(() => {
        speechConfig.speechRecognitionLanguage = language;
        speechConfig.speechSynthesisLanguage = language;
        speechConfig.speechSynthesisVoiceName = voiceName;
    }, [language, voiceName, azureKey, azureRegion, ttsPassword]);

    // 语音识别
    let mediaRecorder: MediaRecorder | null
    const chunks: Blob[] = []
    const audioRecorder = async () => {
        // 暂时通过 mediaRecorder 方式实现录音保存，后续可能会改为直接通过 SpeechRecognizer 实现保存

        const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
        mediaRecorder = new MediaRecorder(stream)

        mediaRecorder.ondataavailable = (e) => {
            chunks.push(e.data)
        }

        mediaRecorder.onstop = (e) => {
            const blob = new Blob(chunks, { type: 'audio/wav' })
            //   audioBlob.value = blob
            setAudioBlob(blob)
            mediaRecorder = null
            chunks.length = 0
        }

        mediaRecorder.start()
    }

    const startRecognizeSpeech = async (cb?: (text: string) => void) => {
        const audioConfig = AudioConfig.fromDefaultMicrophoneInput()
        const config = new SpeechRecognizer(speechConfig, audioConfig)
        setIsRecognizReadying(true)
     
        config.recognized = (s, e) => {
            console.log('Recognize result: ', e.result.text)
            cb && cb(e.result.text)
        }

        
        config.recognizing = (s, event) => {
            console.log('Recognize recognizing', event.result.text)
        }

        
        config.sessionStopped = (s, e) => {
            console.log('\n    Session stopped event.')
            setIsRecognizing(false)
            config.stopContinuousRecognitionAsync()
        }
       
        config.canceled = (s, e) => {
            if (e.errorCode === CancellationErrorCode.AuthenticationFailure)
                console.error('Invalid or incorrect subscription key')
            else
                console.error(`Canceled: ${e.errorDetails}`)
            setIsRecognizReadying(false)
            setIsRecognizing(false)
        }
        
        config.startContinuousRecognitionAsync(() => {
                    setIsRecognizing(true)
                    setIsRecognizReadying(false)
                    audioRecorder()
                    console.log('Recognize...')
                }
                    , (error) => {
                        setIsRecognizing(false)
                        setIsRecognizReadying(false)
                        console.error(`Error: ${error}`)
                        config.stopContinuousRecognitionAsync()
                    }
                )
                setRecognizer(config)
            }

            // 停止语音识别
            const stopRecognizeSpeech = (): Promise<void> => {
                mediaRecorder?.stop()
                setIsRecognizReadying(false)
                return new Promise((resolve, reject) => {
                    recognizer.stopContinuousRecognitionAsync(() => {
                        setIsRecognizing(false)
                        resolve()
                    }, (err) => {
                        setIsRecognizing(false)
                console.log('stopRecognizeSpeech error', err)
                reject(err)
            })
        })
    }

    // 识别一次，无需取消
    const recognizeSpeech = (): Promise<string> => {
        // isRecognizing.value = true
        setIsRecognizing(true)
        return new Promise((resolve, reject) => {
            recognizer.recognizeOnceAsync((result) => {
                if (result.text) {
                    // isRecognizing.value = false
                    setIsRecognizing(false)
                    resolve(result.text)
                }
                else {
                    console.log(result)
                    // isRecognizing.value = false
                    setIsRecognizing(false)
                    reject(new Error(`未识别到任何内容-${language}`),
                    )
                }
            }, (err) => {
                // isRecognizing.value = false
                setIsRecognizing(false)
                console.log('recognizeSpeech error', err)
                reject(err)
            })
        })
    }

    // 语音合成
    const textToSpeak = async (text: string, voice?: string) => {
        // isSynthesizing.value = true
        setIsSynthesizing(true)
        speechConfig.speechSynthesisVoiceName = voice || speechConfig.speechSynthesisVoiceName
        
        synthesizer.speakTextAsync(text, (result) => {
            // if (result.errorDetails)
            //   console.error(`语音播放失败：${result.errorDetails}`)
            // else
            //   console.log('语音播放完成')
            // isSynthesizing.value = false
            setIsSynthesizing(false)
        })
    }

    const ssmlToSpeak = async (text: string, { voice, voiceRate, lang, voiceStyle }: { voice?: string; voiceRate?: number; lang?: string; voiceStyle?: string } = {}) => {
        applySynthesizerConfiguration()

        // isSynthesizing.value = true
        setIsSynthesizing(true)
        // isSynthesError.value = false
        setIsSynthesError(false)
        const targetLang = lang || speechConfig.speechSynthesisLanguage
        const targetVoice = voice || speechConfig.speechSynthesisVoiceName
        const targetRate = voiceRate || rate
        const targetFeel = voiceStyle || style

        const ssml = `
    <speak version="1.0"  xmlns:mstts="https://www.w3.org/2001/mstts" xmlns="https://www.w3.org/2001/10/synthesis" xml:lang="${targetLang}">
      <voice name="${targetVoice}">
        <prosody rate="${targetRate}">
          <mstts:express-as style="${targetFeel}" styledegree="1.5">
            ${text}
          </mstts:express-as>
        </prosody>
      </voice>
    </speak>`
        synthesizer.SynthesisCanceled = (s, e) => {
            // isSynthesError.value = true
            setIsSynthesError(true)
            alert(`语音合成失败,请检查语音配置：${e.result.errorDetails}, `)
            // console.error(`语音合成失败,请检查语音配置：${e.result.errorDetails}`)
        }

        console.log('isSynthesizing')
        synthesizer.speakSsmlAsync(ssml, () => {
            console.log('isSynthesiz end')

            stopTextToSpeak()
        }, (err) => {
            console.error('播放失败', err)
            stopTextToSpeak()
        })
    }

    // 停止语音合成
    function stopTextToSpeak() {
        // isSynthesizing.value = false
        setIsSynthesizing(false)
        synthesizer.close()
        // count.value++ // 触发实例的重新创建
        setCount(count + 1)
    }

    // 获取语音列表
    async function getVoices(): Promise<VoiceInfo[]> {
        if (isFetchAllVoice) {
            try {
                const synthesizer = new SpeechSynthesizer(speechConfig)
                const res = await synthesizer.getVoicesAsync()

                if (res.errorDetails)
                    console.error(`获取语音列表失败：${res.errorDetails}, 请检查语音配置`)

                setAllVoices(res.voices || [] as VoiceInfo[])
            }
            catch (error) {
                setAllVoices([] as VoiceInfo[])
            }
        }

        const res = await synthesizer.getVoicesAsync()
        if (res.errorDetails) {
            console.error(`获取语音列表失败：${res.errorDetails}, 请检查语音配置`)
            return []
        }
        return res.voices
    }

    function applySynthesizerConfiguration() {
        // 通过playback结束事件来判断播放结束
        player.current = new SpeakerAudioDestination()
        player.current.onAudioStart = function (_) {
            if (isSynthesError) return
            // isPlaying.current = true
            setIsPlaying(true)
            // isPlayend.current = false
            setIsPlayend(false)
            console.log('playback started.....')
        }
        player.current.onAudioEnd = function (_) {
            console.log('playback finished....')
            // isPlaying.value = false

            // isPlayend.value = true
            setIsPlayend(true)
        }

        const speakConfig = AudioConfig.fromSpeakerOutput(player.current)
        // synthesizer = new SpeechSynthesizer(speechConfig.value, speakConfig)
        setSynthesizer(new SpeechSynthesizer(speechConfig, speakConfig))
    }

    return {
        setRate,
        setStyle,
        languages,
        setLanguages,
        language,
        setLanguage,
        voiceName,
        setVoiceName,
        isRecognizing,
        isPlaying,
        isPlayend,
        isRecognizReadying,
        startRecognizeSpeech,
        stopRecognizeSpeech,
        recognizeSpeech,
        textToSpeak,
        ssmlToSpeak,
        stopTextToSpeak,
        getVoices,
        allVoices,
        isSynthesizing,
        rate,
        style,
        audioBlob,
        player,
    }
}
