import type { NextApiRequest, NextApiResponse } from 'next'
import CryptoJS from 'crypto-js'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' })
  }

  const { text, from } = req.body

  try {
    const appKey = process.env.NEXT_PUBLIC_YOUDAO_APP_KEY
    const key = process.env.NEXT_PUBLIC_YOUDAO_APP_SECRET
    const salt = new Date().getTime()
    const curtime = Math.round(new Date().getTime() / 1000)
    
    const input = text.length <= 20 ? text : text.substring(0, 10) + text.length + text.substring(text.length - 10)
    const sign = CryptoJS.SHA256(appKey + input + salt + curtime + key).toString()

    // 根据源语言设置目标语言
    const to = from === 'zh-CHS' ? 'en' : 'zh-CHS'

    const response = await fetch('https://openapi.youdao.com/api', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        q: text,
        from: from,
        to: to,
        appKey: appKey!,
        salt: salt.toString(),
        sign: sign,
        signType: 'v3',
        curtime: curtime.toString(),
      }).toString()
    })

    const data = await response.json()
    res.status(200).json(data)
  } catch (error) {
    console.error('Translation error:', error)
    res.status(500).json({ message: 'Translation failed' })
  }
}