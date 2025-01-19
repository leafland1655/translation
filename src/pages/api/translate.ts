import type { NextApiRequest, NextApiResponse } from 'next'
import CryptoJS from 'crypto-js'

// ... 其他代码保持不变 ...

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse<TranslateResponse>
  ) {
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' })
    }
  
    try {
      const { text, from } = req.body
      console.log('收到翻译请求:', { text, from }) // 添加日志
  
      const appKey = process.env.NEXT_PUBLIC_YOUDAO_APP_KEY
      const appSecret = process.env.NEXT_PUBLIC_YOUDAO_APP_SECRET
      
      console.log('API 凭证检查:', { 
        hasAppKey: !!appKey, 
        hasAppSecret: !!appSecret,
        appKeyLength: appKey?.length,
        secretLength: appSecret?.length
      })
  
      if (!appKey || !appSecret) {
        throw new Error('API credentials are required')
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
        params: params.toString()
      })
  
      const response = await fetch('https://openapi.youdao.com/api', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: params
      })
  
      const data = await response.json()
      console.log('有道API响应:', data)
  
      res.status(200).json(data)
    } catch (error) {
      console.error('翻译出错:', error)
      res.status(500).json({
        error: error instanceof Error ? error.message : '翻译失败',
        errorCode: '500'
      })
    }
  }