import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { MessageSquare } from 'lucide-react';

interface Question {
  id: string;
  question: string;
  required: boolean;
}

interface ClarifyingQuestionsDialogProps {
  open: boolean;
  questions: Question[];
  onSubmit: (answers: Record<string, string>) => void;
  onCancel: () => void;
}

export const ClarifyingQuestionsDialog = ({
  open,
  questions,
  onSubmit,
  onCancel
}: ClarifyingQuestionsDialogProps) => {
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleAnswerChange = (questionId: string, value: string) => {
    setAnswers(prev => ({ ...prev, [questionId]: value }));
    setErrors(prev => ({ ...prev, [questionId]: '' }));
  };

  const handleSubmit = () => {
    const newErrors: Record<string, string> = {};

    // Validate required questions
    questions.forEach(question => {
      if (question.required && !answers[question.id]?.trim()) {
        newErrors[question.id] = 'This question is required';
      }
    });

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    onSubmit(answers);
  };

  return (
    <Dialog open={open} onOpenChange={(open) => !open && onCancel()}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-primary" />
            A Few Quick Questions
          </DialogTitle>
          <DialogDescription>
            Please help us better understand your project by answering these questions.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {questions.map((question, index) => (
            <div key={question.id} className="space-y-2">
              <Label htmlFor={`question-${question.id}`} className="text-base">
                {index + 1}. {question.question}
                {question.required && <span className="text-destructive ml-1">*</span>}
              </Label>
              <Textarea
                id={`question-${question.id}`}
                value={answers[question.id] || ''}
                onChange={(e) => handleAnswerChange(question.id, e.target.value)}
                placeholder="Enter your answer here..."
                rows={4}
                maxLength={2000}
                className={errors[question.id] ? 'border-destructive' : ''}
              />
              {errors[question.id] && (
                <p className="text-sm text-destructive">{errors[question.id]}</p>
              )}
              <p className="text-xs text-muted-foreground">
                {answers[question.id]?.length || 0} / 2000 characters
              </p>
            </div>
          ))}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onCancel}>
            Go Back
          </Button>
          <Button onClick={handleSubmit}>
            Submit Quote
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
