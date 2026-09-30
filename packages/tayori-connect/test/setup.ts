import { GlobalRegistrator } from '@happy-dom/global-registrator';

// react-dom/client requires a DOM. Register Happy DOM globals (document,
// window, etc.) before anything imports React DOM.
// A real URL (instead of the default about:blank) so history.pushState works.
// Resource loading and navigation are disabled: tests must never hit the real network.
GlobalRegistrator.register({
  url: 'https://tayori.skk.moe/',
  settings: {
    disableJavaScriptFileLoading: true,
    disableCSSFileLoading: true,
    // fire `load` (not `error`) on skipped resources
    handleDisabledFileLoadingAsSuccess: true,
    navigation: {
      disableMainFrameNavigation: true,
      disableChildFrameNavigation: true,
      disableChildPageNavigation: true
    }
  }
});

declare global {
  // eslint-disable-next-line vars-on-top -- types
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

// Opt-in to React's act() environment so act() doesn't warn.
// (@testing-library/react only toggles this automatically when beforeAll/afterAll exist, which mocha lacks)
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
