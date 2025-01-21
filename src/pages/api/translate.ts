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
  // 添加请求方法检查
  console.log('API Route 被调用:', {
    method: req.method,
    body: req.body,
    env: process.env.NODE_ENV
  })

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { text, from } = req.body

    // 添加输入验证
    if (!text || !from) {
      return res.status(400).json({
        error: '缺少必要参数',
        debug: { text, from }
      })
    }

    // 检查环境变量
    const appKey = process.env.YOUDAO_APP_KEY
    const appSecret = process.env.YOUDAO_APP_SECRET

    if (!appKey || !appSecret) {
      console.error('环境变量缺失:', {
        hasAppKey: !!appKey,
        hasAppSecret: !!appSecret,
        env: process.env.NODE_ENV
      })
      return res.status(500).json({
        error: '服务器配置错误',
        debug: {
          hasAppKey: !!appKey,
          hasAppSecret: !!appSecret,
          env: process.env.NODE_ENV
        }
      })
    }

    // 生成签名
    const salt = new Date().getTime()
    const curtime = Math.round(new Date().getTime() / 1000)
    const str = appKey + truncate(text) + salt + curtime + appSecret
    const sign = CryptoJS.SHA256(str).toString(CryptoJS.enc.Hex)

    // 构建请求参数
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

    // 发送请求到有道API
    const response = await fetch('https://openapi.youdao.com/api', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: params
    })

    const data = await response.json()

    // 检查API响应
    if (data.errorCode !== '0') {
      console.error('有道API错误:', data)
      return res.status(400).json({
        error: '翻译失败',
        errorCode: data.errorCode,
        debug: data
      })
    }

    // 返回成功结果
    return res.status(200).json(data)

  } catch (error) {
    console.error('服务器错误:', error)
    return res.status(500).json({
      error: '服务器内部错误',
      debug: error instanceof Error ? error.message : String(error)
    })
  }
}

function truncate(q: string): string {
  const len = q.length
  if (len <= 20) return q
  return q.substring(0, 10) + len + q.substring(len - 10)
}