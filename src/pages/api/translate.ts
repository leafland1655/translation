import type { NextApiRequest, NextApiResponse } from 'next'
import CryptoJS from 'crypto-js'

interface TranslateResponse {
  errorCode?: string
  translation?: string[]
  basic?: {
    phonetic?: string
    explains?: string[]
  }
  web?: {
    key: string
    value: string[]
  }[]
  error?: string
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<TranslateResponse>
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { text, from } = req.body
    
    if (!text || !from) {
      return res.status(400).json({ error: '缺少必要参数' })
    }

    const appKey = process.env.YOUDAO_APP_KEY
    const appSecret = process.env.YOUDAO_APP_SECRET
    
    if (!appKey || !appSecret) {
      return res.status(500).json({ error: '服务器配置错误' })
    }

    const salt = new Date().getTime()
    const curtime = Math.round(new Date().getTime() / 1000)
    const str = appKey + truncate(text) + salt + curtime + appSecret
    const sign = CryptoJS.SHA256(str).toString(CryptoJS.enc.Hex)

    const params = new URLSearchParams({
      q: text,
      appKey: appKey,
      salt: salt.toString(),
      from: from,
      to: from === 'en' ? 'zh-CHS' : 'en',
      sign: sign,
      signType: 'v3',
      curtime: curtime.toString(),
    })

    const response = await fetch('https://openapi.youdao.com/api', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: params
    })

    const data = await response.json()

    if (data.errorCode !== '0') {
      return res.status(400).json({ 
        error: '翻译失败',
        errorCode: data.errorCode 
      })
    }

    return res.status(200).json(data)

  } catch (error) {
    console.error('翻译服务错误:', error)
    return res.status(500).json({ 
      error: '服务器内部错误'
    })
  }
}

function truncate(q: string): string {
  const len = q.length
  if (len <= 20) return q
  return q.substring(0, 10) + len + q.substring(len - 10)
}