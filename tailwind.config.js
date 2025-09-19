
const colors = require("tailwindcss/colors");

module.exports = {
  content: [
    "./src/**/*.{html,js,ejs}",
    "./views/**/*.{html,ejs}",
    "./*.{html,js,ejs}"
  ],
  theme: {
    extend: {
      fontFamily: {
        kanit: ['Kanit', 'sans-serif'],
      },
      colors: {
        
        primary: "#FF9AA2",
        primary2: "#FF9AA2",
        secondary: "#f1c5d0ff",
        accent: "#ffdac1",
        
        p2:"#FF9AA2",
        p3:" #FFB3BA",
        p4:"#FFCCCE;",
        p5:"#FFE6E7",
        p6:"#F1C5D0",
        p7:"#E8B4CB",
        p8:"#DFA3C6",

        g1:"#86c26b",
        g2:"#b1e08f",
        g3:"#bfe692",
        g4:"#d5f0b3",
        g5:"#e9fad1",
        g6:"#d5f0b3",
        g7:"#e9fad1",
        
        b1: "#6ca0dc",
        b2: "#7fb3e6",
        b3: "#93c5fd",
        b4: "#a3d4ff",
        b5: "#c0e7ff",
        b6: "#d0f0ff",
        b7: "#e0f8ff",
        b8: "#F4FBFF",

        bb:"#29506f",

        success: "#26b46b",
        add: "#bfe692ff",
        edit: "#FABC63",
        red: "#FF5B1A",
        gray: "#9ca3af",
        info: "#b2dcfe",

        text: "#333333",
        white: "#ffffff",
        "light-pink": "#ffe4e1",
        "light-bg": "#fafafa",
        "border-color" : "#333333",

        warning: "#facc15",
        danger: "#dc2626",
       
        "pink-strong": "#ec4899",
        
      },

      borderRadius: {
        custom: "12px",
      },
      boxShadow: {
        custom: "0 4px 12px rgba(0, 0, 0, 0.1)",
      },
      fontFamily: {
        sans: ["Kanit", "sans-serif"],
      },
    },
  },
  plugins: [],
};