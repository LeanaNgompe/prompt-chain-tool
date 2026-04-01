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
      <div className={`p-12 text-center border-sketchy bg-pastel-blue/20 dark:bg-zinc-800/30 ${className}`}>
        <p className="text-gray-500 dark:text-gray-400 font-medium italic">
          No captions found in the sketchpad.
        </p>
      </div>
    )
  }

  const pastelColors = [
    'bg-pastel-blue/40 dark:bg-blue-900/20',
    'bg-pastel-pink/40 dark:bg-pink-900/20',
    'bg-pastel-purple/40 dark:bg-purple-900/20',
    'bg-pastel-yellow/40 dark:bg-yellow-900/20',
    'bg-pastel-green/40 dark:bg-green-900/20',
  ]

  return (
    <div className={`w-full ${className}`}>
      <ol className="list-decimal list-outside ml-8 space-y-6">
        {captions.map((caption, index) => (
          <li 
            key={caption.id} 
            className="pl-2 text-gray-900 dark:text-gray-100 font-bold marker:text-accent dark:marker:text-indigo-400 marker:text-lg"
          >
            <div className={`p-5 border-sketchy-soft shadow-hand hover:shadow-hand-hover transition-all duration-200 transform hover:-rotate-1 ${pastelColors[index % pastelColors.length]}`}>
              <p className="leading-relaxed font-medium text-gray-800 dark:text-gray-200 text-lg">
                {caption.content?.trim() || (
                  <span className="text-gray-400 dark:text-gray-500 italic font-normal">
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
