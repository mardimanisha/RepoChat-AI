import React from 'react';
import { RouterProvider } from 'react-router';
import { router } from './utils/routes';
import { ThemeProvider } from './utils/theme-provider';
import { Toaster } from './components/ui/sonner';

export default function App() {
  return (
    <ThemeProvider>
      <RouterProvider router={router} />
      <Toaster position="top-right" />
    </ThemeProvider>
  );
}
