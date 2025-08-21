'use client';

import { useState, useEffect } from 'react';

interface FormattedDateProps {
  date: string | Date;
}

export function FormattedDate({ date }: FormattedDateProps) {
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  const dateObj = new Date(date);

  // Render a consistent, non-locale-specific format on the server (and initial client render)
  // Then, after hydration, render the locale-specific format on the client to avoid mismatch.
  return (
    <time dateTime={dateObj.toISOString()}>
      {isClient ? dateObj.toLocaleString() : dateObj.toUTCString()}
    </time>
  );
}
