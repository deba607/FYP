export interface QuizCategory {
  id: string; // matches document ID in quizCategories
  name: string;
  icon: string; // Emoji or Lucide icon name
  description: string;
  color: string; // Tailwind color class e.g., 'from-amber-400 to-orange-500'
  difficulty: 'Easy' | 'Medium' | 'Hard';
  ageGroup: 'Kids' | 'Teens' | 'All';
  questionCount?: number;
}

export interface QuizQuestion {
  id: string; // matches document ID in quizQuestions
  category_id: string;
  museum_id?: string; // linked museum if any
  museum_name?: string;
  question: string;
  options: string[];
  imageUrl?: string; // optional image URL (e.g. for guess the artifact/painting)
  difficulty: 'Easy' | 'Medium' | 'Hard';
  points: number;
  type: 'multiple-choice' | 'true-false' | 'image-guess';
  status?: 'active' | 'inactive';
  createdAt?: string;
  updatedAt?: string;
  // Note: correctAnswer and explanation are excluded from client-facing lists for security.
}

export interface QuizQuestionBackend extends QuizQuestion {
  correctAnswer: string; // "A", "B", "C", "D" or "True", "False" etc.
  explanation: string;
}

export interface QuizScore {
  id?: string;
  userId: string;
  username: string;
  score: number; // percentage or points
  correctAnswers: number;
  wrongAnswers: number;
  category: string;
  museum?: string;
  earnedBadges: string[];
  completedAt: string;
}

export interface QuizBadge {
  id: string;
  title: string;
  description: string;
  image: string; // Emoji e.g., '🏆' or URL
  minimumScore: number; // Percentage or score points required
}

export interface QuizSubmission {
  categoryId: string;
  answers: { [questionId: string]: string }; // Map of questionId -> selectedOption
  questionIds: string[]; // Exact questions presented to the player
}

export interface QuizResultResponse {
  score: number;
  totalQuestions: number;
  correctCount: number;
  wrongCount: number;
  pointsEarned: number;
  badgesEarned: QuizBadge[];
  results: {
    questionId: string;
    question: string;
    userAnswer: string;
    correctAnswer: string;
    isCorrect: boolean;
    explanation: string;
  }[];
}
