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
  debug?: any
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
    console.log('收到翻译请求:', { text, from })

    const appKey = process.env.YOUDAO_APP_KEY
    const appSecret = process.env.YOUDAO_APP_SECRET
    
    console.log('环境变量检查:', {
      hasAppKey: !!appKey,
      appKeyLength: appKey?.length,
      hasAppSecret: !!appSecret,
      secretLength: appSecret?.length,
      NODE_ENV: process.env.NODE_ENV
    })

    if (!appKey || !appSecret) {
      console.error('API凭证缺失')
      return res.status(400).json({ 
        error: 'API凭证缺失',
        debug: {
          hasAppKey: !!appKey,
          hasAppSecret: !!appSecret,
          env: process.env.NODE_ENV
        }
      })
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

    console.log('请求有道API:', {
      url: 'https://openapi.youdao.com/api',
      method: 'POST',
      params: params.toString()
    })

    const response = await fetch('https://openapi.youdao.com/api', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: params
    })

    if (!response.ok) {
      console.error('有道API响应错误:', {
        status: response.status,
        statusText: response.statusText
      })
      throw new Error(`API response not ok: ${response.status} ${response.statusText}`)
    }

    const data = await response.json()
    console.log('有道API响应:', data)

    if (data.errorCode !== '0') {
      console.error('有道API错误:', data)
      return res.status(400).json({
        error: `翻译API错误: ${data.errorCode}`,
        errorCode: data.errorCode,
        debug: data
      })
    }

    return res.status(200).json(data)
  } catch (error) {
    console.error('翻译服务错误:', error)
    return res.status(500).json({
      error: error instanceof Error ? error.message : '翻译服务出错',
      errorCode: '500',
      debug: { error: error instanceof Error ? error.message : error }
    })
  }
}

function truncate(q: string): string {
  const len = q.length
  if (len <= 20) return q
  return q.substring(0, 10) + len + q.substring(len - 10)
}