'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { submitFeedback } from '@/lib/actions/feedback';
import { toast } from 'sonner';

interface FeedbackFormProps {
  onSuccess?: () => void;
}

export function FeedbackForm({ onSuccess }: FeedbackFormProps) {
  const t = useTranslations('feedback');

  const [type, setType] = useState<'bug' | 'suggestion' | 'other'>('suggestion');
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!message.trim()) {
      return;
    }

    setIsSubmitting(true);

    try {
      const result = await submitFeedback({
        type,
        message: message.trim(),
        currentPage: window.location.pathname,
        userAgent: navigator.userAgent,
      });

      if (result.success) {
        toast.success(t('success'));
        setMessage('');
        setType('suggestion');
        onSuccess?.();
      } else {
        toast.error(result.error || t('error'));
      }
    } catch (error) {
      console.error('Error submitting feedback:', error);
      toast.error(t('error'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="feedback-type">{t('type')}</Label>
        <Select
          value={type}
          onValueChange={(value) => setType(value as 'bug' | 'suggestion' | 'other')}
        >
          <SelectTrigger id="feedback-type">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="bug">{t('types.bug')}</SelectItem>
            <SelectItem value="suggestion">{t('types.suggestion')}</SelectItem>
            <SelectItem value="other">{t('types.other')}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="feedback-message">{t('message')}</Label>
        <Textarea
          id="feedback-message"
          placeholder={t('messagePlaceholder')}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          className="min-h-[100px] resize-y"
          required
        />
      </div>

      <div className="flex justify-end gap-2">
        <Button type="submit" disabled={isSubmitting || !message.trim()}>
          {isSubmitting ? t('submitting') : t('submit')}
        </Button>
      </div>
    </form>
  );
}
