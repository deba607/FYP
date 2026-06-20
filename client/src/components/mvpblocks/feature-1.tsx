"use client";

import {
  Globe,
  Smartphone,
  Ticket,
  UserCircle,
  MessageCircle,
  Users,
  BarChart3,
  Navigation,
  Accessibility,
  MessageSquare,
  Puzzle,
  Video,
} from 'lucide-react';
import Link from 'next/link';

const features = [
  {
    icon: <Globe className="h-6 w-6" />,
    title: 'Multilingual Support',
    desc: 'Interact comfortably in multiple languages. Our chatbot understands and responds in various languages for better accessibility and inclusivity.',
  },
  {
    icon: <Smartphone className="h-6 w-6" />,
    title: 'Omnichannel Access',
    desc: 'Access museum services through web platforms, mobile devices, and chat interfaces, ensuring seamless availability across different channels.',
  },
  {
    icon: <Ticket className="h-6 w-6" />,
    title: 'Automated Ticketing & Payment',
    desc: 'Check availability, book tickets, and complete secure online payments without manual intervention, reducing queues and errors.',
  },
  {
    icon: <UserCircle className="h-6 w-6" />,
    title: 'Personalized Experience',
    desc: 'Get customized recommendations, exhibition highlights, and visit suggestions based on your preferences and past interactions.',
  },
  {
    icon: <MessageCircle className="h-6 w-6" />,
    title: 'Real-Time Assistance',
    desc: 'AI-powered chatbot delivers instant responses to visitor queries related to tickets, exhibits, navigation, and schedules.',
  },
  {
    icon: <Users className="h-6 w-6" />,
    title: 'Crowd Management Insights',
    desc: 'IoT sensors and real-time data processing monitor visitor flow, identify congestion areas, and support safety optimization.',
  },
  {
    icon: <BarChart3 className="h-6 w-6" />,
    title: 'Data Analytics',
    desc: 'Analyze data from chatbot interactions, bookings, payments, and sensors to help administrators make data-driven decisions.',
  },
  {
    icon: <Navigation className="h-6 w-6" />,
    title: 'Virtual Guide to the Museum',
    desc: 'Get step-by-step directions from your current location to the museum, helping you plan the easiest route for your visit.',
  },
  {
    icon: <Video className="h-6 w-6" />,
    title: 'Video Tours',
    desc: 'Explore exhibits digitally with virtual guides and video museum tours, enabling remote access to museum content.',
  },
  {
    icon: <Accessibility className="h-6 w-6" />,
    title: 'Accessibility Features',
    desc: 'Voice guidance and screen-reader-friendly interfaces ensure inclusive access to museum services for visually impaired users.',
  },
  {
    icon: <MessageSquare className="h-6 w-6" />,
    title: 'Feedback System',
    desc: 'Share your experiences and suggestions to support continuous improvement of services and system performance.',
  },
  {
    icon: <Puzzle className="h-6 w-6" />,
    title: 'Interactive Quiz for Kids',
    desc: 'Engage young visitors with fun, age-appropriate questions about museum exhibits, history, science, and culture while they learn through play.',
  },
];
export default function Feature1() {
  return (
    <section className="relative py-14">
      <div className="mx-auto max-w-screen-xl px-4 md:px-8">
        <div className="relative mx-auto max-w-2xl sm:text-center">
          <div className="relative z-10">
            <h3 className="font-geist mt-4 text-3xl font-bold tracking-tighter sm:text-4xl md:text-5xl">
              Key Features of Bharat Museum
            </h3>
            <p className="font-geist text-foreground/60 mt-3">
              Discover our innovative features designed to enhance your museum experience with cutting-edge technology and personalized services.
            </p>
          </div>
          <div
            className="absolute inset-0 mx-auto h-44 max-w-xs blur-[118px]"
            style={{
              background:
                'linear-gradient(152.92deg, rgba(192, 15, 102, 0.2) 4.54%, rgba(192, 11, 109, 0.26) 34.2%, rgba(192, 15, 102, 0.1) 77.55%)',
            }}
          ></div>
        </div>
        <hr className="bg-foreground/30 mx-auto mt-5 h-px w-1/2" />
        <div className="relative mt-12">
          <ul className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((item, idx) => (
              <li
                key={idx}
                className="transform-gpu space-y-3 rounded-xl border bg-transparent p-4 [box-shadow:0_-20px_80px_-20px_#ff7aa42f_inset]"
              >
                <div className="text-primary w-fit transform-gpu rounded-full border p-4 [box-shadow:0_-20px_80px_-20px_#ff7aa43f_inset] dark:[box-shadow:0_-20px_80px_-20px_#ff7aa40f_inset]">
                  {item.icon}
                </div>
                <h4 className="font-geist text-lg font-bold tracking-tighter">
                  {item.title}
                </h4>
                <p className="text-gray-500">{item.desc}</p>
                {item.title === 'Personalized Experience' ? (
                  <Link href="/personalized" className="inline-flex text-sm font-semibold text-primary underline underline-offset-4">
                    Open your personalized dashboard
                  </Link>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
