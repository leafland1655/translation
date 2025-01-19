import type { NextApiRequest, NextApiResponse } from 'next'
import axios, { AxiosError } from 'axios'

interface GenerateSpeechRequest {
  topic: string
  language: string
  style?: string
  length?: string
}

interface GenerateSpeechResponse {
  message?: string
  speech?: string
  translation?: string
  error?: string
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<GenerateSpeechResponse>
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' })
  }

  const { topic, language, style = 'formal', length = 'medium' } = req.body as GenerateSpeechRequest

  try {
    // 构建 prompt
    let prompt = ''
    if (language === 'en') {
      prompt = `Write a ${style} speech about "${topic}". The speech should be ${length} in length and suitable for oral presentation. Include an introduction, main points, and a conclusion. Make it engaging and natural.`
    } else {
      prompt = `用中文写一篇关于"${topic}"的${style === 'formal' ? '正式' : '轻松'}演讲稿。演讲长度应该是${
        length === 'short' ? '3-5分钟' : length === 'medium' ? '5-8分钟' : '8-10分钟'
      }，适合口头演讲。包括开场白、主要内容和结束语。要生动自然，易于理解。`
    }

    // 调用 OpenAI API 生成演讲稿
    const openaiResponse = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content:
              'You are a professional speechwriter who can write engaging and natural speeches in both English and Chinese.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.7,
        max_tokens: 1000,
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
        },
      }
    )

    const speech = openaiResponse.data.choices[0].message.content.trim()

    // 如果是英文演讲，获取中文翻译
    let translation = ''
    if (language === 'en') {
      const translationResponse = await axios.post(
        'https://api.openai.com/v1/chat/completions',
        {
          model: 'gpt-3.5-turbo',
          messages: [
            {
              role: 'system',
              content:
                'You are a professional translator who can translate English to Chinese naturally and accurately.',
            },
            {
              role: 'user',
              content: `Please translate the following English speech to Chinese:\n\n${speech}`,
            },
          ],
          temperature: 0.3,
          max_tokens: 1000,
        },
        {
          headers: {
            Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
            'Content-Type': 'application/json',
          },
        }
      )

      translation = translationResponse.data.choices[0].message.content.trim()
    }

    res.status(200).json({
      speech,
      translation: translation || undefined,
    })
  } catch (error) {
    if (error instanceof AxiosError) {
      console.error('API Error:', error.response?.data || error)
      res.status(500).json({
        message: '生成演讲稿时出错',
        error: error.response?.data || error.message,
      })
    } else {
      console.error('Unexpected error:', error)
      res.status(500).json({
        message: '生成演讲稿时出错',
        error: 'An unexpected error occurred',
      })
    }
  }
}