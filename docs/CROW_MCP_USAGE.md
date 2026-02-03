# Crow MCP Usage Guide

## Overview

The **crow-mcp** server provides access to Crow Documentation through an MCP (Model Context Protocol) tool. This allows you to search Crow's knowledge base for documentation, code examples, API references, and guides directly from within Cursor.

## Available Tool

### SearchCrowDocumentation

Searches the Crow Documentation knowledge base for relevant information.

**Required Parameters:**

- `query` (string): Your search query

**Optional Parameters:**

- `version` (string): Filter to a specific version (e.g., "v0.7")
- `language` (string): Filter to a specific language code (e.g., "zh", "es"). Defaults to "en"
- `apiReferenceOnly` (boolean): Only return API reference documentation
- `codeOnly` (boolean): Only return code snippets

## How to Use

### Basic Search

To search Crow documentation, ask the AI assistant to search Crow documentation:

```
Search Crow documentation for "authentication setup"
```

Or be more specific:

```
Find Crow API documentation for widget integration
```

### Advanced Usage Examples

**1. Search for API references only:**

```
Search Crow API reference documentation for "API methods"
```

**2. Search for code examples:**

```
Find Crow code examples for widget integration
```

**3. Search specific version:**

```
Search Crow v0.7 documentation for configuration options
```

**4. Search in different language:**

```
Search Crow documentation in Spanish for "configuración"
```

## Integration with Your Project

Your project already has Crow integrated via the widget script in [`src/app/layout.tsx`](../src/app/layout.tsx):

```tsx
<script
  src="https://api.usecrow.org/static/crow-widget.js"
  data-api-url="https://api.usecrow.org"
  data-product-id="user_38yg9kLxItMv8GyFH4xNMZytg6F"
></script>
```

The MCP server complements this by providing programmatic access to Crow's documentation for development purposes.

## When to Use

Use Crow MCP documentation search when you need to:

- Find Crow API documentation
- Look up implementation examples
- Understand how Crow features work
- Get code snippets for integration
- Troubleshoot Crow-related issues
- Learn about Crow configuration options
- Understand widget customization options
- Find best practices for Crow integration

## Best Practices

1. **Be specific with queries**: More specific queries yield better results
2. **Use natural language**: Ask questions naturally - the AI assistant will translate them to appropriate MCP tool calls
3. **Combine with codebase search**: Use Crow documentation search alongside codebase search for comprehensive answers
4. **Reference version when needed**: If working with a specific Crow version, mention it in your query

## Example Use Cases

### Example 1: Understanding Widget Configuration

**Query to AI:**

```
How do I customize the Crow widget appearance? Search Crow documentation for widget customization options.
```

### Example 2: Troubleshooting Integration Issues

**Query to AI:**

```
I'm having issues with the Crow widget not loading. Search Crow documentation for common integration problems and solutions.
```

### Example 3: Finding API Methods

**Query to AI:**

```
What API methods are available in Crow? Search Crow API reference documentation.
```

### Example 4: Getting Code Examples

**Query to AI:**

```
Show me code examples for integrating Crow widget in a Next.js application. Search Crow documentation for Next.js integration examples.
```

## Technical Details

The MCP tool is accessed through the `call_mcp_tool` function with:

- **Server**: `user-crow-mcp`
- **Tool Name**: `SearchCrowDocumentation`

The AI assistant automatically handles the MCP tool calls when you ask questions about Crow documentation.
