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
    "@tailwindcss/postcss": "^4.1.11",
    "tailwindcss": "^4.1.11"
  }
}
```

### 2. Vite Configuration (`vite.config.ts`)
```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],  // ← No TailwindCSS Vite plugin, use PostCSS instead
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
@tailwind base;
@tailwind components;
@tailwind utilities;
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

### 5. PostCSS Configuration (`postcss.config.js`)
```javascript
export default {
  plugins: {
    '@tailwindcss/postcss': {},  // ← Required even with Vite plugin
  },
}
```

## ❌ What NOT to Do (Common v3 Mistakes)

### Don't Mix Vite Plugin with PostCSS
```css
/* ❌ Don't use both @tailwindcss/vite plugin AND PostCSS - causes conflicts */

/* ✅ v4 with PostCSS - USE THIS */
@tailwind base;
@tailwind components;
@tailwind utilities;
```

### Don't Use Wrong Package Names
```bash
# ❌ Wrong packages for v4
npm install tailwindcss postcss autoprefixer

# ✅ Correct packages for v4
npm install tailwindcss @tailwindcss/vite @tailwindcss/postcss
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