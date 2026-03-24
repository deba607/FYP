'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '../../lib/utils';
import { Badge } from '../../components/ui/badge';
import { MinusIcon, PlusIcon } from 'lucide-react';

interface FaqItem {
  id: string;
  question: string;
  answer: string;
  category: 'general' | 'pricing' | 'technical' | 'support';
}

const faqItems: FaqItem[] = [
  {
    id: '1',
    question: 'What is the AI-Powered Multilingual Chatbot?',
    answer:
      'Our AI-driven chatbot serves as the primary communication interface, assisting visitors in multiple languages with inquiries about museum details, ticket pricing, schedules, and services. It provides real-time responses, guides users through the booking process, and ensures inclusivity for international visitors.',
    category: 'general',
  },
  {
    id: '2',
    question: 'How does the Automated Ticketing & Payment System work?',
    answer:
      'The system automates the entire ticket booking workflow including user login/signup, museum search, ticket booking request, real-time availability verification, secure online payment, and automatic ticket generation. This minimizes manual effort, reduces errors, and provides instant confirmation through digital tickets.',
    category: 'technical',
  },
  {
    id: '3',
    question: 'What smart features enhance the visitor experience?',
    answer:
      'We offer virtual guides and video-based museum tours, personalized recommendations based on visitor preferences, and accessibility options for visually impaired visitors including voice guidance and audio responses to promote inclusivity and independent access.',
    category: 'general',
  },
  {
    id: '4',
    question: 'How does real-time crowd management work?',
    answer:
      'The system collects and analyzes visitor data to monitor crowd density and peak visiting hours. Real-time analytics help museums manage visitor flow, improve safety, and optimize staffing and scheduling decisions for better resource allocation.',
    category: 'technical',
  },
  {
    id: '5',
    question: 'Is my payment information secure?',
    answer:
      'Absolutely! The system emphasizes secure transactions with encrypted payment processing, reliable cloud hosting infrastructure, and seamless integration with existing museum databases. We ensure error-free automated workflows for data protection and uninterrupted service.',
    category: 'pricing',
  },
  {
    id: '6',
    question: 'What accessibility features are available?',
    answer:
      'Our platform includes voice guidance, audio responses, and screen-reader-friendly interfaces designed specifically for visually impaired visitors. These features promote inclusivity and enable independent access to all museum services.',
    category: 'support',
  },
  {
    id: '7',
    question: 'How does the system reduce operational costs?',
    answer:
      'By minimizing manual labor, eliminating paper-based ticketing, and reducing energy usage, the system significantly lowers operational costs while promoting eco-friendly, paperless operations for sustainable museum management.',
    category: 'pricing',
  },
  {
    id: '8',
    question: 'Can I get personalized recommendations?',
    answer:
      'Yes! The system analyzes your preferences and past interactions to provide customized recommendations, exhibition highlights, and visit suggestions tailored to your interests for a more engaging museum experience.',
    category: 'general',
  },
];

const categories = [
  { id: 'all', label: 'All' },
  { id: 'general', label: 'General' },
  { id: 'technical', label: 'Technical' },
  { id: 'pricing', label: 'Pricing' },
  { id: 'support', label: 'Support' },
];

export default function Faq2() {
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const filteredFaqs =
    activeCategory === 'all'
      ? faqItems
      : faqItems.filter((item) => item.category === activeCategory);

  const toggleExpand = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
  };

  return (
    <section className="bg-background py-16">
      <div className="container mx-auto max-w-6xl px-4 md:px-6">
        <div className="mb-12 flex flex-col items-center">
          <Badge
            variant="outline"
            className="border-primary mb-4 px-3 py-1 text-xs font-medium tracking-wider uppercase"
          >
            FAQs
          </Badge>

          <h2 className="text-foreground mb-6 text-center text-4xl font-bold tracking-tight md:text-5xl">
            Frequently Asked Questions
          </h2>

          <p className="text-muted-foreground max-w-2xl text-center">
            Find answers to common questions about Bharat Museum's intelligent
            ticketing system and visitor services.
          </p>
        </div>

        {/* Category Tabs */}
        <div className="mb-10 flex flex-wrap justify-center gap-2">
          {categories.map((category) => (
            <button
              key={category.id}
              onClick={() => setActiveCategory(category.id)}
              className={cn(
                'rounded-full px-4 py-2 text-sm font-medium transition-all',
                activeCategory === category.id
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
              )}
            >
              {category.label}
            </button>
          ))}
        </div>

        {/* FAQ Grid */}
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <AnimatePresence>
            {filteredFaqs.map((faq, index) => (
              <motion.div
                key={faq.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3, delay: index * 0.05 }}
                className={cn(
                  'border-border h-fit overflow-hidden rounded-xl border',
                  expandedId === faq.id
                    ? 'shadow-3xl bg-card/50'
                    : 'bg-card/50',
                )}
                style={{ minHeight: '88px' }}
              >
                <button
                  onClick={() => toggleExpand(faq.id)}
                  className="flex w-full items-center justify-between p-6 text-left"
                >
                  <h3 className="text-foreground text-lg font-medium">
                    {faq.question}
                  </h3>
                  <div className="ml-4 flex-shrink-0">
                    {expandedId === faq.id ? (
                      <MinusIcon className="text-primary h-5 w-5" />
                    ) : (
                      <PlusIcon className="text-primary h-5 w-5" />
                    )}
                  </div>
                </button>

                <AnimatePresence>
                  {expandedId === faq.id && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.3 }}
                      className="overflow-hidden"
                    >
                      <div className="border-border border-t px-6 pt-2 pb-6">
                        <p className="text-muted-foreground">{faq.answer}</p>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        {/* Contact CTA */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.5 }}
          className="mt-16 text-center"
        >
          <p className="text-muted-foreground mb-4">
            Can&apos;t find what you&apos;re looking for?
          </p>
          <a
            href="#"
            className="border-primary text-foreground hover:bg-primary hover:text-primary-foreground inline-flex items-center justify-center rounded-lg border-2 px-6 py-3 font-medium transition-colors"
          >
            Contact Support
          </a>
        </motion.div>
      </div>
    </section>
  );
}
