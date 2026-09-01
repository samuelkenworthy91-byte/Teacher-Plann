import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "app.markflow.planner",
  appName: "MarkFlow",
  // Static output of `next build` (output: "export").
  webDir: "out",
  android: {
    // Keeps the WebView background matching the app's paper colour.
    backgroundColor: "#FBF7F0",
    // Android 15 forces edge-to-edge, which would slide the header and menu
    // underneath the status bar / camera cut-out. "force" keeps the WebView
    // inset below the system bars on every Android version.
    adjustMarginsForEdgeToEdge: "force",
  },
  plugins: {
    StatusBar: {
      overlaysWebView: false,
      style: "LIGHT",
      backgroundColor: "#FBF7F0",
    },
    SplashScreen: {
      launchShowDuration: 600,
      backgroundColor: "#211D17",
      showSpinner: false,
      androidSplashResourceName: "splash",
    },
  },
};

export default config;
