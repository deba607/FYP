const GOOGLE_MAPS_SCRIPT_ID = 'bharat-museum-google-maps';

let mapsPromise: Promise<typeof google> | null = null;

/** Loads Google Maps only when the navigation workspace is first displayed. */
export function loadGoogleMaps() {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('Google Maps can only load in the browser.'));
  }

  if (window.google?.maps) return Promise.resolve(window.google);
  if (mapsPromise) return mapsPromise;

  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    return Promise.reject(
      new Error('Google Maps is not configured. Add NEXT_PUBLIC_GOOGLE_MAPS_API_KEY to the client environment.')
    );
  }

  mapsPromise = new Promise((resolve, reject) => {
    const existingScript = document.getElementById(GOOGLE_MAPS_SCRIPT_ID) as HTMLScriptElement | null;
    const callbackName = '__bharatMuseumGoogleMapsReady';

    const cleanUp = () => {
      delete (window as typeof window & Record<string, unknown>)[callbackName];
    };

    (window as typeof window & Record<string, unknown>)[callbackName] = () => {
      cleanUp();
      resolve(window.google);
    };

    if (existingScript) {
      existingScript.addEventListener('error', () => {
        cleanUp();
        mapsPromise = null;
        reject(new Error('Google Maps could not be loaded. Check your connection and API key.'));
      }, { once: true });
      return;
    }

    const script = document.createElement('script');
    script.id = GOOGLE_MAPS_SCRIPT_ID;
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&v=weekly&loading=async&callback=${callbackName}`;
    script.async = true;
    script.defer = true;
    script.onerror = () => {
      cleanUp();
      script.remove();
      mapsPromise = null;
      reject(new Error('Google Maps could not be loaded. Check your connection and API key.'));
    };
    document.head.appendChild(script);
  });

  return mapsPromise;
}
