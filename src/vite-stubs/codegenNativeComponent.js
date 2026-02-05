/**
 * Stub for react-native/Libraries/Utilities/codegenNativeComponent.
 * Used by Vite web build only; native codegen components are not used on web.
 * Callers (e.g. react-native-safe-area-context specs) get a no-op component.
 */
import React from 'react';

function codegenNativeComponent() {
  return function StubNativeComponent(props) {
    return React.createElement('div', props);
  };
}

export default codegenNativeComponent;
