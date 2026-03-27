import { ScrollView, Platform } from 'react-native';

// This file is used for standard web rendering. 
// It also contains a polyfill for import.meta for older browsers/bundlers.
export default function Root({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no" />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              // Polyfill for import.meta
              if (typeof import.meta === 'undefined') {
                Object.defineProperty(globalThis, 'import.meta', {
                  get: function() { return { url: window.location.href }; }
                });
              }
            `,
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
