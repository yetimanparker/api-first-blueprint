import React from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { MeasurementWidget } from '@/components/MeasurementWidget';
import { Card } from '@/components/ui/card';
import { AlertCircle } from 'lucide-react';

const Widget = () => {
  const { contractorId } = useParams<{ contractorId: string }>();
  const [searchParams] = useSearchParams();
  const mode = searchParams.get('mode') as 'embedded' | 'standalone' || 'standalone';

  if (!contractorId) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="p-6 max-w-md w-full text-center">
          <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
          <h2 className="text-lg font-semibold mb-2">Widget Configuration Error</h2>
          <p className="text-muted-foreground">
            This widget is not properly configured. Please contact the website owner.
          </p>
        </Card>
      </div>
    );
  }

  const handleQuoteSubmit = (quote: any) => {
    console.log('Quote submitted:', quote);
    // This will be handled by the widget component
  };

  console.log('Widget rendering with contractorId:', contractorId, 'mode:', mode);
  
  return (
    <div className={`${mode === 'embedded' ? '' : 'min-h-screen bg-gradient-to-br from-primary/5 via-background to-accent/5'} flex items-start justify-center p-4`}>
      <div className={`w-full ${mode === 'embedded' ? 'max-w-none' : 'max-w-2xl'} ${mode === 'embedded' ? 'mt-0' : 'mt-8'}`}>
        {contractorId ? (
          <MeasurementWidget
            contractorId={contractorId}
            mode={mode}
            onQuoteSubmit={handleQuoteSubmit}
            className={mode === 'embedded' ? 'shadow-none border-0' : ''}
          />
        ) : (
          <div className="text-center p-8">
            <p>Loading widget...</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Widget;