
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { fileURLToPath } from "url";
import { transformWithEsbuild } from "vite";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const stubsDir = path.resolve(__dirname, "src/vite-stubs");
const adapterPath = path.resolve(stubsDir, "react-native-web-adapter.js");

// React Native Libraries/ paths that don't exist in react-native-web — resolve to our stubs.
// When "react-native" is aliased to the adapter, subpaths become adapterPath/Libraries/... so we match both.
const LIBRARY_STUBS = {
  "Utilities/codegenNativeComponent": "codegenNativeComponent.js",
  "Utilities/codegenNativeCommands": "codegenNativeCommands.js",
  "Components/TextInput/TextInputState": "TextInputState.js",
  "Pressability/PressabilityDebug": "PressabilityDebug.js",
  "Renderer/shims/ReactNativeViewConfigRegistry": "ReactNativeViewConfigRegistry.js",
  "Renderer/shims/ReactNative": "ReactNativeRendererShim.js",
  "NativeComponent/NativeComponentRegistry": "NativeComponentRegistry.js",
  "NativeComponent/ViewConfigIgnore": "ViewConfigIgnore.js",
  "ReactNative/RendererProxy": "RendererProxy.js",
  "Image/resolveAssetSource": "resolveAssetSource.js",
  "Blob/BlobManager": "BlobManager.js",
};

function reactNativeStubsPlugin() {
  return {
    name: "react-native-stubs",
    enforce: "pre",
    resolveId(id) {
      for (const [suffix, file] of Object.entries(LIBRARY_STUBS)) {
        const rn = `react-native/Libraries/${suffix}`;
        const rnw = `react-native-web/Libraries/${suffix}`;
        const adapted = `${adapterPath}/Libraries/${suffix}`;
        if (id === rn || id === rnw || id === adapted) {
          return path.resolve(stubsDir, file);
        }
      }
      if (id.includes("NativeRNGestureHandlerModule")) {
        return path.resolve(stubsDir, "NativeRNGestureHandlerModule.js");
      }
      if (
        id === "react-native/package.json" ||
        id === "react-native-web/package.json" ||
        id === `${adapterPath}/package.json`
      ) {
        return path.resolve(stubsDir, "react-native-package.json");
      }
    },
  };
}

function jsxInJsPlugin() {
  return {
    name: "jsx-in-js",
    enforce: "pre",
    async transform(code, id) {
      if (!id.includes("node_modules") || !id.endsWith(".js") || id.includes(".native.")) return;
      if (/return\s*<|<\w+[\s>]|<\//.test(code)) {
        return transformWithEsbuild(code, id, { loader: "jsx", jsx: "automatic" });
      }
    },
  };
}

export default defineConfig({
  server: { host: "::", port: 8080 },
  plugins: [reactNativeStubsPlugin(), jsxInJsPlugin(), react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "react-native": adapterPath,
      "@react-native-community/datetimepicker": path.resolve(stubsDir, "DateTimePicker.js"),
    },
  },
  optimizeDeps: {
    exclude: ["react-native"],
  },
});
