'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Budget settings page error:', error);
  }, [error]);

  return (
    <div className="flex min-h-[400px] items-center justify-center p-6">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-red-600">Something went wrong</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-gray-600">
            {error.message || 'Failed to load budget settings. Please try again.'}
          </p>
          <div className="flex gap-3">
            <Button onClick={reset} variant="outline">
              Try again
            </Button>
            <Button onClick={() => (window.location.href = '/settings')} variant="outline">
              Go to Settings
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
