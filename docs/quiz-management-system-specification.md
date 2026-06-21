# Quiz Management System Specification

## Role and Project Context

Act as a Senior Full-Stack MERN Developer, Next.js Expert, Firebase Expert, and Software Architect.

The existing Museum Ticket Booking System uses:

- Next.js with the App Router
- React
- TypeScript
- Tailwind CSS
- Node.js
- Firebase Authentication
- Firebase Firestore
- Firebase Storage

An Admin Panel already exists. Implement a complete Quiz Management System inside the existing Admin Dashboard without modifying or breaking existing functionality.

The implementation must be modular, production-ready, responsive, and scalable.

## Objective

Administrators must be able to manage questions for the **Interactive Quiz for Kids** feature.

The system must allow administrators to:

- Create quiz categories
- Add questions
- Edit questions
- Delete questions
- Search questions
- Filter questions
- Enable or disable questions
- Upload question images
- Preview questions
- Bulk import and export questions

## Firestore Structure

### `quizCategories`

| Field | Description |
| --- | --- |
| `category_id` | Unique category identifier |
| `name` | Category name |
| `description` | Category description |
| `icon` | Category icon or emoji |
| `color` | Category theme color |
| `ageGroup` | Intended age group |
| `difficulty` | Default category difficulty |
| `createdAt` | Creation timestamp |

### `quizQuestions`

| Field | Description |
| --- | --- |
| `question_id` | Unique question identifier |
| `category_id` | Associated category identifier |
| `museum_id` | Optional associated museum identifier |
| `question` | Question text |
| `options` | Available answer options |
| `correctAnswer` | Correct answer |
| `explanation` | Educational answer explanation |
| `imageUrl` | Optional Firebase Storage image URL |
| `difficulty` | Easy, Medium, or Hard |
| `points` | Points awarded for a correct answer |
| `status` | Active or Inactive |
| `createdAt` | Creation timestamp |
| `updatedAt` | Last update timestamp |

## Admin Navigation

Add a **Quiz Management** menu to the Admin Sidebar with these entries:

- Dashboard
- Categories
- Questions
- Leaderboard
- Badges

## Questions Page

Create a page where administrators can see and manage all quiz questions.

### Displayed Columns

- Question
- Category
- Museum
- Difficulty
- Points
- Status
- Created Date
- Actions

### Available Actions

- Add Question
- Edit
- Delete
- View
- Duplicate
- Enable or Disable

## Add and Edit Question Form

The question form must contain:

- Question
- Category dropdown
- Optional museum dropdown
- Difficulty
  - Easy
  - Medium
  - Hard
- Points
- Question image upload
- Option A
- Option B
- Option C
- Option D
- Correct answer dropdown
- Explanation
- Status
  - Active
  - Inactive
- Save button
- Cancel button

## Supported Question Types

- Multiple Choice
- True/False
- Image Question
- Guess the Artifact
- Guess the Museum
- Guess the Painting

## Categories Page

Administrators must be able to:

- Create a category
- Edit a category
- Delete a category
- View the number of questions in each category

Example categories include:

- Museum History
- Ancient India
- Dinosaurs
- Science
- Space
- Paintings
- Wildlife
- Artifacts

## Validation Requirements

- A question cannot be empty.
- A question must contain at least two options.
- A correct answer must be selected.
- Duplicate questions must be prevented.
- Uploaded image type and size must be validated.

Validation must run on both the client and the server. Client-side validation is for usability; server-side validation is authoritative.

## Search

Allow administrators to search by:

- Question
- Museum
- Category
- Difficulty

## Filters

Provide filters for:

- Category
- Difficulty
- Status
- Museum

## Table Features

- Pagination
- Sorting
- Search
- Responsive layout
- Sticky header

## Image Upload

- Upload images to Firebase Storage.
- Store the resulting URL in Firestore.
- Allow image preview before saving.
- Allow an existing image to be replaced.
- Validate MIME type, file extension, and maximum file size.
- Remove or safely handle replaced and orphaned images.

## Import and Export

Support both:

- CSV
- JSON

Administrators must be able to:

- Bulk upload questions
- Preview and validate imports before committing them
- View row-level import errors
- Export all questions
- Export the currently filtered question set

## Delete Confirmation

Before deleting a question, display a confirmation dialog containing:

> Are you sure you want to delete this question?

The dialog must provide explicit Cancel and Delete actions.

## Quiz Dashboard

Create a quiz dashboard showing:

- Total Questions
- Active Questions
- Inactive Questions
- Total Categories
- Most Used Category
- Recent Questions

## Recommended Folder Structure

```text
admin/
└── quiz/
    ├── page.tsx
    ├── categories/
    │   └── page.tsx
    ├── questions/
    │   └── page.tsx
    └── components/
        ├── QuestionForm.tsx
        ├── QuestionTable.tsx
        ├── QuestionCard.tsx
        ├── CategoryForm.tsx
        ├── CategoryTable.tsx
        ├── QuizDashboard.tsx
        ├── ImageUploader.tsx
        └── DeleteDialog.tsx
```

Adapt this structure to the conventions of the existing repository while keeping the module isolated and reusable.

## Firebase Operations

Create secure, typed operations for:

- Add Question
- Update Question
- Delete Question
- Get Question
- Get Questions
- Search Questions
- Upload Image
- Get Categories

All operations must include validation, consistent error handling, and appropriate authorization checks.

## User Interface Requirements

- Use the existing Admin Dashboard theme.
- Provide a responsive layout.
- Use modern cards, tables, and dialogs.
- Provide success and error toast notifications.
- Include loading skeletons and empty states.
- Support dark mode.
- Preserve keyboard navigation and accessible labels.

## Security Requirements

Only authenticated administrators may:

- Add questions or categories
- Edit questions or categories
- Delete questions or categories
- Enable or disable questions
- Upload or replace images
- Import questions
- Export questions

Enforce authorization on the server and through Firebase Security Rules. Do not rely solely on hidden UI controls. Validate and sanitize all Firestore writes and uploaded files.

## Required Deliverables

Generate complete, production-ready code including:

1. Firestore schema
2. Firestore CRUD functions
3. React components
4. Next.js pages
5. Firebase Storage upload logic
6. Form validation
7. Search
8. Filters
9. Pagination
10. Image upload
11. Import and export
12. Responsive UI
13. TypeScript types
14. Error handling
15. Loading states
16. Success and error toast notifications

## Acceptance Criteria

- The Quiz Management module integrates seamlessly with the existing Admin Panel.
- Existing museum booking, authentication, payment, chatbot, and dashboard functionality continues to work.
- All privileged actions are protected by authenticated administrator authorization.
- CRUD, search, filtering, pagination, uploads, and import/export work on desktop and mobile layouts.
- Errors are actionable and do not leave the interface in an inconsistent state.
- The implementation is type-safe, modular, maintainable, and suitable for production deployment.
