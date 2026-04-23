'use client'

import React from 'react'

/**
 * Interface representing a Caption object from the backend
 */
export interface Caption {
  id: string
  content: string | null
  image_id?: string
  humor_flavor_id?: number | string
}

interface CaptionListProps {
  /** Array of caption objects */
  captions: Caption[]
  /** Optional additional class names for the container */
  className?: string
}

/**
 * CaptionList Component
 * 
 * Displays a numbered list of caption content from a list of caption objects.
 * Extracts only the 'content' field and handles empty/null values gracefully.
 */
export function CaptionList({ captions, className = '' }: CaptionListProps) {
  // Empty state fallback
  if (!captions || captions.length === 0) {
    return (
      <div className={`p-8 md:p-12 text-center border-sketchy bg-pastel-blue/20 dark:bg-zinc-800/50 ${className}`}>
        <p className="text-gray-500 dark:text-gray-300 font-bold italic">
          No captions found in the sketchpad.
        </p>
      </div>
    )
  }

  const pastelColors = [
    'bg-pastel-blue/60 dark:bg-blue-900/40',
    'bg-pastel-pink/60 dark:bg-pink-900/40',
    'bg-pastel-purple/60 dark:bg-purple-900/40',
    'bg-pastel-yellow/60 dark:bg-yellow-900/40',
    'bg-pastel-green/60 dark:bg-green-900/40',
  ]

  return (
    <div className={`w-full ${className}`}>
      <ol className="list-decimal list-outside ml-6 md:ml-10 space-y-6 md:space-y-8">
        {captions.map((caption, index) => (
          <li 
            key={caption.id} 
            className="pl-2 md:pl-4 text-gray-900 dark:text-white font-black marker:text-accent dark:marker:text-accent marker:text-xl md:marker:text-2xl"
          >
            <div className={`p-4 md:p-6 border-sketchy shadow-hand hover:shadow-hand-hover transition-all duration-200 transform hover:-rotate-1 ${pastelColors[index % pastelColors.length]}`}>
              <p className="leading-relaxed font-bold text-gray-900 dark:text-white text-lg md:text-xl">
                {caption.content?.trim() || (
                  <span className="text-gray-500 dark:text-gray-400 italic font-normal">
                    [The ink ran out here...]
                  </span>
                )}
              </p>
            </div>
          </li>
        ))}
      </ol>
    </div>
  )
}
