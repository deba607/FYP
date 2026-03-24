"use client";

import Autoplay from "embla-carousel-autoplay";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useState } from "react";
import Image from "next/image";

import { cn } from "../../../lib/utils";

import {
  Carousel,
  type CarouselApi,
  CarouselContent,
  CarouselItem,
} from "../carousel";

const Skiper54 = () => {
  const filenames = [
    "img 1.jpg",
    "img 10.jfif",
    "img 11.jfif",
    "img 12.jpg",
    "img 13.jpg",
    "img 14.jpg",
    "img 15.jfif",
    "img 16.jfif",
    "img 17.avif",
    "img 18.jfif",
    "img 19.jpg",
    "img 2.jpg",
    "img 20.jfif",
    "img 21.jpg",
    "img 22.webp",
    "img 23.jpg",
    "img 24.webp",
    "img 25.jpg",
    "img 26.jpg",
    "img 27.jpg",
    "img 28.jpg",
    "img 3.jpg",
    "img 4.jpg",
    "img 5.jpg",
    "img 6.webp",
    "img 7.jpg",
    "img 8.jfif",
    "img 9.webp",
  ];

  const images = filenames.map((file) => {
    const name = file.replace(/\.[^/.]+$/, "");
    return {
      src: `/images/${encodeURIComponent(file)}`,
      alt: name,
      title: name,
    };
  });
  return (
    <div className="flex h-full w-full max-w-full items-center justify-center overflow-hidden bg-white dark:bg-black py-8">
      <Carousel_006
        images={images}
        className="max-w-9xl"
        loop={true}
        autoplay={true}
        showNavigation={true}
        showPagination={true}
      />
    </div>
  );
};

interface Carousel_006Props {
  images: { src: string; alt: string; title: string }[];
  className?: string;
  autoplay?: boolean;
  loop?: boolean;
  showNavigation?: boolean;
  showPagination?: boolean;
}

const Carousel_006 = ({
  images,
  className,
  autoplay = false,
  loop = true,
  showNavigation = true,
  showPagination = true,
}: Carousel_006Props) => {
  const [api, setApi] = useState<CarouselApi>();
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    if (!api) return;

    api.on("select", () => {
      setCurrent(api.selectedScrollSnap());
    });
  }, [api]);

  return (
     
    <Carousel
      setApi={setApi}
      className={cn("w-full max-w-full relative", className)}
      opts={{
        loop,
        slidesToScroll: 1,
        align: "center",
      }}
      plugins={
        autoplay
          ? [
              Autoplay({
                delay: 2000,
                stopOnInteraction: false,
                stopOnMouseEnter: false,
              }),
            ]
          : []
      }
    >
      <CarouselContent className="flex h-[550px]">
        {images.map((img, index) => (
          <CarouselItem
            key={index}
            className="relative flex h-[81.5%] items-center justify-center basis-[80%] sm:basis-[45%] md:basis-[30%] lg:basis-[22%]"
          >
            <motion.div
              initial={false}
              animate={{
                clipPath:
                  current !== index
                    ? "inset(15% 0 15% 0 round 2rem)"
                    : "inset(0 0 0 0 round 2rem)",
              }}
              className="h-full w-full overflow-hidden rounded-3xl"
            >
              <div className="relative h-full w-full border">
                <Image
                  src={img.src}
                  alt={img.alt}
                  fill
                  sizes="(max-width: 640px) 80vw, (max-width: 768px) 45vw, (max-width: 1024px) 30vw, 22vw"
                  className="h-full w-full scale-105 object-cover"
                />
              </div>
            </motion.div>
            <AnimatePresence mode="wait">
              {current === index && (
                <motion.div
                  initial={{ opacity: 0, filter: "blur(10px)" }}
                  animate={{ opacity: 1, filter: "blur(0px)" }}
                  transition={{ duration: 0.5 }}
                  className="absolute bottom-0 left-2 flex h-[14%] w-full translate-y-full items-center justify-center p-2 text-center font-medium tracking-tight text-black/20 dark:text-white/30"
                >
                  {/* {img.title} */}
                </motion.div>
              )}
            </AnimatePresence>
          </CarouselItem>
        ))}
      </CarouselContent>

      {showNavigation && (
        <div className="absolute bottom-1/2 translate-y-1/2 left-0 right-0 flex items-center justify-between px-2 pointer-events-none">
          <button
            aria-label="Previous slide"
            onClick={() => api?.scrollPrev()}
            className="rounded-full bg-black/50 p-3 pointer-events-auto hover:bg-black/70 transition-colors"
          >
            <ChevronLeft className="text-white h-5 w-5" />
          </button>
          <button
            aria-label="Next slide"
            onClick={() => api?.scrollNext()}
            className="rounded-full bg-black/50 p-3 pointer-events-auto hover:bg-black/70 transition-colors"
          >
            <ChevronRight className="text-white h-5 w-5" />
          </button>
        </div>
      )}

      {showPagination && (
        <div className="flex w-full items-center justify-center">
          <div className="flex items-center justify-center gap-2">
            {Array.from({ length: images.length }).map((_, index) => (
              <button
                key={index}
                onClick={() => api?.scrollTo(index)}
                className={cn(
                  "h-2 w-2 cursor-pointer rounded-full transition-all",
                  current === index ? "bg-black dark:bg-white" : "bg-[#D9D9D9] dark:bg-gray-700",
                )}
                aria-label={`Go to slide ${index + 1}`}
              />
            ))}
          </div>
        </div>
      )}
    </Carousel>

  );
};

export { Skiper54 };
