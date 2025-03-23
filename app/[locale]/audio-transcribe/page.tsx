"use client"

import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import { Download, Home, Mic, Pause, Play, Square, Languages, Copy, Check, Upload } from "lucide-react"
import LocaleToggle from "@/components/locale/toggle"
import SignToggle from "@/components/sign/toggle"
import { Squares } from "@/components/ui/squares-background"
import Link from "next/link"
import { useTranslations } from "next-intl"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

// 保存数据到localStorage的键名
const STORAGE_KEYS = {
  TRANSCRIBED_TEXT: 'transcribed_text',
  TRANSCRIPTION_CHUNKS: 'transcription_chunks',
  INFERRED_LANGUAGES: 'inferred_languages',
  AUDIO_BLOB: 'audio_blob'
};

export default function Page() {
  const t = useTranslations("pages.audio-transcribe")
  const [transcribedText, setTranscribedText] = useState<string | null>(null)
  const [transcriptionChunks, setTransriptionChunks] = useState<any[]>([])
  const [inferredLanguages, setInferredLanguages] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [isRecording, setIsRecording] = useState(false)
  const [isPaused, setIsPaused] = useState(false)
  const [recordingTime, setRecordingTime] = useState(0)
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null)
  const [activeTab, setActiveTab] = useState("text")
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [fileUploaded, setFileUploaded] = useState(false)
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  
  // 从localStorage恢复状态
  useEffect(() => {
    // 恢复转录文本
    const savedText = localStorage.getItem(STORAGE_KEYS.TRANSCRIBED_TEXT);
    if (savedText) {
      setTranscribedText(savedText);
    }
    
    // 恢复转录块
    const savedChunks = localStorage.getItem(STORAGE_KEYS.TRANSCRIPTION_CHUNKS);
    if (savedChunks) {
      try {
        setTransriptionChunks(JSON.parse(savedChunks));
      } catch (e) {
        console.error("Failed to parse saved chunks", e);
      }
    }
    
    // 恢复检测到的语言
    const savedLanguages = localStorage.getItem(STORAGE_KEYS.INFERRED_LANGUAGES);
    if (savedLanguages) {
      try {
        setInferredLanguages(JSON.parse(savedLanguages));
      } catch (e) {
        console.error("Failed to parse saved languages", e);
      }
    }
    
    // 恢复音频数据
    const savedAudioBlob = localStorage.getItem(STORAGE_KEYS.AUDIO_BLOB);
    if (savedAudioBlob) {
      try {
        // 将base64字符串转回Blob
        const byteCharacters = atob(savedAudioBlob);
        const byteArrays = [];
        
        for (let offset = 0; offset < byteCharacters.length; offset += 512) {
          const slice = byteCharacters.slice(offset, offset + 512);
          
          const byteNumbers = new Array(slice.length);
          for (let i = 0; i < slice.length; i++) {
            byteNumbers[i] = slice.charCodeAt(i);
          }
          
          const byteArray = new Uint8Array(byteNumbers);
          byteArrays.push(byteArray);
        }
        
        const blob = new Blob(byteArrays, { type: 'audio/wav' });
        setAudioBlob(blob);
      } catch (e) {
        console.error("Failed to restore audio blob", e);
      }
    }
  }, []);

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current)
      }
      if (mediaRecorderRef.current && isRecording) {
        mediaRecorderRef.current.stop()
      }
    }
  }, [isRecording])

  // 当状态变化时保存到localStorage
  useEffect(() => {
    if (transcribedText) {
      localStorage.setItem(STORAGE_KEYS.TRANSCRIBED_TEXT, transcribedText);
    }
  }, [transcribedText]);

  useEffect(() => {
    if (transcriptionChunks.length > 0) {
      localStorage.setItem(STORAGE_KEYS.TRANSCRIPTION_CHUNKS, JSON.stringify(transcriptionChunks));
    }
  }, [transcriptionChunks]);

  useEffect(() => {
    if (inferredLanguages.length > 0) {
      localStorage.setItem(STORAGE_KEYS.INFERRED_LANGUAGES, JSON.stringify(inferredLanguages));
    }
  }, [inferredLanguages]);

  useEffect(() => {
    if (audioBlob) {
      // 将Blob转换为base64存储
      const reader = new FileReader();
      reader.readAsDataURL(audioBlob);
      reader.onloadend = function() {
        const base64data = reader.result as string;
        // 移除数据URL前缀
        const base64Content = base64data.split(',')[1];
        localStorage.setItem(STORAGE_KEYS.AUDIO_BLOB, base64Content);
      }
    }
  }, [audioBlob]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  // 将秒数转为时间字符串 (用于显示时间戳)
  const formatTimestamp = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    const ms = Math.floor((seconds % 1) * 1000)
    return `${mins}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(3, '0')}`
  }

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mediaRecorder = new MediaRecorder(stream)
      mediaRecorderRef.current = mediaRecorder
      audioChunksRef.current = []
      setRecordingTime(0)

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data)
        }
      }

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/wav' })
        setAudioBlob(audioBlob)
        
        // 停止所有音轨
        stream.getTracks().forEach(track => track.stop())
      }

      // 先设置状态
      setIsRecording(true)
      setIsPaused(false)
      setTranscribedText(null)
      setTransriptionChunks([])
      setInferredLanguages([])
      
      // 清除localStorage中的旧数据
      localStorage.removeItem(STORAGE_KEYS.TRANSCRIBED_TEXT);
      localStorage.removeItem(STORAGE_KEYS.TRANSCRIPTION_CHUNKS);
      localStorage.removeItem(STORAGE_KEYS.INFERRED_LANGUAGES);
      localStorage.removeItem(STORAGE_KEYS.AUDIO_BLOB);
      
      // 启动MediaRecorder
      mediaRecorder.start()
      
      // 确保之前的计时器被清除
      if (timerRef.current) {
        clearInterval(timerRef.current)
        timerRef.current = null
      }
      
      // 使用setTimeout稍微延迟启动计时器，确保状态已更新
      setTimeout(() => {
        timerRef.current = setInterval(() => {
          setRecordingTime(prev => {
            console.log("Recording time updated:", prev + 1);
            return prev + 1;
          })
        }, 1000)
      }, 100)

      toast.success(t("toast.recording_started"))
    } catch (error) {
      console.error('录音失败:', error)
      toast.error(t("toast.recording_failed"))
    }
  }

  const pauseRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      if (isPaused) {
        mediaRecorderRef.current.resume()
        setIsPaused(false)
        
        // 恢复计时
        timerRef.current = setInterval(() => {
          setRecordingTime(prev => prev + 1)
        }, 1000)
        
        toast.success(t("toast.recording_resumed"))
      } else {
        mediaRecorderRef.current.pause()
        setIsPaused(true)
        
        // 暂停计时
        if (timerRef.current) {
          clearInterval(timerRef.current)
          timerRef.current = null
        }
        toast.success(t("toast.recording_paused"))
      }
    }
  }

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop()
      setIsRecording(false)
      setIsPaused(false)
      
      // 停止计时
      if (timerRef.current) {
        clearInterval(timerRef.current)
        timerRef.current = null
      }
      
      toast.success(t("toast.recording_stopped"))
    }
  }

  const handleTranscribe = async () => {
    if (!audioBlob) {
      toast.error(t("toast.no_audio"))
      return
    }

    try {
      setLoading(true)
      
      const formData = new FormData()
      formData.append('audio', audioBlob, 'recording.wav')
      
      const response = await fetch('/api/transcribe-audio', {
        method: 'POST',
        body: formData,
      })

      const res = await response.json()
      if (res.message == 'credits_not_enough') {
        throw new Error(t('error.credits_not_enough'))
      } else if (res.message == 'file_upload_failed') {
        throw new Error(t('toast.file_upload_failed'))
      }
      
      setTranscribedText(res.data.text)
      if (res.data.chunks) {
        setTransriptionChunks(res.data.chunks)
      }
      if (res.data.inferred_languages) {
        setInferredLanguages(res.data.inferred_languages)
      }
      
      toast.success(t("toast.success"))
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : t("toast.error")
      toast.error(errorMessage)
    } finally {
      setLoading(false)
    }
  }

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedId(id)
      toast.success(t("toast.copied"))
      setTimeout(() => setCopiedId(null), 1500)
    }).catch(() => {
      toast.error(t("toast.copy_failed"))
    })
  }

  const handleDownload = () => {
    if (!transcribedText) return
    
    try {
      const blob = new Blob([transcribedText], { type: 'text/plain' })
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = 'transcription.txt'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)
    } catch (error) {
      toast.error(t("toast.download_error"))
    }
  }

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      if (!file.type.startsWith('audio/')) {
        toast.error(t("toast.invalid_file_type"))
        return
      }
      
      // 将文件转换为Blob
      const reader = new FileReader()
      reader.readAsArrayBuffer(file)
      reader.onload = () => {
        const arrayBuffer = reader.result as ArrayBuffer
        const blob = new Blob([arrayBuffer], { type: file.type })
        setAudioBlob(blob)
        setSelectedFile(file)
        setFileUploaded(true)
        
        // 清除任何现有的转录结果
        setTranscribedText(null)
        setTransriptionChunks([])
        setInferredLanguages([])
        
        toast.success(t("toast.file_uploaded"))
      }
      reader.onerror = () => {
        toast.error(t("toast.file_upload_error"))
      }
    }
  }

  return (
    <div className="min-h-screen bg-transparent text-white relative overflow-hidden">
      <Squares 
        direction="diagonal"
        speed={0.5}
        squareSize={60}
        borderColor="#2A2A2A"
        hoverFillColor="#333333"
        className="absolute inset-0"
      />
      <div className="relative z-10">
        <div className="p-4 px-8 flex justify-between items-center">
          <h1 className="text-xl font-bold">{t("title")}</h1>
          <div className="flex items-center gap-2">
            <Link href="/">
              <Button 
                variant="ghost" 
                size="icon"
                className="bg-transparent hover:bg-[#2A2A2A] text-white"
              >
                <Home className="h-5 w-5" />
              </Button>
            </Link>
            <LocaleToggle />
            <SignToggle />
          </div>
        </div>

        <div className="flex px-8 pb-8 gap-8 h-[calc(100vh-80px)]">
          <div className="w-[380px] space-y-6">
            <div className="space-y-4">
              <div className="flex flex-col items-center justify-center p-8 border border-[#3A3A3A] rounded-lg bg-[#1C1C1C]/30">
                <div className="text-4xl font-mono mb-6">{formatTime(recordingTime)}</div>
                
                <div className="flex gap-4 mb-6">
                  {!isRecording ? (
                    <>
                      <Button 
                        onClick={startRecording}
                        size="lg"
                        className="bg-[#3A3A3A] hover:bg-[#4A4A4A] text-white rounded-full h-16 w-16 flex items-center justify-center"
                      >
                        <Mic className="h-8 w-8" />
                      </Button>
                      
                      <label className="cursor-pointer">
                        <input
                          type="file"
                          accept="audio/*"
                          className="hidden"
                          onChange={handleFileUpload}
                          disabled={isRecording}
                        />
                        <Button 
                          size="lg"
                          className="bg-[#3A3A3A] hover:bg-[#4A4A4A] text-white rounded-full h-16 w-16 flex items-center justify-center"
                          onClick={(e) => e.currentTarget.previousElementSibling?.click()}
                          type="button"
                        >
                          <Upload className="h-8 w-8" />
                        </Button>
                      </label>
                    </>
                  ) : (
                    <>
                      <Button 
                        onClick={pauseRecording}
                        size="lg"
                        className="bg-[#3A3A3A] hover:bg-[#4A4A4A] text-white rounded-full h-16 w-16 flex items-center justify-center"
                      >
                        {isPaused ? <Play className="h-8 w-8" /> : <Pause className="h-8 w-8" />}
                      </Button>
                      
                      <Button 
                        onClick={stopRecording}
                        size="lg"
                        className="bg-[#3A3A3A] hover:bg-[#4A4A4A] text-white rounded-full h-16 w-16 flex items-center justify-center"
                      >
                        <Square className="h-8 w-8" />
                      </Button>
                    </>
                  )}
                </div>
                
                {isRecording && (
                  <div className="flex flex-col items-center justify-center gap-2">
                    <div className="flex items-center">
                      <div className={`w-4 h-4 rounded-full ${isPaused ? 'bg-yellow-500' : 'bg-red-500 animate-pulse'}`}></div>
                      <span className="ml-2">{isPaused ? t("status.paused") : t("status.recording")}</span>
                    </div>
                    <div className="text-xl font-mono">
                      {formatTime(recordingTime)}
                    </div>
                  </div>
                )}
                
                {audioBlob && !isRecording && (
                  <div className="mt-4 w-full">
                    {fileUploaded && selectedFile && (
                      <div className="text-sm mb-2 text-center">
                        <span>{t("uploaded_file")}: {selectedFile.name}</span>
                      </div>
                    )}
                    <audio controls src={URL.createObjectURL(audioBlob)} className="w-full" />
                  </div>
                )}
                
                {inferredLanguages.length > 0 && (
                  <div className="mt-4 flex items-center gap-2 text-xs opacity-80">
                    <Languages className="h-4 w-4" />
                    <span>{t("detected_language")}: {inferredLanguages.join(', ')}</span>
                  </div>
                )}
              </div>
            </div>

            <Button 
              className="w-full"
              size="lg" 
              onClick={handleTranscribe} 
              disabled={loading || isRecording || !audioBlob}
            >
              {loading ? t("status.transcribing") : t("form.transcribe")}
            </Button>
          </div>

          <div className="flex-1 rounded-lg bg-transparent border border-[#3A3A3A] p-4 flex flex-col relative">
            {transcribedText && (
              <div className="absolute top-4 right-4 flex gap-2">
                <Button 
                  variant="ghost" 
                  size="icon"
                  className="bg-[#1C1C1C]/80 hover:bg-[#1C1C1C] text-white"
                  onClick={handleDownload}
                >
                  <Download className="h-5 w-5" />
                </Button>
              </div>
            )}
            
            {transcribedText ? (
              <div className="w-full h-full flex flex-col">
                <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                  <TabsList className="mb-4">
                    <TabsTrigger value="text">{t("tabs.full_text")}</TabsTrigger>
                    {transcriptionChunks.length > 0 && (
                      <TabsTrigger value="chunks">{t("tabs.timestamps")}</TabsTrigger>
                    )}
                  </TabsList>
                  
                  <TabsContent value="text" className="h-[calc(100vh-210px)] overflow-auto">
                    <div className="p-4 relative">
                      <Button 
                        variant="ghost" 
                        size="icon"
                        className="absolute top-2 right-2 bg-[#1C1C1C]/80 hover:bg-[#1C1C1C] text-white"
                        onClick={() => copyToClipboard(transcribedText, 'full-text')}
                      >
                        {copiedId === 'full-text' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                      </Button>
                      <p className="text-white whitespace-pre-wrap pr-10">{transcribedText}</p>
                    </div>
                  </TabsContent>
                  
                  {transcriptionChunks.length > 0 && (
                    <TabsContent value="chunks" className="h-[calc(100vh-210px)] overflow-auto">
                      <div className="space-y-2 p-4">
                        {transcriptionChunks.map((chunk, index) => (
                          <div key={index} className="border border-[#3A3A3A] rounded-md p-2 relative">
                            <Button 
                              variant="ghost" 
                              size="icon"
                              className="absolute top-2 right-2 bg-[#1C1C1C]/80 hover:bg-[#1C1C1C] text-white h-6 w-6"
                              onClick={() => copyToClipboard(chunk.text, `chunk-${index}`)}
                            >
                              {copiedId === `chunk-${index}` ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                            </Button>
                            {chunk.timestamp && (
                              <div className="text-xs text-gray-400 mb-1">
                                {formatTimestamp(chunk.timestamp[0])} - {formatTimestamp(chunk.timestamp[1])}
                              </div>
                            )}
                            <p className="pr-8">{chunk.text}</p>
                          </div>
                        ))}
                      </div>
                    </TabsContent>
                  )}
                </Tabs>
              </div>
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <div className="text-gray-400 text-center">
                  <div>
                    {loading ? (
                      <p>{t("preview.loading")}</p>
                    ) : (
                      <>
                        <p>{t("preview.empty.title")}</p>
                        <p className="text-sm mt-2">{t("preview.empty.description")}</p>
                      </>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
} 