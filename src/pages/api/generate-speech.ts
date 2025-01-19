import { NextApiRequest, NextApiResponse } from 'next';
import axios from 'axios';

const API_KEY = process.env.TONGYI_API_KEY;
const API_ENDPOINT = 'https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    const { topic, wordCount } = req.body;

    // 生成演讲稿
    const speechPrompt = `Please generate a formal English speech about "${topic}" with approximately ${wordCount} words.
    Requirements:
    1. Use formal and professional language
    2. Include clear opening, body, and conclusion
    3. Use advanced vocabulary and expressions
    4. Ensure logical flow and persuasiveness
    5. Make it engaging and suitable for public speaking`;

    console.log('Calling Tongyi API for speech generation...');
    const speechResponse = await axios.post(API_ENDPOINT, {
      model: 'qwen-max',
      input: {
        messages: [
          {
            role: 'user',
            content: speechPrompt
          }
        ]
      }
    }, {
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    const speechText = speechResponse.data.output.text;

    // 提取关键词
    const keywordPrompt = `Analyze the following speech and extract 5-8 important words or phrases. 
    For each word/phrase, provide:
    1. The word/phrase in English
    2. Its IPA phonetic transcription
    3. Chinese translation and brief explanation
    
    Return the result in this JSON format:
    [
      {
        "text": "word or phrase",
        "phonetic": "IPA phonetic",
        "meaning": "Chinese translation and explanation"
      }
    ]

    Speech text:
    ${speechText}`;

    console.log('Calling Tongyi API for keyword extraction...');
    const keywordResponse = await axios.post(API_ENDPOINT, {
      model: 'qwen-max',
      input: {
        messages: [
          {
            role: 'user',
            content: keywordPrompt
          }
        ]
      }
    }, {
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    let keywords = [];
    try {
      keywords = JSON.parse(keywordResponse.data.output.text);
    } catch (error) {
      console.error('Error parsing keywords:', error);
      console.log('Raw keyword response:', keywordResponse.data.output.text);
    }

    res.status(200).json({
      speech: speechText,
      keywords: keywords
    });

  } catch (error) {
    console.error('API Error:', error.response?.data || error);
    res.status(500).json({ 
      message: '生成演讲稿时出错',
      error: error.response?.data || error.message,
      details: error.response?.data
    });
  }
}