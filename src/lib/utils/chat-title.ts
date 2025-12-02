/**
 * Generate a smart chat title from the first user message
 * 
 * Rules:
 * - Extract first 40 characters
 * - Remove special chars
 * - Trim whitespace
 * - Add ellipsis if too long
 * - Capitalize
 * - Fallback for short questions
 */
export function generateChatTitle(firstMessage: string): string {
  const originalLength = firstMessage.trim().length;
  
  // Trim and get first 40 characters
  let title = firstMessage.trim().substring(0, 40);
  
  // Remove special characters (keep letters, numbers, spaces, and basic punctuation)
  title = title.replace(/[^\w\s\-.,!?]/g, '');
  
  // Trim whitespace again after removing special chars
  title = title.trim();
  
  // Handle empty or very short messages
  if (title.length < 3) {
    return "Help – New Question";
  }
  
  // Capitalize first letter
  title = title.charAt(0).toUpperCase() + title.slice(1);
  
  // Add ellipsis if original message was longer than 40 chars
  if (originalLength > 40) {
    title = title.trim() + "...";
  }
  
  return title;
}

