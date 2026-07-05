export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        kiwi: {
          50: "#f2f8f0",
          100: "#dcefd8",
          500: "#2e7d32",
          600: "#1f6b3a",
          700: "#14532d",
          900: "#0b2418"
        },
        charcoal: "#17201c"
      },
      boxShadow: {
        soft: "0 18px 45px rgba(15, 35, 26, 0.10)"
      }
    }
  },
  plugins: []
};
