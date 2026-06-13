import { NextRequest } from 'next/server';
import { jsonError, jsonSuccess } from '../../../../../lib/utils/apiResponse';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { image, mimeType } = body;

    if (!image) {
      return jsonError('Image data is required', 400);
    }

    let base64Data = image;
    let actualMimeType = mimeType || 'image/jpeg';
    if (image.startsWith('data:')) {
      const parts = image.split(';base64,');
      if (parts.length === 2) {
        actualMimeType = parts[0].replace('data:', '');
        base64Data = parts[1];
      }
    }

    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return jsonError('GEMINI_API_KEY is required for real museum image analysis. Dummy analysis data has been disabled.', 503);
    }

    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

    const response = await fetch(geminiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: "Extract attributes for a museum registration from this image. Return a JSON object with the following fields: 'name' (museum name), 'location' (city), 'state' (state name in India), 'category' (e.g. History, Art, Science, Heritage, Multi-purpose), 'prices' (a sub-object containing numerical ticket prices in INR for the keys 'Adult', 'Child', 'Senior Citizen', 'Student', 'Professor', 'Researcher/Scientist'. If not explicitly visible, default to: Adult 200, Child 100, Senior Citizen 150, Student 120, Professor 180, Researcher/Scientist 180), and 'description' (a brief 1-2 sentence description). Respond ONLY with the JSON object, no markdown, no explanation."
              },
              {
                inlineData: {
                  mimeType: actualMimeType,
                  data: base64Data
                }
              }
            ]
          }
        ],
        generationConfig: {
          responseMimeType: "application/json"
        }
      })
    });

    if (!response.ok) {
      const errPayload = await response.json().catch(() => ({}));
      throw new Error(errPayload?.error?.message || 'Gemini API call failed');
    }

    const geminiResult = await response.json();
    const textResponse = geminiResult.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!textResponse) {
      throw new Error('Gemini did not return any content');
    }

    try {
      const parsed = JSON.parse(textResponse.trim());
      const basePrices = parsed.prices || {};

      return jsonSuccess({
        success: true,
        attributes: {
          name: parsed.name || '',
          location: parsed.location || '',
          state: parsed.state || '',
          category: parsed.category || 'General',
          prices: {
            Adult: Number(basePrices.Adult ?? basePrices.adult ?? 200),
            Child: Number(basePrices.Child ?? basePrices.child ?? 100),
            "Senior Citizen": Number(basePrices["Senior Citizen"] ?? basePrices.senior_citizen ?? 150),
            Student: Number(basePrices.Student ?? basePrices.student ?? 120),
            Professor: Number(basePrices.Professor ?? basePrices.professor ?? 180),
            "Researcher/Scientist": Number(basePrices["Researcher/Scientist"] ?? basePrices.researcher_scientist ?? 180)
          },
          description: parsed.description || ''
        }
      }, 200);
    } catch (parseError) {
      console.error('Failed to parse Gemini JSON:', textResponse, parseError);
      throw new Error('AI returned invalid format: ' + textResponse.substring(0, 100));
    }
  } catch (error) {
    return jsonError((error as Error).message || 'Analysis failed', 500);
  }
}
