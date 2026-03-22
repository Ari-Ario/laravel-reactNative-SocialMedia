// hooks/useModeration.ts
import { useState, useCallback, useEffect } from 'react';
import { quickCheckContent, ModerationAnalysis } from '@/services/ModerationService';
import debounce from 'lodash/debounce';

/**
 * useModeration Hook
 * Provides real-time AI-driven content protection and validation.
 */
export const useModeration = (initialText: string = '', context: string = 'generic_input') => {
    const [text, setText] = useState(initialText);
    const [analysis, setAnalysis] = useState<ModerationAnalysis | null>(null);
    const [isChecking, setIsChecking] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const performModeration = useCallback(
        debounce(async (val: string) => {
            if (!val || val.length < 10) {
                setAnalysis(null);
                return;
            }

            setIsChecking(true);
            setError(null);

            try {
                const result = await quickCheckContent(val, context);
                setAnalysis(result);
            } catch (err: any) {
                console.error('Real-time moderation failed:', err);
                setError('Could not verify content integrity');
            } finally {
                setIsChecking(false);
            }
        }, 800),
        [context]
    );

    useEffect(() => {
        setText(initialText);
    }, [initialText]);

    useEffect(() => {
        performModeration(text);
    }, [text, performModeration]);

    return {
        text,
        setText,
        analysis,
        isChecking,
        error,
        isSafe: analysis?.is_safe ?? true, // Assume safe if no analysis yet
        maliciousScore: analysis?.scores.malicious ?? 0,
        moralityScore: analysis?.scores.morality ?? 0,
        factScore: analysis?.scores.fact ?? 0.5,
    };
};
