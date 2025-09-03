/** @type {import('tailwindcss').Config} */
// tailwind.config.js
module.exports = {
  content: [
    "./src/**/*.{html,js,ejs}",
    "./views/**/*.{html,js,ejs}",
    "./*.{html,js,ejs}"
  ],
  theme: {
    extend: {
      borderRadius: {
        custom: "12px",  // ✅ custom radius
      },
      boxShadow: {
        custom: "0 4px 12px rgba(0, 0, 0, 0.1)", // ✅ custom shadow
      },
      colors: {
        primary: "#ff9aa2",
        secondary: "#ffb7b2",
        accent: "#ffdac1",
        success: "#26b46b",
        red:"#FF5B1A",
        edit:"#FFC14E",
        info:"#9FA9F0",
        "success-light": "#d4edda",
        text: "#333333",
        white: "#ffffff",
        gray:"#363333ff",
        "light-pink": "#ffe4e1",
        "light-bg": "#fafafa",
        "border-color": "#e5e7eb",
        "light-gray": "#f9fafb"
      },
      fontFamily: {
        sans: ["Kanit", "sans-serif"],
      },
    },
  },
  plugins: [],
};




        