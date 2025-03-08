"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/text-area"
import { toast } from "sonner"
import { Download, Home } from "lucide-react"
import LocaleToggle from "@/components/locale/toggle"
import SignToggle from "@/components/sign/toggle"
import { Squares } from "@/components/ui/squares-background"
import Link from "next/link"
import { useTranslations } from "next-intl"

export default function Page() {
  const t = useTranslations("pages.img-generate")
  const [generatedImage, setGeneratedImage] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [imgSize, setImgSize] = useState("square_hd")
  const [style, setStyle] = useState("digital_illustration")
  const [textEnabled, setTextEnabled] = useState("no")
  const [text, setText] = useState("")
  const [customStyle, setCustomStyle] = useState("")
  const [textPosition, setTextPosition] = useState("behind")

  const handleGenerate = async () => {
    try {
      setLoading(true)
      const imageUrl = await requestGenImage()
      setGeneratedImage(imageUrl)
      toast.success(t("toast.success"))
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : t("toast.error")
      toast.error(errorMessage)
    } finally {
      setLoading(false)
    }
  }

  const getDescription = () => {
    let description = `Generate a cross design with style: ${style}.`
    if (textEnabled === "yes" && text) {
      description += ` Include the text "${text}" ${textPosition === "behind" ? "behind" : "inside"} the cross.`
    }
    if (customStyle) {
      description += ` Additional style details: ${customStyle}`
    }
    return description
  }

  const requestGenImage = async () => {
    try {
      const response = await fetch('/api/gen-image', {
        method: 'POST',
        body: JSON.stringify({
          description: getDescription(),
          img_size: imgSize,
          style: style,
        }),
      })

      const res = await response.json()
      if (!response.ok) {
        if (res.error === 'credits_not_enough') {
          throw new Error(t('error.credits_not_enough'))
        }
        throw new Error(t('error.generation_failed'))
      }
      console.log('🚀res',res)
      return res.data.img_url
    } catch (error) {
      console.error('Image generation error:', error)
      throw error
    }
  }

  const handleDownload = async () => {
    if (!generatedImage) return
    
    try {
      const response = await fetch(generatedImage)
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `recipe-${Date.now()}.png`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)
    } catch (error) {
      toast.error(t("toast.download_error"))
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
              <Select value={imgSize} onValueChange={setImgSize} defaultValue="square_hd">
                <SelectTrigger className="bg-transparent border-[#3A3A3A] text-white">
                  <SelectValue placeholder={t("form.size.placeholder")} />
                </SelectTrigger>
                <SelectContent className="bg-[#2A2A2A] border-[#3A3A3A]">
                  {Object.entries(t.raw("form.size.options") as Record<string, string>).map(([key, value]) => (
                    <SelectItem key={key} value={key}>{value}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={style} onValueChange={setStyle} defaultValue="default">
                <SelectTrigger className="bg-transparent border-[#3A3A3A] text-white">
                  <SelectValue placeholder={t("form.style.placeholder")} />
                </SelectTrigger>
                <SelectContent className="bg-[#2A2A2A] border-[#3A3A3A]">
                  {Object.entries(t.raw("form.style.options") as Record<string, string>).map(([key, value]) => (
                    <SelectItem key={key} value={key}>{value}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={textEnabled} onValueChange={setTextEnabled} defaultValue="no">
                <SelectTrigger className="bg-transparent border-[#3A3A3A] text-white">
                  <SelectValue placeholder={t("form.text_enabled.placeholder")} />
                </SelectTrigger>
                <SelectContent className="bg-[#2A2A2A] border-[#3A3A3A]">
                  {Object.entries(t.raw("form.text_enabled.options") as Record<string, string>).map(([key, value]) => (
                    <SelectItem key={key} value={key}>{value}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {textEnabled === "yes" && (
                <>
                  <Input
                    placeholder={t("form.text.placeholder")}
                    className="bg-transparent border-[#3A3A3A] text-white placeholder:text-gray-400"
                    value={text}
                    onChange={(e) => setText(e.target.value.slice(0, 10))}
                  />
                  
                  <Select value={textPosition} onValueChange={setTextPosition} defaultValue="behind">
                    <SelectTrigger className="bg-transparent border-[#3A3A3A] text-white">
                      <SelectValue placeholder={t("form.text_position.placeholder")} />
                    </SelectTrigger>
                    <SelectContent className="bg-[#2A2A2A] border-[#3A3A3A]">
                      {Object.entries(t.raw("form.text_position.options") as Record<string, string>).map(([key, value]) => (
                        <SelectItem key={key} value={key}>{value}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </>
              )}

              <Textarea
                placeholder={t("form.custom_style.placeholder")}
                className="min-h-[100px] bg-transparent border-[#3A3A3A] text-white placeholder:text-gray-400 resize-none"
                value={customStyle}
                onChange={(e) => setCustomStyle(e.target.value)}
              />
            </div>

            <Button 
              className="w-full"
              size="lg" 
              onClick={handleGenerate} 
              disabled={loading}
            >
              {t("form.generate")}
            </Button>
          </div>

          <div className="flex-1 rounded-lg bg-transparent border border-[#3A3A3A] p-4 flex items-center justify-center relative">
            {generatedImage && (
              <Button 
                variant="ghost" 
                size="icon"
                className="absolute top-6 right-6 bg-[#1C1C1C]/80 hover:bg-[#1C1C1C] text-white"
                onClick={handleDownload}
              >
                <Download className="h-5 w-5" />
              </Button>
            )}
            <div className="w-full h-full flex items-center justify-center">
              {generatedImage ? (
                <img
                  src={generatedImage}
                  alt="Generated Recipe"
                  className="max-w-full max-h-full object-contain rounded-lg"
                />
              ) : (
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
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

