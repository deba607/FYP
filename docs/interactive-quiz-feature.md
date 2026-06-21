# Bharat Museum: Interactive Quiz for Kids – Feature Documentation

This document provides a comprehensive technical overview and development summary of the **Interactive Quiz for Kids** feature implemented in the Bharat Museum Ticket Booking System.

The feature is built using the MERN stack (Next.js/React frontend and backend APIs, Firebase Firestore and Realtime Database) integrated with a Python AI Chatbot engine. It supports two main modes of interaction:
1. **Manual Mode** via a dedicated Web Dashboard (`/quiz`).
2. **Conversational Mode** via the AI Chatbot assistant.

---

## 1. Database Architecture & Schema

The quiz system uses Firebase Firestore for persistent storage. Four collections coordinate quiz content, score tracking, user badges, and profile achievements.

### 1.1 `quizCategories` Collection
Stores metadata for the available quiz subjects.
* **Fields:**
  * `id` (string, unique category identifier: e.g., `dinosaur`, `ancient-india`, `space`)
  * `name` (string, localized display name)
  * `icon` (string, emoji representing the topic)
  * `color` (string, CSS Tailwind gradient class)
  * `difficulty` (string, e.g., `Easy`, `Medium`, `Hard`)
  * `questionCount` (number, number of questions available)

### 1.2 `quizQuestions` Collection
Stores trivia questions mapping to categories.
* **Fields:**
  * `id` (string, unique document key)
  * `category_id` (string, matches category id)
  * `type` (string, `multiple_choice` | `true_false` | `image_choice`)
  * `question` (string, question text)
  * `options` (array of strings, available answers)
  * `correctAnswer` (string, correct value)
  * `hint` (string, helper clue)
  * `points` (number, score points: e.g., `10`)
  * `explanation` (string, explanation displayed upon answer review)
  * `imageUrl` (string, optional URL for visual questions)

### 1.3 `quizBadges` Collection
Defines rewards and achievements earned by children for high scores.
* **Fields:**
  * `id` (string, e.g., `explorer`, `quiz_champion`, `dino_expert`)
  * `title` (string, badge name)
  * `description` (string, unlocking condition explanation)
  * `icon` (string, e.g., `🏆`, `🦖`)
  * `imageUrl` (string, optional custom graphical icon URL)

### 1.4 `quizScores` Collection
Logs final results of completed games.
* **Fields:**
  * `score_id` (string, unique record identifier)
  * `userId` (string, points to Firebase Auth UID)
  * `username` (string, display name of the visitor)
  * `score` (number, percentage: e.g., `80`)
  * `correctAnswers` (number, correct answers count)
  * `wrongAnswers` (number, incorrect answers count)
  * `category` (string, category identifier)
  * `earnedBadges` (array of strings, list of badge IDs earned in this session)
  * `completedAt` (string, ISO timestamp)

### 1.5 User Profile Integration (`users` Collection)
Each user document contains an array field `earnedBadges` (string array) tracking all badges earned across quiz sessions.

---

## 2. Database Seeding & Security Rules

### 2.1 Database Seeding
An automatic seeder `client/src/lib/services/seedQuiz.ts` ensures categories, badges, and initial question banks are populated on startup. It is triggered safely on server start and verified via api routing to ensure a valid question bank is always ready.

### 2.2 Security Rules (`firestore.rules`)
Firestore security rules are configured to keep the quiz secure:
* **Categories, Questions, Badges, and Leaderboard:** Publicly readable.
* **Quiz Scores:** Users can read and write their own scores (`request.auth.uid == resource.data.userId` / `request.auth.uid == request.resource.data.userId`).
* **Admin Controls:** `POST`, `PATCH`, `DELETE` operations on categories, questions, and badges are restricted to users with `admin` role checked via claims or custom collections database lookup.

---

## 3. Backend REST APIs (Next.js App Router)

Next.js APIs are located in `client/src/app/api/quiz/` and secure endpoints require admin authorization using Firebase admin token validation.

* **`GET /api/quiz/categories`**: Retrieves all categories.
* **`GET /api/quiz/questions/[id]`**: Fetches a randomized set of 5 questions for a specific category.
* **`GET /api/quiz/leaderboard`**: Fetches global high scores.
* **`GET /api/quiz/badges`**: Lists all available badges.
* **`GET /api/quiz/recommendations`**: Analyzes visitor's past museum ticket bookings and returns recommended quiz categories (e.g., matching historical categories, science galleries, etc.).
* **`POST /api/quiz/submit`**: Handles answer verification, computes final score, grants matching badges, updates the user's document in Firestore (`users.earnedBadges`), and saves the score log (`quizScores`).
* **Admin CRUD Endpoints:**
  * `POST /api/quiz/categories`, `PATCH /api/quiz/categories/[id]`, `DELETE /api/quiz/categories/[id]`
  * `POST /api/quiz/questions`, `PATCH /api/quiz/questions/[id]`, `DELETE /api/quiz/questions/[id]`
  * `POST /api/quiz/badges`, `PATCH /api/quiz/badges/[id]`, `DELETE /api/quiz/badges/[id]`

---

## 4. Frontend Hooks & Dashboard

### 4.1 Custom React Hooks
* **`useTimer` (`client/src/hooks/useTimer.ts`)**: Controls a count-down timer (default 30 seconds). Emits events on tick, pauses, resets, and triggers `onTimeUp` callback to handle auto-forfeiture of questions.
* **`useQuiz` (`client/src/hooks/useQuiz.ts`)**: Manages the complete game loop:
  * Transitions through status: `idle` -> `instructions` -> `playing` -> `submitting` -> `results` -> `error`.
  * Manages points, correct answer metrics, used clues (hints), skips, and tracks 3 explorer lives.
  * Submits answers to `/api/quiz/submit` and sets the resulting scores/badges in state.

### 4.2 Web Interface (`/quiz`)
A stunning glassmorphism-styled dashboard containing:
* **Categories Tab:** Lists available themes with interactive hover cards.
* **My Badges Tab:** Shows unlocked badges with color-grading and locked badges in grayscale with tooltips.
* **Leaderboard Tab:** Displays high scores with leaderboard rankings (1st, 2nd, 3rd place highlighted with trophy badges).
* **Recommendations banner:** Auto-suggests quizzes based on user ticket purchase histories.
* **Gameplay Canvas:**
  * Animated instructions with rules.
  * Question slide containing: progress bar, circular SVG countdown timer, dynamic lives indicator (hearts), MCQ/True-False select options, Hint button, Skip button, and Exit button.
  * Rich Results card summarizing score percentage, correct/wrong details, earned badges, and detailed question review showing correct vs user answers along with educational explanations.

---

## 5. Python Chatbot Integration

The conversational quiz engine runs on a Python Flask/Sanic backend.

### 5.1 Intent Detection
The chatbot's intent model (`intent_classifier.py` / `production_intent_detector.py`) recognizes quiz-related prompts like "start quiz", "play quiz", "kids challenge", or category titles. It flags the intent as `quiz` and returns the metadata.

### 5.2 Session Game Loop (`museum_assistant.py`)
* When the user requests a quiz, the session flags `quiz_state` as active.
* **Flow:**
  1. Chatbot greets the visitor and responds with a list of categories using the `quiz_categories` action. The client renders buttons for: `Dinosaur`, `Ancient India`, `Space`, `Paintings`, `Wildlife`, and `Science`.
  2. Clicking a category fires its ID. The Python engine fetches questions from Firestore, initializes the session state, and replies with Question 1.
  3. The question is formatted to render with MCQ buttons (A, B, C, D) and action buttons: `💡 Hint`, `Skip`, and `End Quiz`.
  4. The engine validates the answers, replies with immediate feedback ("Correct! 🎉" or "Oops! 😢 The correct answer was..."), updates points, and proceeds to the next question.
  5. On completion, it calculates the percentage, assigns badges, records the score in Firestore, removes the session state, and sends the final score card components.

### 5.3 Chatbot UI (`BookingWithChatBot.tsx`)
* Includes a primary **"Play Quiz"** button in the chatbot header alongside booking shortcuts. Clicking it opens a beautiful glassmorphic modal overlay containing the fully functional interactive quiz console directly inside the chatbot page, enabling users to play the identical rich game (with categories, timer, lives, recommendations, badges, and database logging) without leaving the chat conversation.
* Renders custom components based on the message's `quizAction` metadata (if triggered via chatbot text intents):
  * `ChatbotQuizCategories`: Renders stylized category selection buttons.
  * MCQ Option Buttons: Renders letter choices (A, B, C, D) alongside hints and skip options.
  * `ChatbotQuizResult`: Displays a trophy, percentage score, description, and unlocked badges in a sleek dark-card block.

---

## 6. Admin Panel Dashboard

Admin users can manage the entire quiz system from `/admin#quiz`.
* Integrated into the main admin sidebar (`client/src/components/ui/admin-sidebar.tsx`).
* Renders the `QuizAdminManager` component which utilizes secure REST API routes for:
  * **Categories:** Add, edit, or delete quiz categories.
  * **Questions:** Add new multiple-choice questions, associate them with categories, set hints, point values, correct answers, and educational explanations.
  * **Badges:** Create and modify achievement badges.
* Includes validation and safety features (e.g. confirming deletes, handling upload states).

---

## 7. Home Page & Navigation Integration

* **Header Navbar (`header-2.tsx`)**: Reconstructed and repaired to prevent typescript errors. To keep the design clean and prevent desktop overlaps with right-aligned elements like the Language Selector, the navbar link was removed from the primary header menu; users navigate to the quiz via the homepage banner and chatbot buttons.
* **Home Page Content (`page.tsx`)**: Renders `QuizHomeBanner` at the lower-middle section. The banner features glow backdrops, an overview of dinosaur, space, and history quizzes, and a direct button **"Start Playing Now"** linking to the `/quiz` dashboard.

