import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: "#00b4a6",
          dim: "#e0f7f5",
        },
      },
    },
  },
  plugins: [],
};

export default config;
