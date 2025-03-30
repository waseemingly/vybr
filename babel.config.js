module.exports = function (api) {
  api.cache(true);
  return {
    presets: ["babel-preset-expo"],
    plugins: [
      [
        "module-resolver",
        {
          root: ["./src"],
          extensions: [".ios.js", ".android.js", ".js", ".ts", ".tsx", ".json"],
          alias: {
            "@": "./src",
          },
        },
      ],
      "react-native-reanimated/plugin",
      // Add the dotenv plugin here
      [
        "module:react-native-dotenv", 
        {
          "moduleName": "@env",
          "path": ".env",
          "safe": true,
          "allowUndefined": false
        }
      ]
    ],
  };
};
