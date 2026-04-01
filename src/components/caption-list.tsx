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
      <div className={`p-8 text-center border-2 border-dashed border-gray-200 dark:border-gray-800 rounded-xl bg-gray-50/50 dark:bg-gray-900/30 ${className}`}>
        <p className="text-gray-500 dark:text-gray-400 font-medium italic">
          No captions available to display.
        </p>
      </div>
    )
  }

  return (
    <div className={`w-full ${className}`}>
      <ol className="list-decimal list-outside ml-6 space-y-4">
        {captions.map((caption) => (
          <li 
            key={caption.id} 
            className="pl-2 text-gray-900 dark:text-gray-100 font-medium marker:text-indigo-600 dark:marker:text-indigo-400 marker:font-bold"
          >
            <div className="p-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-sm hover:border-gray-300 dark:hover:border-gray-600 transition-colors">
              <p className="leading-relaxed font-normal text-gray-800 dark:text-gray-200">
                {caption.content?.trim() || (
                  <span className="text-gray-400 dark:text-gray-500 italic">
                    [No content provided]
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
