/**
 * Layout E exists only in the web build (`WideHome.web.tsx`, 0.6.0): the phone app never asks for it
 * (`useWideLayout` is false there), so the phone bundle gets this empty stand-in.
 */
export function WideHome() {
  return null;
}
