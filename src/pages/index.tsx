import { useState, useRef } from 'react'
import jsPDF from 'jspdf'
import html2canvas from 'html2canvas'

interface Word {
  word: string
  phonetic: string
  meaning: string
  language: string
}

interface TranslationResult {
  translation?: string[]
  basic?: {
    phonetic?: string
    explains?: string[]
  }
  web?: {
    key: string
    value: string[]
  }[]
  errorCode?: string
}

export default function Home() {
  const [text, setText] = useState('')
  const [selectedWords, setSelectedWords] = useState<Word[]>([])
  const [highlightedWords, setHighlightedWords] = useState<Set<string>>(new Set())
  const [isPlaying, setIsPlaying] = useState(false)
  const speechRef = useRef<SpeechSynthesisUtterance | null>(null)

  // 语言检测函数
  const detectLanguage = (text: string): string => {
    const hasChineseChar = /[\u4e00-\u9fa5]/.test(text)
    const hasEnglishChar = /[a-zA-Z]/.test(text)

    if (hasChineseChar) return 'zh'
    if (hasEnglishChar) return 'en'
    return 'unknown'
  }

  // 分词函数
  const tokenize = (text: string, language: string): string[] => {
    switch (language) {
      case 'zh':
        // 中文按标点符号分句
        return text.split(/([。！？；]+|[\n\r]+)/).filter(Boolean)
      case 'en':
      default:
        return text.split(/(\b|\s+|[.,!?;:])/g)
    }
  }

  // 生成随机柔和的颜色
  const getRandomPastelColor = (word: string) => {
    const colors = [
      'bg-blue-100 border-blue-300',
      'bg-green-100 border-green-300',
      'bg-yellow-100 border-yellow-300',
      'bg-pink-100 border-pink-300',
      'bg-purple-100 border-purple-300',
      'bg-indigo-100 border-indigo-300',
      'bg-red-100 border-red-300',
      'bg-orange-100 border-orange-300'
    ]
    const index = word.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) % colors.length
    return colors[index]
  }

  // 获取有道词典翻译
  const getYoudaoTranslation = async (text: string, from: string): Promise<TranslationResult> => {
    try {
      const response = await fetch('/api/translate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text,
          from,
        }),
      })
      
      if (!response.ok) {
        throw new Error('Translation request failed')
      }
      
      const data = await response.json()
      return data
    } catch (error) {
      console.error('翻译请求失败:', error)
      throw error
    }
  }

  // 文本朗读控制
  const toggleSpeak = () => {
    if (isPlaying) {
      window.speechSynthesis.cancel()
      setIsPlaying(false)
    } else {
      const utterance = new SpeechSynthesisUtterance(text)
      const language = detectLanguage(text)
      switch (language) {
        case 'zh':
          utterance.lang = 'zh-CN'
          break
        case 'en':
        default:
          utterance.lang = 'en-US'
      }
      utterance.onend = () => setIsPlaying(false)
      speechRef.current = utterance
      window.speechSynthesis.speak(utterance)
      setIsPlaying(true)
    }
  }

  // 单词朗读
  const speakWord = (word: string, language: string) => {
    const utterance = new SpeechSynthesisUtterance(word)
    switch (language) {
      case 'zh':
        utterance.lang = 'zh-CN'
        break
      case 'en':
      default:
        utterance.lang = 'en-US'
    }
    window.speechSynthesis.speak(utterance)
  }

  // 删除单词
  const deleteWord = (wordToDelete: string) => {
    setSelectedWords(prev => prev.filter(item => item.word !== wordToDelete))
    setHighlightedWords(prev => {
      const next = new Set(prev)
      next.delete(wordToDelete)
      return next
    })
  }

  // 获取单词信息
  const getWordInfo = async (word: string, language: string): Promise<Word | null> => {
    try {
      // 根据语言选择源语言代码
      const from = language === 'zh' ? 'zh-CHS' : 'en'

      const result = await getYoudaoTranslation(word, from)
      
      if (result.errorCode === '0') {
        return {
          word: word,
          phonetic: result.basic?.phonetic || '',
          meaning: result.translation?.[0] || result.basic?.explains?.join('\n') || '无翻译',
          language: language
        }
      } else {
        throw new Error('翻译失败: ' + result.errorCode)
      }
    } catch (error) {
      console.error('获取翻译失败:', error)
      return {
        word: word,
        phonetic: '',
        meaning: '获取翻译失败',
        language: language
      }
    }
  }

  // 处理文本选择
  const handleTextSelection = async () => {
    const selection = window.getSelection()
    if (!selection || selection.isCollapsed) return

    const selectedText = selection.toString().trim()
    if (selectedText) {
      const language = detectLanguage(selectedText)
      try {
        const wordInfo = await getWordInfo(selectedText, language)
        if (wordInfo) {
          setHighlightedWords(prev => new Set([...prev, selectedText]))
          if (!selectedWords.some(w => w.word === selectedText)) {
            setSelectedWords(prev => [wordInfo, ...prev])
          }
        }
      } catch (error) {
        console.error('获取单词信息失败:', error)
      }
    }
  }

  // 渲染可点击的文本
  const renderText = () => {
    if (!text) return null

    const language = detectLanguage(text)
    const tokens = tokenize(text, language)

    return tokens.map((part, index) => {
      const isWord = part.trim().length > 0 && !/^\s+$/.test(part)

      if (isWord) {
        return (
          <span
            key={index}
            className={`${
              highlightedWords.has(part)
                ? 'bg-[#007AFF]/10 border-b-2 border-[#007AFF]'
                : ''
            } rounded px-0.5`}
          >
            {part}
          </span>
        )
      }
      
      return <span key={index}>{part}</span>
    })
  }

  // 导出为 PDF
  const exportToPDF = async () => {
    try {
      const content = document.getElementById('exportContent')
      if (!content) return

      // 保存原始滚动位置和样式
      const leftContent = content.querySelector('.left-content-scroll') as HTMLElement
      const rightContent = content.querySelector('.right-content-scroll') as HTMLElement
      const originalLeftScroll = leftContent?.scrollTop
      const originalRightScroll = rightContent?.scrollTop
      const originalStyles = {
        left: leftContent?.style.cssText,
        right: rightContent?.style.cssText,
        content: content.style.cssText
      }

      // 临时隐藏不需要的元素
      const speakButtons = document.querySelectorAll('.speak-button')
      const clearButton = document.querySelector('.clear-button')
      speakButtons.forEach(button => (button as HTMLElement).style.display = 'none')
      if (clearButton) (clearButton as HTMLElement).style.display = 'none'

      // 临时修改样式以优化导出效果
      if (leftContent) {
        leftContent.style.height = 'auto'
        leftContent.style.maxHeight = 'none'
        leftContent.style.overflow = 'visible'
        leftContent.style.fontSize = '14px'
        leftContent.style.lineHeight = '1.6'
        leftContent.style.padding = '20px'
      }
      if (rightContent) {
        rightContent.style.height = 'auto'
        rightContent.style.maxHeight = 'none'
        rightContent.style.overflow = 'visible'
        rightContent.style.fontSize = '14px'
        rightContent.style.padding = '20px'
      }

      // 临时修改容器样式
      content.style.height = 'auto'
      content.style.maxHeight = 'none'
      content.style.overflow = 'visible'
      content.style.backgroundColor = '#FFFFFF'

      const canvas = await html2canvas(content, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#FFFFFF',
        height: content.scrollHeight,
        windowHeight: content.scrollHeight,
        onclone: (clonedDoc) => {
          const clonedContent = clonedDoc.getElementById('exportContent')
          if (clonedContent) {
            clonedContent.style.height = 'auto'
            clonedContent.style.maxHeight = 'none'
            clonedContent.style.overflow = 'visible'
          }
        }
      })

      const imgData = canvas.toDataURL('image/png')
      const imgWidth = 842 // A4 宽度，单位是 pt
      const pageHeight = 595 // A4 高度
      const imgHeight = canvas.height * imgWidth / canvas.width

      const pdf = new jsPDF({
        orientation: 'landscape',
        unit: 'pt',
        format: 'a4'
      })

      // 添加多页
      let heightLeft = imgHeight
      let position = 0
      let page = 1

      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight)
      heightLeft -= pageHeight

      while (heightLeft >= 0) {
        position = -pageHeight * page
        pdf.addPage()
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight)
        heightLeft -= pageHeight
        page++
      }

      pdf.save('学习笔记.pdf')

      // 恢复原始样式和滚动位置
      if (leftContent) {
        leftContent.style.cssText = originalStyles.left || ''
        leftContent.scrollTop = originalLeftScroll || 0
      }
      if (rightContent) {
        rightContent.style.cssText = originalStyles.right || ''
        rightContent.scrollTop = originalRightScroll || 0
      }
      content.style.cssText = originalStyles.content || ''

      // 恢复隐藏的元素
      speakButtons.forEach(button => (button as HTMLElement).style.display = '')
      if (clearButton) (clearButton as HTMLElement).style.display = ''

    } catch (error) {
      console.error('PDF导出失败:', error)
    }
  }

  return (
    <div className="flex h-screen bg-[#FFFFFF]">
      {/* 导出按钮 */}
      <div className="fixed top-4 right-4 z-10 flex gap-2">
        <button
          onClick={exportToPDF}
          className="px-4 py-2 bg-[#007AFF] text-white rounded-full hover:bg-[#0066CC] transition-colors text-sm font-medium flex items-center gap-2 shadow-sm"
        >
          <span>导出PDF</span>
          <span>📄</span>
        </button>
      </div>

      {/* 要导出的内容 */}
      <div id="exportContent" className="flex w-full h-full">
        {/* 左侧文章区域 */}
        <div className="w-[70%] h-full p-8 flex flex-col">
          {/* 文章操作栏 */}
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-medium text-[#1D1D1F]">
              文章内容
            </h2>
            {text && (
              <button
                onClick={() => {
                  setText('')
                  setSelectedWords([])
                  setHighlightedWords(new Set())
                }}
                className="px-3 py-1.5 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors text-sm font-medium flex items-center gap-1 shadow-sm clear-button"
              >
                <span>清除文章</span>
                <span>🗑</span>
              </button>
            )}
          </div>

          <div 
            className="flex-1 relative bg-[#F5F5F7] rounded-2xl p-8 overflow-y-auto left-content-scroll"
            onMouseUp={handleTextSelection}
          >
            <div className="max-w-3xl mx-auto">
              {text ? (
                <div className="text-[17px] leading-relaxed whitespace-pre-wrap">
                  {renderText()}
                </div>
              ) : (
                <textarea
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  className="w-full h-full bg-transparent resize-none focus:outline-none text-[17px] leading-relaxed"
                  placeholder="请粘贴文章内容（支持中译英，英译中），选中文本即可添加到笔记..."
                />
              )}
            </div>
          </div>
          
          <button
            onClick={toggleSpeak}
            className="mt-4 px-6 py-3 bg-[#007AFF] text-white rounded-full hover:bg-[#0066CC] transition-colors text-sm font-medium flex items-center justify-center gap-2 max-w-xs mx-auto speak-button"
          >
            {isPlaying ? (
              <>
                <span>暂停朗读</span>
                <span>⏸</span>
              </>
            ) : (
              <>
                <span>开始朗读</span>
                <span>▶️</span>
              </>
            )}
          </button>
        </div>

        {/* 右侧单词列表 */}
        <div className="w-[30%] h-full bg-[#F5F5F7] p-4 overflow-y-auto right-content-scroll">
          <h2 className="text-lg font-medium text-[#1D1D1F] mb-4 px-2">
            已收藏内容 ({selectedWords.length})
          </h2>
          <div className="space-y-2">
            {selectedWords.map((item, index) => (
              <div 
                key={index}
                className={`${getRandomPastelColor(item.word)} p-3 rounded-xl shadow-sm hover:shadow-md transition-all border relative group`}
              >
                {/* 删除按钮 */}
                <button
                  onClick={() => deleteWord(item.word)}
                  className="absolute -right-2 -top-2 w-6 h-6 bg-red-500 text-white rounded-full 
                    opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center
                    hover:bg-red-600 shadow-sm"
                >
                  ×
                </button>

                <div className="flex items-center justify-between">
                  <span className="text-lg font-medium text-[#1D1D1F]">
                    {item.word}
                  </span>
                  <button
                    onClick={() => speakWord(item.word, item.language)}
                    className="p-1.5 hover:bg-white/50 rounded-full transition-colors speak-button"
                  >
                    🔊
                  </button>
                </div>
                <div className="text-sm font-mono text-[#86868B] mt-1">
                  {item.phonetic}
                </div>
                <div className="text-sm text-[#1D1D1F] mt-1">
                  {item.meaning}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}