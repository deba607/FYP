import { NextRequest } from 'next/server';
import { getFirebaseFirestore } from '../../../../lib/config/firebaseAdmin';
import { jsonSuccess, jsonError } from '../../../../lib/utils/apiResponse';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId');

    const db = getFirebaseFirestore();

    // Fetch all quiz categories to filter
    const categoriesSnapshot = await db.collection('quizCategories').get();
    const allCategories = categoriesSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as any[];

    if (!userId) {
      // For guests, return default recommendations (e.g., Dinosaur, Ancient India, Space)
      const defaults = allCategories.filter(cat => 
        ['dinosaur', 'ancient-india', 'space'].includes(cat.id)
      );
      return jsonSuccess({ recommendations: defaults });
    }

    // 1. Fetch user bookings
    const bookingsSnapshot = await db
      .collection('bookings')
      .where('userId', '==', userId)
      .get();

    if (bookingsSnapshot.empty) {
      // No bookings yet, recommend easy and popular quizzes
      const defaults = allCategories.filter(cat => 
        ['dinosaur', 'ancient-india', 'space'].includes(cat.id)
      );
      return jsonSuccess({ recommendations: defaults, reason: 'Curated for new explorers' });
    }

    const bookings = bookingsSnapshot.docs.map(doc => doc.data());

    // 2. Analyze booking museums and categories
    let hasScience = false;
    let hasHistory = false;
    let hasArt = false;
    let hasNature = false;

    for (const booking of bookings) {
      const museumCategory = String(booking.museumCategory || '').toLowerCase();
      const museumName = String(booking.museumName || '').toLowerCase();

      if (museumCategory.includes('science') || museumCategory.includes('technology') || museumName.includes('science') || museumName.includes('space') || museumName.includes('planetarium')) {
        hasScience = true;
      }
      if (museumCategory.includes('history') || museumCategory.includes('archaeological') || museumName.includes('history') || museumName.includes('archaeology') || museumName.includes('fort') || museumName.includes('palace')) {
        hasHistory = true;
      }
      if (museumCategory.includes('art') || museumCategory.includes('painting') || museumName.includes('art') || museumName.includes('gallery') || museumName.includes('painting')) {
        hasArt = true;
      }
      if (museumCategory.includes('natural') || museumCategory.includes('zoo') || museumName.includes('natural') || museumName.includes('wildlife') || museumName.includes('zoo')) {
        hasNature = true;
      }
    }

    // 3. Match categories based on analysis
    const recommendedIds: string[] = [];

    if (hasHistory) {
      recommendedIds.push('ancient-india');
      recommendedIds.push('dinosaur'); // Dinosaurs are popular for history/natural history
    }
    if (hasScience) {
      recommendedIds.push('science');
      recommendedIds.push('space');
    }
    if (hasArt) {
      recommendedIds.push('paintings');
    }
    if (hasNature) {
      recommendedIds.push('wildlife');
    }

    // Fallback: If no matching categories were identified, recommend default ones
    if (recommendedIds.length === 0) {
      recommendedIds.push('dinosaur', 'ancient-india', 'space');
    }

    const recommendations = allCategories.filter(cat => recommendedIds.includes(cat.id));
    
    return jsonSuccess({
      recommendations,
      reason: `Based on your bookings for ${bookings.length} museum visits.`
    });
  } catch (error) {
    console.error('Error fetching quiz recommendations:', error);
    return jsonError('Failed to fetch recommendations', 500);
  }
}
