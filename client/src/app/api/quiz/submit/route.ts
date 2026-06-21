import { NextRequest } from 'next/server';
import { getFirebaseFirestore } from '../../../../lib/config/firebaseAdmin';
import { FieldValue } from 'firebase-admin/firestore';
import { jsonSuccess, jsonError } from '../../../../lib/utils/apiResponse';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { categoryId, answers, questionIds, userId, username } = body;

    if (!categoryId || !answers || !Array.isArray(questionIds) || questionIds.length === 0) {
      return jsonError('Category ID, answers, and presented question IDs are required', 400);
    }

    const db = getFirebaseFirestore();

    // 1. Fetch correct answers and details from Firestore
    const questionsSnapshot = await db
      .collection('quizQuestions')
      .where('category_id', '==', categoryId)
      .get();

    if (questionsSnapshot.empty) {
      return jsonError('No questions found for this category', 404);
    }

    const presentedIds = new Set(questionIds.map(String));
    const questionsData = questionsSnapshot.docs
      .map(doc => ({ id: doc.id, ...doc.data() }) as Record<string, any>)
      .filter((question) => presentedIds.has(String(question.id)) && question.status !== 'inactive');

    if (questionsData.length === 0) {
      return jsonError('The presented quiz questions are no longer available', 409);
    }

    // 2. Validate answers and compute score
    let correctCount = 0;
    let wrongCount = 0;
    let pointsEarned = 0;
    const resultsDetails = [];

    for (const question of questionsData) {
      const qId = question.id;
      const userAnswer = (answers[qId] || '').trim();
      const correctAnswer = (question.correctAnswer || '').trim();
      const isCorrect = userAnswer.toLowerCase() === correctAnswer.toLowerCase();

      if (isCorrect) {
        correctCount++;
        pointsEarned += question.points || 10;
      } else {
        wrongCount++;
      }

      resultsDetails.push({
        questionId: qId,
        question: question.question,
        userAnswer: userAnswer || 'Skipped',
        correctAnswer: correctAnswer,
        isCorrect,
        explanation: question.explanation || ''
      });
    }

    const totalQuestions = questionsData.length;
    const scorePercentage = Math.round((correctCount / totalQuestions) * 100);

    // 3. Determine earned badges
    const earnedBadgeIds: string[] = [];

    if (scorePercentage >= 50) {
      earnedBadgeIds.push('explorer');
    }
    if (scorePercentage === 100) {
      earnedBadgeIds.push('quiz_champion');
    }
    if (scorePercentage >= 80) {
      if (categoryId === 'dinosaur') {
        earnedBadgeIds.push('dino_expert');
      } else if (categoryId === 'ancient-india') {
        earnedBadgeIds.push('history_master');
      } else if (categoryId === 'science' || categoryId === 'space') {
        earnedBadgeIds.push('science_genius');
      }
    }

    // 4. Fetch Badge Definitions for those earned
    let earnedBadges: any[] = [];
    if (earnedBadgeIds.length > 0) {
      const badgesSnapshot = await db.collection('quizBadges').get();
      const allBadges = badgesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      earnedBadges = allBadges.filter(badge => earnedBadgeIds.includes(badge.id));
    }

    // 5. Store Score and Update User Badges if Logged In
    if (userId) {
      const scoreRef = db.collection('quizScores').doc();
      const scoreRecord = {
        score_id: scoreRef.id,
        userId,
        username: username || 'Explorer',
        score: scorePercentage,
        correctAnswers: correctCount,
        wrongAnswers: wrongCount,
        category: categoryId,
        earnedBadges: earnedBadgeIds,
        completedAt: new Date().toISOString()
      };
      
      await scoreRef.set(scoreRecord);

      // Save badges directly to user document if they exist
      if (earnedBadgeIds.length > 0) {
        const userRef = db.collection('users').doc(userId);
        const userDoc = await userRef.get();
        if (userDoc.exists) {
          await userRef.update({
            earnedBadges: FieldValue.arrayUnion(...earnedBadgeIds)
          });
        }
      }
    }

    return jsonSuccess({
      score: scorePercentage,
      totalQuestions,
      correctCount,
      wrongCount,
      pointsEarned,
      badgesEarned: earnedBadges,
      results: resultsDetails
    });
  } catch (error) {
    console.error('Error submitting quiz answers:', error);
    return jsonError('Failed to submit quiz', 500);
  }
}
