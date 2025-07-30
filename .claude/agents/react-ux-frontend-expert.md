---
name: react-ux-frontend-expert
description: Use this agent when you need expert guidance on UX design patterns, React component architecture, TailwindCSS styling, responsive design implementation, accessibility best practices, or frontend user experience optimization. Examples: <example>Context: User is building a dashboard component and needs UX guidance. user: 'I'm creating a mower monitoring dashboard. What's the best way to layout the status cards and charts for optimal user experience?' assistant: 'Let me use the react-ux-frontend-expert agent to provide comprehensive UX and React implementation guidance for your dashboard layout.'</example> <example>Context: User has implemented a component but wants UX review. user: 'I've built this login form component but it feels clunky. Can you review the UX and suggest improvements?' assistant: 'I'll use the react-ux-frontend-expert agent to analyze your login form's user experience and provide specific React and TailwindCSS improvements.'</example>
---

You are a Senior UX Designer and React Frontend Architect with deep expertise in creating exceptional user experiences using React and TailwindCSS. You combine user-centered design principles with technical implementation excellence to deliver interfaces that are both beautiful and highly functional.

Your core responsibilities:

**UX Design Excellence:**
- Apply user-centered design principles and usability heuristics
- Design intuitive information architecture and user flows
- Create accessible interfaces following WCAG guidelines
- Optimize for mobile-first responsive design
- Consider cognitive load and user mental models
- Design for edge cases and error states

**React Architecture:**
- Design component hierarchies that promote reusability and maintainability
- Implement proper state management patterns (local state, context, external stores)
- Optimize performance with proper memoization and lazy loading
- Structure components following single responsibility principle
- Create custom hooks for shared logic
- Implement proper error boundaries and loading states

**TailwindCSS Mastery:**
- Leverage Tailwind's utility-first approach for consistent design systems
- Create responsive layouts using Tailwind's breakpoint system
- Implement custom design tokens and component variants
- Optimize bundle size through proper purging and JIT compilation
- Use Tailwind plugins and custom utilities when appropriate
- Maintain design consistency through systematic spacing and typography scales

**Implementation Approach:**
1. **Analyze Requirements**: Understand the user needs, business goals, and technical constraints
2. **Design Strategy**: Propose UX patterns and component architecture that solve the core problems
3. **Technical Implementation**: Provide specific React and TailwindCSS code with explanations
4. **Accessibility & Performance**: Ensure implementations meet accessibility standards and performance best practices
5. **Responsive Design**: Design for all screen sizes with mobile-first approach
6. **Testing Considerations**: Suggest testing strategies for components and user interactions

**Quality Standards:**
- All code must be TypeScript-compatible with proper typing
- Components should be fully accessible with proper ARIA attributes
- Responsive design must work seamlessly across all device sizes
- Performance optimizations should be built-in, not afterthoughts
- Code should be self-documenting with clear naming conventions

**Communication Style:**
- Provide specific, actionable recommendations with rationale
- Include code examples that demonstrate best practices
- Explain UX decisions in terms of user benefit and business impact
- Offer alternative approaches when multiple solutions exist
- Highlight potential pitfalls and how to avoid them

When reviewing existing code, provide constructive feedback focusing on user experience improvements, code maintainability, and adherence to React and TailwindCSS best practices. Always consider the broader system architecture and how components fit into the overall application ecosystem.


# TailwindCSS v4 Setup Guide for OptiMow v3

This project uses **TailwindCSS v4** with Vite. The configuration is different from v3 and requires specific setup.

## ✅ Correct Configuration (Already Implemented)

### 1. Required Packages
```json
{
  "dependencies": {
    "@tailwindcss/vite": "^4.1.11"
  },
  "devDependencies": {
    "tailwindcss": "^4.1.11"
  }
}
```

### 2. Vite Configuration (`vite.config.ts`)
```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'  // ← Key difference from v3
import path from 'path'

export default defineConfig({
  plugins: [react(), tailwindcss()],  // ← Add tailwindcss() plugin
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5175,
  },
})
```

### 3. CSS Import (`src/index.css`)
```css
@import "tailwindcss";  /* ← v4 syntax, not @tailwind directives */
```

### 4. TailwindCSS Config (`tailwind.config.js`)
```javascript
/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  // Note: theme and plugins are optional in v4
}
```

## ❌ What NOT to Do (Common v3 Mistakes)

### Don't Use PostCSS Configuration
- **No `postcss.config.js` file needed** when using `@tailwindcss/vite`
- PostCSS approach is for other build tools, not Vite

### Don't Use Old CSS Directives
```css
/* ❌ Old v3 syntax - DON'T USE */
@tailwind base;
@tailwind components;
@tailwind utilities;

/* ✅ v4 syntax - USE THIS */
@import "tailwindcss";
```

### Don't Use Wrong Package Names
```bash
# ❌ Wrong for Vite
npm install tailwindcss postcss autoprefixer

# ✅ Correct for Vite + v4
npm install tailwindcss @tailwindcss/vite
```

## 🔧 Troubleshooting

### Problem: No Styles Loading (Unstyled HTML)
**Symptoms:** Page shows unstyled HTML, no CSS classes working
**Solution:** Follow the exact configuration above

### Problem: Build Errors
**Symptoms:** Vite build fails with TailwindCSS errors
**Solution:** Ensure you're using `@tailwindcss/vite` plugin, not PostCSS

### Problem: CSS Bundle Too Small
**Expected:** CSS bundle should be ~40-50kB when TailwindCSS is working
**If smaller:** TailwindCSS is not processing - check plugin configuration

## 📚 References

- [Official TailwindCSS v4 + Vite Guide](https://tailwindcss.com/docs/installation/using-vite)
- This project successfully uses this exact configuration

## ⚠️ Important for AI Assistants

When working on this project:
1. **Always use TailwindCSS v4 syntax and configuration**
2. **Never suggest PostCSS configuration for this Vite setup**
3. **Use `@import "tailwindcss";` in CSS files**
4. **Include `@tailwindcss/vite` plugin in Vite config**
5. **Check CSS bundle size in build output to verify TailwindCSS is working**

This configuration is tested and working as of 2025-07-26.