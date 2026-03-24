'use client';

import { cn } from '../../lib/utils';
import { useState } from 'react';
import Image from 'next/image';

type TeamMember = {
  id: number;
  name: string;
  role: string;
  bio?: string;
  image: string;
  color?: string; // For the card background color
};

type PremiumTeamProps = {
  title?: string;
  subtitle?: string;
  teamMembers?: TeamMember[];
  backgroundColor?: string;
  textColor?: string;
  className?: string;
};

const dami_data: TeamMember[] = [
  {
    id: 1,
    name: 'Souvik Gon',
    role: 'Frontend & App Developer',
    bio: 'Passionate about creating seamless user experiences and building robust applications.',
    image: '/team/souvik.png',
  },
  {
    id: 2,
    name: 'Sulagna Ghosh',
    role: 'UI/UX Designer',
    bio: 'Expert in crafting intuitive designs that enhance user engagement and satisfaction.',
    image:
      '/team/sulagna.png',
  },
  {
    id: 3,
    name: 'Soumita Gupta',
    role: 'Backend Developer',
    bio: 'Passionate about building scalable backend systems and APIs.',
    image:
      '/team/soumita.png',
  },
  {
    id: 4,
    name: 'Debanjan Paul',
    role: 'Backend Developer',
    bio: 'Skilled in server-side development and database management.',
    image:
      '/team/debanjan.png',
  },
  {
    id: 5,
    name: 'Dipon Biswas',
    role: 'Frontend Developer',
    bio: 'Skilled in creating responsive and user-friendly web interfaces.',
    image:
      '/team/dipon.png',
  },
  
];

export default function Team9({
  title = 'Partnered with most of the',
  subtitle = 'top people at each industry',
  teamMembers = dami_data,
  backgroundColor = '',
  textColor = '#ffff',
  className,
}: PremiumTeamProps) {
  const [activeIndex, setActiveIndex] = useState<number | null>(1); // Default second card active

  // Function to handle mouse enter
  const handleMouseEnter = (index: number) => {
    setActiveIndex(index);
  };

  return (
    <section
      className={cn('w-full py-16', className)}
      style={{ backgroundColor, color: textColor }}
    >
      <div className="container mx-auto px-4">
        <div className="mb-16 text-center">
          <h2 className="mb-1 text-2xl font-medium">{title}</h2>
          <p className="text-xl font-light italic opacity-80">{subtitle}</p>
        </div>

        <div className="relative -mx-4 sm:-mx-0">
          <div className="overflow-hidden">
            <div className="flex gap-4 overflow-x-auto px-4 max-w-full snap-x snap-mandatory scroll-pl-4 sm:justify-center sm:overflow-visible sm:px-0">
          {teamMembers.slice(0, 5).map((member, index) => {
            const isActive = activeIndex === index;
            return (
              <div
                key={member.id}
                className="flex-none w-[14rem] sm:w-[16rem] h-72 sm:h-[360px] cursor-pointer overflow-hidden rounded-xl text-white transition-all duration-500 ease-in-out"
                style={{
                  backgroundColor: isActive
                    ? member.color || '#3F72AF'
                    : '#112D4E',
                }}
                role="button"
                onMouseEnter={() => handleMouseEnter(index)}
              >
                <div className="flex h-full w-full flex-col">
                  {/* Person image */}
                  <div
                    className={cn(
                      'relative transition-all duration-500 ease-in-out',
                      isActive ? 'h-3/5' : 'h-4/5',
                    )}
                  >
                    <Image
                      src={member.image || '/placeholder.svg'}
                      alt={member.name}
                      fill
                      sizes="(max-width: 640px) 14rem, 16rem"
                      className="h-full w-full object-cover object-top"
                    />
                  </div>

                  {/* Text content */}
                  <div
                    className={cn(
                      'flex flex-col p-4 transition-all duration-500 ease-in-out',
                      isActive ? 'h-3/5' : 'h-1/5',
                    )}
                  >
                    {isActive && member.bio && (
                      <div className="mb-2 line-clamp-3 overflow-hidden text-sm opacity-80 transition-opacity duration-500 ease-in-out">
                        {member.bio}
                      </div>
                    )}
                    <div className="mt-auto">
                      <h3 className="text-lg font-medium">{member.name}</h3>
                      <p className="text-sm opacity-70">{member.role}</p>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
