// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require("eslint-config-expo/flat");

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ["dist/*"],
  },
  {
    rules: {
      // NativeWind's JSX interop drops Pressable style callbacks (`style={({ pressed }) => …}`),
      // which renders the component completely unstyled. Use the Touchable wrapper instead.
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "react-native",
              importNames: ["Pressable"],
              message: "Use Touchable from '@/components/Touchable' — NativeWind drops Pressable style callbacks.",
            },
            {
              name: "react-native",
              importNames: ["Alert"],
              message: "Use showAlert from '@/store/useDialogStore' — Alert does nothing on the web (0.6.0).",
            },
          ],
        },
      ],
    },
  },
]);
