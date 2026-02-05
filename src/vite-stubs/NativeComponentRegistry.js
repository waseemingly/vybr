/**
 * Stub for react-native/Libraries/NativeComponent/NativeComponentRegistry.
 * Used by Vite web build; native components are not used on web.
 */
import React from "react";

function StubNativeComponent() {
  return React.createElement("div", null);
}

export default {
  get(_name, _getConfig) {
    return StubNativeComponent;
  },
};
