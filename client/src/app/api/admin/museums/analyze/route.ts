import { NextRequest } from 'next/server';
import { jsonError, jsonSuccess } from '../../../../../lib/utils/apiResponse';

export const runtime = 'nodejs';

// Dynamic category pricing defaults based on base price or standard structure
const MOCK_MUSEUMS = [
  {
    name: "Visvesvaraya Science Museum",
    location: "Bengaluru",
    state: "Karnataka",
    category: "Science & Technology",
    prices: {
      Adult: 150,
      Child: 70,
      "Senior Citizen": 100,
      Student: 80,
      Professor: 130,
      "Researcher/Scientist": 130
    },
    description: "An interactive science museum showcasing industrial machinery, physics experiments, and space technology exhibits."
  },
  {
    name: "Victoria Memorial Gallery",
    location: "Kolkata",
    state: "West Bengal",
    category: "History & Art",
    prices: {
      Adult: 180,
      Child: 90,
      "Senior Citizen": 130,
      Student: 100,
      Professor: 160,
      "Researcher/Scientist": 160
    },
    description: "A grand marble monument housing colonial-era paintings, manuscripts, and rich heritage art of Bengal."
  },
  {
    name: "National Handicrafts Museum",
    location: "New Delhi",
    state: "Delhi",
    category: "Heritage & Craft",
    prices: {
      Adult: 200,
      Child: 100,
      "Senior Citizen": 150,
      Student: 120,
      Professor: 180,
      "Researcher/Scientist": 180
    },
    description: "A unique open-air museum housing traditional crafts, textiles, and wood carvings representing rural Indian heritage."
  }
];

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { image, mimeType, filename } = body;

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

    if (apiKey) {
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
          isSimulated: false,
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
    } else {
      await new Promise((resolve) => setTimeout(resolve, 1500));

      let chosenIndex = base64Data.length % MOCK_MUSEUMS.length;
      if (filename) {
        const lowerName = filename.toLowerCase();
        if (lowerName.includes('science') || lowerName.includes('tech') || lowerName.includes('visves')) {
          chosenIndex = 0;
        } else if (lowerName.includes('victoria') || lowerName.includes('memorial') || lowerName.includes('art')) {
          chosenIndex = 1;
        } else if (lowerName.includes('craft') || lowerName.includes('handicraft') || lowerName.includes('national')) {
          chosenIndex = 2;
        }
      }

      const attributes = MOCK_MUSEUMS[chosenIndex];

      return jsonSuccess({
        success: true,
        isSimulated: true,
        message: 'Running in Simulation Mode. Configure GEMINI_API_KEY in .env for real AI extraction.',
        attributes
      }, 200);
    }
  } catch (error) {
    return jsonError((error as Error).message || 'Analysis failed', 500);
  }
}
