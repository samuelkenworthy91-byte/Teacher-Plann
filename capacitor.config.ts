import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "app.markflow.planner",
  appName: "MarkFlow",
  // Static output of `next build` (output: "export").
  webDir: "out",
  android: {
    // Keeps the WebView background matching the app's paper colour.
    backgroundColor: "#FBF7F0",
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 600,
      backgroundColor: "#211D17",
      showSpinner: false,
      androidSplashResourceName: "splash",
    },
  },
};

export default config;
