/**
 * Markdown post-processing utilities for cleaning assistant responses
 */

/**
 * Clean markdown content by removing artifacts and fixing common issues
 */
export function cleanMarkdown(content: string): string {
  let cleaned = content;

  // Remove excessive newlines (more than 2 consecutive)
  cleaned = cleaned.replace(/\n{3,}/g, '\n\n');

  // Fix broken code blocks (triple backticks without proper closing)
  cleaned = cleaned.replace(/```([^`]*?)```/g, (match, code) => {
    // If code block is empty or malformed, try to fix it
    if (!code.trim()) return match;
    return match;
  });

  // Remove standalone triple backticks without content
  cleaned = cleaned.replace(/^```\s*$/gm, '');

  // Fix code blocks that are missing language identifiers but have content
  cleaned = cleaned.replace(/```\n([^`]+)```/g, '```\n$1```');

  // Remove excessive bold markers (more than 2 consecutive **)
  cleaned = cleaned.replace(/\*\*\*\*+/g, '**');

  // Fix markdown artifacts: remove **bold** that appears as emphasis artifacts
  // Only remove if it's clearly an artifact (e.g., **word** with no spacing)
  cleaned = cleaned.replace(/\*\*(\w+)\*\*/g, (match, word) => {
    // Keep it if it's intentional formatting, remove if it's clearly an artifact
    // This is a conservative approach - we'll keep most bold markers
    return match;
  });

  // Clean up JSON dumps - ensure they're in code blocks
  // Look for patterns like { "key": "value" } that aren't in code blocks
  const jsonPattern = /^\s*\{[\s\S]*\}\s*$/m;
  if (jsonPattern.test(cleaned) && !cleaned.includes('```')) {
    // If it looks like JSON and isn't in a code block, wrap it
    const lines = cleaned.split('\n');
    let inJsonBlock = false;
    let jsonStart = -1;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line.startsWith('{') && !inJsonBlock) {
        inJsonBlock = true;
        jsonStart = i;
      }
      if (inJsonBlock && line.endsWith('}')) {
        // Wrap this JSON block
        lines[jsonStart] = '```json\n' + lines[jsonStart];
        lines[i] = lines[i] + '\n```';
        inJsonBlock = false;
      }
    }
    cleaned = lines.join('\n');
  }

  // Remove trailing whitespace from each line
  cleaned = cleaned.split('\n').map(line => line.trimEnd()).join('\n');

  // Remove leading/trailing newlines
  cleaned = cleaned.trim();

  return cleaned;
}

/**
 * Validate markdown structure
 */
export function validateMarkdown(content: string): boolean {
  // Check for balanced code blocks
  const codeBlockMatches = content.match(/```/g);
  if (codeBlockMatches && codeBlockMatches.length % 2 !== 0) {
    return false; // Unbalanced code blocks
  }

  // Check for balanced brackets in links
  const linkMatches = content.match(/\[([^\]]*)\]\(([^)]*)\)/g);
  // Basic validation - if we have [ without ], it's likely broken
  const openBrackets = (content.match(/\[/g) || []).length;
  const closeBrackets = (content.match(/\]/g) || []).length;
  if (openBrackets !== closeBrackets) {
    return false;
  }

  return true;
}

/**
 * Post-process assistant response to ensure clean markdown
 */
export function processAssistantResponse(content: string): string {
  // First clean the markdown
  let processed = cleanMarkdown(content);

  // Validate and fix if needed
  if (!validateMarkdown(processed)) {
    // Try to fix common issues
    // Fix unclosed code blocks
    const codeBlockCount = (processed.match(/```/g) || []).length;
    if (codeBlockCount % 2 !== 0) {
      // Add closing backticks if missing
      processed += '\n```';
    }
  }

  return processed;
}





