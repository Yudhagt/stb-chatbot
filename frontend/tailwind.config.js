/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  darkMode: ["class", '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        accent: {
          50: "var(--accent-50, #eef2ff)",
          100: "var(--accent-100, #e0e7ff)",
          200: "var(--accent-200, #c7d2fe)",
          300: "var(--accent-300, #a5b4fc)",
          400: "var(--accent-400, #818cf8)",
          500: "var(--accent-500, #6366f1)",
          600: "var(--accent-600, #4f46e5)",
          700: "var(--accent-700, #4338ca)"
        }
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "-apple-system", "sans-serif"],
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "Monaco", "Consolas", "monospace"]
      },
      animation: {
        "fade-in": "fadeIn 0.2s ease-out",
        "fade-up": "fadeUp 0.3s ease-out",
        "slide-in": "slideIn 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
        "pulse-dot": "pulseDot 1.2s infinite ease-in-out",
        "cursor-blink": "cursorBlink 0.8s infinite",
        shimmer: "shimmer 2s infinite linear"
      },
      keyframes: {
        fadeIn: { "0%": { opacity: "0" }, "100%": { opacity: "1" } },
        fadeUp: { "0%": { opacity: "0", transform: "translateY(12px)" }, "100%": { opacity: "1", transform: "translateY(0)" } },
        slideIn: { "0%": { opacity: "0", transform: "translateX(30px)" }, "100%": { opacity: "1", transform: "translateX(0)" } },
        pulseDot: { "0%,100%": { opacity: ".3", transform: "scale(.8)" }, "50%": { opacity: "1", transform: "scale(1.2)" } },
        cursorBlink: { "0%,100%": { opacity: "1" }, "50%": { opacity: "0" } },
        shimmer: { "0%": { transform: "translateX(-100%)" }, "100%": { transform: "translateX(100%)" } }
      }
    }
  },
  plugins: []
};
