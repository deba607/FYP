import { getFirebaseFirestore } from '../config/firebaseAdmin';

let quizSeedPromise: Promise<boolean> | null = null;

export function ensureQuizData() {
  if (!quizSeedPromise) {
    quizSeedPromise = seedQuizData().then((seeded) => {
      if (!seeded) quizSeedPromise = null;
      return seeded;
    });
  }
  return quizSeedPromise;
}

export async function seedQuizData() {
  const db = getFirebaseFirestore();

  try {
    // 1. Seed Badges
    const badgesRef = db.collection('quizBadges');
    const badgesSnap = await badgesRef.limit(1).get();
    if (badgesSnap.empty) {
      console.log('Seeding quiz badges...');
      const badges = [
        { id: 'explorer', title: 'Museum Explorer', description: 'Unlock your journey by completing your first quiz!', image: '🧭', minimumScore: 50 },
        { id: 'dino_expert', title: 'Dinosaur Expert', description: 'Score 80% or higher in the Dinosaur Quiz!', image: '🦖', minimumScore: 80 },
        { id: 'history_master', title: 'History Master', description: 'Score 80% or higher in the Ancient India or Museum History Quiz!', image: '🏺', minimumScore: 80 },
        { id: 'science_genius', title: 'Science Genius', description: 'Score 80% or higher in the Science or Space Quiz!', image: '🚀', minimumScore: 80 },
        { id: 'quiz_champion', title: 'Quiz Champion', description: 'Achieve a perfect 100% score on any quiz!', image: '🏆', minimumScore: 100 },
      ];

      await Promise.all(badges.map((badge) => badgesRef.doc(badge.id).set(badge)));
      console.log('Seeded quiz badges.');
    }

    // 2. Seed Categories
    const categoriesRef = db.collection('quizCategories');
    const categoriesSnap = await categoriesRef.limit(1).get();
    if (categoriesSnap.empty) {
      console.log('Seeding quiz categories...');
      const categories = [
        {
          id: 'dinosaur',
          name: 'Dinosaur Quiz',
          icon: '🦖',
          description: 'Roar back in time! Explore the world of T-Rex and giant prehistoric reptiles.',
          color: 'from-emerald-400 to-green-600',
          difficulty: 'Easy',
          ageGroup: 'Kids'
        },
        {
          id: 'ancient-india',
          name: 'Ancient India',
          icon: '🏺',
          description: 'Step into the past! Discover the Harappan Civilization, ancient empires, and golden kings.',
          color: 'from-amber-400 to-orange-600',
          difficulty: 'Medium',
          ageGroup: 'Teens'
        },
        {
          id: 'space',
          name: 'Space Gallery',
          icon: '🚀',
          description: 'Blast off! Journey through planets, stars, galaxies, and rocket science.',
          color: 'from-blue-500 to-indigo-700',
          difficulty: 'Medium',
          ageGroup: 'All'
        },
        {
          id: 'paintings',
          name: 'Famous Paintings',
          icon: '🎨',
          description: 'Get creative! Guess the artists and stories behind legendary paintings.',
          color: 'from-purple-500 to-pink-500',
          difficulty: 'Easy',
          ageGroup: 'Kids'
        },
        {
          id: 'wildlife',
          name: 'Wildlife Explorer',
          icon: '🦁',
          description: 'Wild adventures! Learn about jungle animals, deep-sea creatures, and conservation.',
          color: 'from-orange-400 to-yellow-500',
          difficulty: 'Easy',
          ageGroup: 'Kids'
        },
        {
          id: 'science',
          name: 'Science Museum',
          icon: '🔬',
          description: 'Solve mysteries! Play with experiments, laws of motion, and cool inventions.',
          color: 'from-cyan-400 to-teal-600',
          difficulty: 'Hard',
          ageGroup: 'Teens'
        }
      ];

      const createdAt = new Date().toISOString();
      await Promise.all(categories.map((category) => categoriesRef.doc(category.id).set({
        ...category,
        createdAt
      })));
      console.log('Seeded quiz categories.');
    }

    // 3. Seed Questions
    const questionsRef = db.collection('quizQuestions');
    const starterMarkerRef = db.collection('_system').doc('quiz-starter-data-v1');
    const starterMarker = await starterMarkerRef.get();
    if (!starterMarker.exists) {
      console.log('Seeding quiz questions...');
      const questions = [
        // --- DINOSAURS (Easy, 10 points) ---
        {
          id: 'dino_q1',
          category_id: 'dinosaur',
          question: 'Which dinosaur was one of the largest land animals to ever live?',
          options: ['Velociraptor', 'Triceratops', 'Argentinosaurus', 'Stegosaurus'],
          correctAnswer: 'Argentinosaurus',
          explanation: 'Argentinosaurus was a giant long-necked sauropod estimated to weigh up to 100 tons (about 15-20 elephants!).',
          difficulty: 'Easy',
          points: 10,
          type: 'multiple-choice'
        },
        {
          id: 'dino_q2',
          category_id: 'dinosaur',
          question: 'What does the word "Dinosaur" mean in ancient Greek?',
          options: ['Friendly giant', 'Terrible lizard', 'Flying bird', 'Old fossil'],
          correctAnswer: 'Terrible lizard',
          explanation: 'Coined in 1842 by Richard Owen, it comes from "deinos" (terrible/fearfully great) and "sauros" (lizard).',
          difficulty: 'Easy',
          points: 10,
          type: 'multiple-choice'
        },
        {
          id: 'dino_q3',
          category_id: 'dinosaur',
          question: 'Triceratops had three horns on its face for defense.',
          options: ['True', 'False'],
          correctAnswer: 'True',
          explanation: 'Triceratops had two long brow horns and one short snout horn to defend against predators like T-Rex.',
          difficulty: 'Easy',
          points: 10,
          type: 'true-false'
        },
        {
          id: 'dino_q4',
          category_id: 'dinosaur',
          question: 'Which dinosaur is famous for its rows of flat plates on its back and spiked tail?',
          options: ['Stegosaurus', 'Tyrannosaurus Rex', 'Ankylosaurus', 'Brachiosaurus'],
          correctAnswer: 'Stegosaurus',
          explanation: 'The bony plates of Stegosaurus were used for temperature regulation or display, and its spikes (thagomizer) for defense.',
          difficulty: 'Easy',
          points: 10,
          type: 'multiple-choice'
        },
        {
          id: 'dino_q5',
          category_id: 'dinosaur',
          question: 'Most scientists agree that modern birds are actually living dinosaurs.',
          options: ['True', 'False'],
          correctAnswer: 'True',
          explanation: 'Birds are avian dinosaurs, specifically descendants of small, feathered theropods.',
          difficulty: 'Easy',
          points: 10,
          type: 'true-false'
        },

        // --- ANCIENT INDIA (Medium, 15 points) ---
        {
          id: 'india_q1',
          category_id: 'ancient-india',
          question: 'Which ancient civilization was famous for its planned brick cities, drainage systems, and public baths?',
          options: ['Mesopotamian', 'Indus Valley (Harappan)', 'Egyptian', 'Roman'],
          correctAnswer: 'Indus Valley (Harappan)',
          explanation: 'Flourishing around 2500 BCE, Indus Valley cities like Harappa and Mohenjo-daro had advanced grid layouts and sanitation.',
          difficulty: 'Medium',
          points: 15,
          type: 'multiple-choice'
        },
        {
          id: 'india_q2',
          category_id: 'ancient-india',
          question: 'Who was the famous emperor who embraced Buddhism and set up rock pillars carrying messages of peace (Dhamma) across India?',
          options: ['Chandragupta Maurya', 'Samudragupta', 'Harsha', 'Ashoka the Great'],
          correctAnswer: 'Ashoka the Great',
          explanation: 'After the Kalinga War, Emperor Ashoka renounced violence and spread Buddhism, carving pillars that inspire Indias National Emblem.',
          difficulty: 'Medium',
          points: 15,
          type: 'multiple-choice'
        },
        {
          id: 'india_q3',
          category_id: 'ancient-india',
          question: 'The zero and the decimal system were invented in ancient India.',
          options: ['True', 'False'],
          correctAnswer: 'True',
          explanation: 'Ancient Indian mathematicians, including Aryabhata, formulated zero as a number and revolutionized the decimal system.',
          difficulty: 'Medium',
          points: 15,
          type: 'true-false'
        },
        {
          id: 'india_q4',
          category_id: 'ancient-india',
          question: 'Which classical language of India was used to write ancient epics like the Ramayana and Mahabharata?',
          options: ['Tamil', 'Pali', 'Sanskrit', 'Prakrit'],
          correctAnswer: 'Sanskrit',
          explanation: 'Sanskrit is the sacred classical language of India, in which the Vedas, Upanishads, and major epics were composed.',
          difficulty: 'Medium',
          points: 15,
          type: 'multiple-choice'
        },
        {
          id: 'india_q5',
          category_id: 'ancient-india',
          question: 'Ancient Indian universities like Nalanda attracted students from all over Asia, including China and Tibet.',
          options: ['True', 'False'],
          correctAnswer: 'True',
          explanation: 'Nalanda was a world-famous Buddhist monastery and university in Bihar that operated from the 5th century CE to 1200 CE.',
          difficulty: 'Medium',
          points: 15,
          type: 'true-false'
        },

        // --- SPACE GALLERY (Medium, 15 points) ---
        {
          id: 'space_q1',
          category_id: 'space',
          question: 'Which is the hottest planet in our solar system, covered in thick clouds that trap heat?',
          options: ['Mercury', 'Venus', 'Mars', 'Jupiter'],
          correctAnswer: 'Venus',
          explanation: 'Although Mercury is closer to the Sun, Venus has a dense greenhouse atmosphere that makes it the hottest planet (~475°C).',
          difficulty: 'Medium',
          points: 15,
          type: 'multiple-choice'
        },
        {
          id: 'space_q2',
          category_id: 'space',
          question: 'What is the name of the galaxy that holds our solar system?',
          options: ['Andromeda', 'Milky Way', 'Sombrero Galaxy', 'Triangulum'],
          correctAnswer: 'Milky Way',
          explanation: 'Our solar system lies in one of the spiral arms of the Milky Way galaxy, containing billions of stars.',
          difficulty: 'Medium',
          points: 15,
          type: 'multiple-choice'
        },
        {
          id: 'space_q3',
          category_id: 'space',
          question: 'Human astronauts have successfully landed on Mars.',
          options: ['True', 'False'],
          correctAnswer: 'False',
          explanation: 'Only robotic rovers and landers have reached Mars so far. Human landings are planned for the future.',
          difficulty: 'Medium',
          points: 15,
          type: 'true-false'
        },
        {
          id: 'space_q4',
          category_id: 'space',
          question: 'Which planet is famous for its beautiful, giant rings made of ice and rock?',
          options: ['Uranus', 'Jupiter', 'Saturn', 'Neptune'],
          correctAnswer: 'Saturn',
          explanation: 'Saturn has the most extensive and visible ring system, composed of countless ice, dust, and rock particles.',
          difficulty: 'Medium',
          points: 15,
          type: 'multiple-choice'
        },
        {
          id: 'space_q5',
          category_id: 'space',
          question: 'The Sun is actually a giant star made of hot, glowing gases.',
          options: ['True', 'False'],
          correctAnswer: 'True',
          explanation: 'The Sun is a medium-sized yellow dwarf star made mostly of hydrogen and helium undergoing nuclear fusion.',
          difficulty: 'Medium',
          points: 15,
          type: 'true-false'
        },

        // --- PAINTINGS (Easy, 10 points) ---
        {
          id: 'art_q1',
          category_id: 'paintings',
          question: 'Who painted the famous and mysterious portrait known as the Mona Lisa?',
          options: ['Vincent van Gogh', 'Leonardo da Vinci', 'Pablo Picasso', 'Michelangelo'],
          correctAnswer: 'Leonardo da Vinci',
          explanation: 'The Mona Lisa was painted by Italian polymath Leonardo da Vinci in the early 16th century and hangs in the Louvre.',
          difficulty: 'Easy',
          points: 10,
          type: 'multiple-choice'
        },
        {
          id: 'art_q2',
          category_id: 'paintings',
          question: 'Which Dutch artist painted "The Starry Night" showing a swirling blue night sky from his room window?',
          options: ['Vincent van Gogh', 'Rembrandt', 'Claude Monet', 'Salvador Dali'],
          correctAnswer: 'Vincent van Gogh',
          explanation: 'Vincent van Gogh painted The Starry Night in 1889 during his stay at the asylum in Saint-Rémy-de-Provence.',
          difficulty: 'Easy',
          points: 10,
          type: 'multiple-choice'
        },
        {
          id: 'art_q3',
          category_id: 'paintings',
          question: 'Leonardo da Vincis "The Last Supper" is painted on a wall rather than a canvas.',
          options: ['True', 'False'],
          correctAnswer: 'True',
          explanation: 'It is a large mural painted directly on the wall of the convent of Santa Maria delle Grazie in Milan, Italy.',
          difficulty: 'Easy',
          points: 10,
          type: 'true-false'
        },
        {
          id: 'art_q4',
          category_id: 'paintings',
          question: 'Which painting style uses tiny dots of pure color that blend together in the viewer\'s eye?',
          options: ['Cubism', 'Surrealism', 'Pointillism', 'Abstract Art'],
          correctAnswer: 'Pointillism',
          explanation: 'Pointillism was developed by Georges Seurat and Paul Signac in 1886, using dots to create vibrant painted landscapes.',
          difficulty: 'Easy',
          points: 10,
          type: 'multiple-choice'
        },
        {
          id: 'art_q5',
          category_id: 'paintings',
          question: 'Vincent van Gogh sold hundreds of paintings during his lifetime and was very wealthy.',
          options: ['True', 'False'],
          correctAnswer: 'False',
          explanation: 'Van Gogh was poor and largely unrecognized during his life, selling only one known painting. He became famous after his death.',
          difficulty: 'Easy',
          points: 10,
          type: 'true-false'
        },

        // --- WILDLIFE EXPLORER (Easy, 10 points) ---
        {
          id: 'wild_q1',
          category_id: 'wildlife',
          question: 'What is the largest animal currently living on Earth?',
          options: ['African Elephant', 'Blue Whale', 'Colossal Squid', 'Giraffe'],
          correctAnswer: 'Blue Whale',
          explanation: 'The Blue Whale is the largest animal ever known, growing up to 30 meters long and weighing up to 190 tons.',
          difficulty: 'Easy',
          points: 10,
          type: 'multiple-choice'
        },
        {
          id: 'wild_q2',
          category_id: 'wildlife',
          question: 'Which is the only mammal capable of true, sustained flight?',
          options: ['Flying Squirrel', 'Bat', 'Sugar Glider', 'Eagle'],
          correctAnswer: 'Bat',
          explanation: 'Bats are mammals whose front limbs are adapted as wings, making them the only mammals that can truly fly.',
          difficulty: 'Easy',
          points: 10,
          type: 'multiple-choice'
        },
        {
          id: 'wild_q3',
          category_id: 'wildlife',
          question: 'Chameleons change color only to blend into their surroundings.',
          options: ['True', 'False'],
          correctAnswer: 'False',
          explanation: 'Chameleons change color mainly to regulate temperature, communicate emotions, and signal status to other chameleons.',
          difficulty: 'Easy',
          points: 10,
          type: 'true-false'
        },
        {
          id: 'wild_q4',
          category_id: 'wildlife',
          question: 'What is the fastest land animal, capable of reaching speeds over 100 km/h?',
          options: ['Lion', 'Cheetah', 'Gazelle', 'Pronghorn'],
          correctAnswer: 'Cheetah',
          explanation: 'The Cheetah can accelerate from 0 to 95 km/h in just 3 seconds, making it the absolute fastest runner in the wild.',
          difficulty: 'Easy',
          points: 10,
          type: 'multiple-choice'
        },
        {
          id: 'wild_q5',
          category_id: 'wildlife',
          question: 'A group of lions is called a pack.',
          options: ['True', 'False'],
          correctAnswer: 'False',
          explanation: 'A family group of lions is called a Pride, whereas wolves run in packs.',
          difficulty: 'Easy',
          points: 10,
          type: 'true-false'
        },

        // --- SCIENCE MUSEUM (Hard, 20 points) ---
        {
          id: 'sci_q1',
          category_id: 'science',
          question: 'Which scientist formulated the Three Laws of Motion and the Universal Law of Gravitation?',
          options: ['Albert Einstein', 'Galileo Galilei', 'Sir Isaac Newton', 'Nikola Tesla'],
          correctAnswer: 'Sir Isaac Newton',
          explanation: 'Newton published his Principia Mathematica in 1687, laying the foundations of classical mechanics and gravitational forces.',
          difficulty: 'Hard',
          points: 20,
          type: 'multiple-choice'
        },
        {
          id: 'sci_q2',
          category_id: 'science',
          question: 'What is the basic building block of all chemical elements, consisting of protons, neutrons, and electrons?',
          options: ['Molecule', 'Atom', 'Cell', 'Quark'],
          correctAnswer: 'Atom',
          explanation: 'An atom is the smallest unit of matter, with a dense central nucleus surrounded by a cloud of negative electrons.',
          difficulty: 'Hard',
          points: 20,
          type: 'multiple-choice'
        },
        {
          id: 'sci_q3',
          category_id: 'science',
          question: 'Sound waves travel faster through water than they do through air.',
          options: ['True', 'False'],
          correctAnswer: 'True',
          explanation: 'Because water is denser and more elastic than air, sound vibrations can travel about 4 times faster in water.',
          difficulty: 'Hard',
          points: 20,
          type: 'true-false'
        },
        {
          id: 'sci_q4',
          category_id: 'science',
          question: 'What process do green plants use to convert sunlight into food energy, releasing oxygen as a byproduct?',
          options: ['Respiration', 'Fermentation', 'Photosynthesis', 'Transpiration'],
          correctAnswer: 'Photosynthesis',
          explanation: 'Plants capture light energy via chlorophyll to convert carbon dioxide and water into glucose sugars and oxygen.',
          difficulty: 'Hard',
          points: 20,
          type: 'multiple-choice'
        },
        {
          id: 'sci_q5',
          category_id: 'science',
          question: 'According to Einsteins Special Relativity, nothing in the universe can travel faster than the speed of light in a vacuum.',
          options: ['True', 'False'],
          correctAnswer: 'True',
          explanation: 'The speed of light (c = 299,792,458 m/s) is the absolute cosmic speed limit for mass and information.',
          difficulty: 'Hard',
          points: 20,
          type: 'true-false'
        }
      ];

      const createdAt = new Date().toISOString();
      const questionRefs = questions.map((question) => questionsRef.doc(question.id));
      const existingQuestions = await db.getAll(...questionRefs);
      const batch = db.batch();
      existingQuestions.forEach((snapshot, index) => {
        if (!snapshot.exists) {
          batch.set(questionRefs[index], {
            ...questions[index],
            status: 'active',
            createdAt,
            updatedAt: createdAt
          });
        }
      });
      batch.set(starterMarkerRef, { version: 1, seededAt: createdAt });
      await batch.commit();
      console.log('Seeded quiz questions.');
    }

    console.log('Quiz data seeding complete.');
    return true;
  } catch (error) {
    console.error('Failed to seed quiz data:', error);
    return false;
  }
}
