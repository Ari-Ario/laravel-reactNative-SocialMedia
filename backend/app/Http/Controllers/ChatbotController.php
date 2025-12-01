<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;
use App\Models\ChatbotTraining;
use App\Models\User;
use App\Notifications\ChatbotTrainingNeeded;
use App\Events\ChatbotTrainingNeeded as ChatbotTrainingNeededEvent;
use Illuminate\Support\Str;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;

class ChatbotController extends Controller
{
    // Contextual memory – now per conversation
    private $conversationContext = [];     // [conv_id => [messages]]
    private $contextTimestamps = [];       // [conv_id => last_active_timestamp]
    private $currentContext = [];          // [conv_id => 'account'|'payment'|...]
    private $decisionTreeState = [];       // [conv_id => current_node]

    public function handleMessage(Request $request)
    {
        $request->validate([
            'message' => 'required|string',
            'conversation_id' => 'nullable|string'
        ]);

        $message = trim($request->message);
        $conversationId = $request->conversation_id ?? Str::uuid()->toString();

        // Initialize conversation storage
        if (!isset($this->conversationContext[$conversationId])) {
            $this->conversationContext[$conversationId] = [];
            $this->contextTimestamps[$conversationId] = time();
        }

        // Add message to history
        $this->conversationContext[$conversationId][] = strtolower($message);
        $this->contextTimestamps[$conversationId] = time();

        // Clean old context
        $this->cleanOldContext($conversationId);

        // Main response engine
        $response = $this->getRuleBasedResponse($message, $conversationId);

        return response()->json([
            'response' => $response,
            'conversation_id' => $conversationId
        ]);
    }

    // ========================================================================
    // MAIN RESPONSE ENGINE – FULLY EXTENDED
    // ========================================================================
    private function getRuleBasedResponse(string $message, string $conversationId): string
    {
        $lowerMessage = strtolower($message);

        // 1–8: All your existing fast checks (exact, cache, keywords, etc.)
        $exactResponses = [
            'hello' => 'Hi! How can I help?',
            'hi' => 'Hi! How can I help?',
            'hey' => 'Hi! How can I help?',
            // ... keep all your existing ones
        ];

        if (isset($exactResponses[$lowerMessage])) {
            return $exactResponses[$lowerMessage];
        }

        $learnedResponses = cache()->get('learned_responses', []);
        if (isset($learnedResponses[$lowerMessage])) {
            return $learnedResponses[$lowerMessage];
        }

        $analysis = $this->analyzeMessage($message);
        $keywords = $analysis['keywords'];
        $sentiment = $analysis['sentiment'];

        if ($sentiment === 'negative') {
            return "I'm sorry to hear you're having trouble. Let me help resolve this.";
        }

        if ($response = $this->checkKeywordPatterns($keywords)) {
            return $response;
        }

        if ($response = $this->handleAccountQuestions($message, $conversationId)) {
            return $response;
        }

        if ($this->isContextualResponse($message, $conversationId)) {
            if ($response = $this->getContextualResponse($conversationId)) {
                return $response;
            }
        }

        if ($response = $this->getTrainedResponses($message, $conversationId)) {
            return $response;
        }

        // ————————————————————————————————————
        // 9. RAG AI CALL — SAFE & CLEAN
        // ————————————————————————————————————
        $category = $this->detectCategories($message)[0] ?? 'general';
        $ragResponse = $this->askRAGMicroservice($message);

        if ($ragResponse && is_string($ragResponse)) {
            $clean = trim($ragResponse);

            if (strlen($clean) > 10 && strlen($clean) < 600) {
                $lower = strtolower($clean);
                $badWords = ['error', 'exception', 'sorry', 'failed', 'problem', 'cannot', 'unable'];
                $hasBadWord = false;
                foreach ($badWords as $word) {
                    if (str_contains($lower, $word)) {
                        $hasBadWord = true;
                        break;
                    }
                }
                // commenting Learn only if clean response temporarily
                // if (!$hasBadWord) {
                //     $this->learnResponse($message, $clean, $category);
                // }
            }

            return $clean . " (powered by AI)";
        }

        // ————————————————————————————————————
        // FINAL FALLBACK
        // ————————————————————————————————————
        $this->learnResponse($message, '', $category);
        $this->updateKnowledgeBase();

        return "I'm still learning about $category questions. Our team will review this shortly.";
    }

    // ========================================================================
    // 1. EXACT + CACHED RESPONSES
    // ========================================================================
    // Already in getRuleBasedResponse()

    // ========================================================================
    // 2. LEARNED RESPONSES FROM DB (FUZZY + SCORING)
    // ========================================================================
    private function getTrainedResponses(string $message, string $conversationId): ?string
    {
        $messageWords = $this->tokenizeMessage($message);
        $detectedCategories = $this->detectCategories($message);

        if (empty($messageWords)) return null;

        // Cache all active trainings
        $allTrainings = Cache::remember('all_chatbot_trainings', 3600, function () {
            return ChatbotTraining::where('is_active', true)->get();
        });

        $scores = [];

        foreach ($allTrainings as $t) {
            $triggerWords = $this->tokenizeMessage($t->trigger);
            $keywordWords = $t->keywords ?? [];
            $docWords = array_merge($triggerWords, $keywordWords, [$t->category]);

            $overlap = count(array_intersect($messageWords, $docWords));
            $score = $overlap * 2;

            if (in_array($t->category, $detectedCategories)) {
                $score += 3;
            }

            if ($score > 0) {
                $scores[] = [
                    'response' => $t->response,
                    'score' => $score,
                    'id' => $t->id
                ];
            }
        }

        if (empty($scores)) return null;

        usort($scores, fn($a, $b) => $b['score'] <=> $a['score']);
        $best = $scores[0];

        Log::info("Best DB match", [
            'message' => $message,
            'id' => $best['id'],
            'score' => $best['score'],
            'response' => $best['response']
        ]);

        // MINIMAL FIX: Only return if response is real and not empty
        if (!empty(trim($best['response'] ?? '')) && strlen(trim($best['response'])) > 5) {
            return trim($best['response']);
        }

        // If response is empty or too short → act like nothing was found
        return null;
    }

    // ========================================================================
    // 3. DECISION TREE – ACCOUNT FLOW (FULLY IMPLEMENTED)
    // ========================================================================
    private function handleAccountQuestions(string $message, string $conversationId): ?string
    {
        $state = $this->decisionTreeState[$conversationId] ?? 'start';

        $tree = [
            'start' => [
                'pattern' => '/\b(account|profile|login|sign in|register)\b/i',
                'response' => 'What would you like to do? (update info, reset password, delete account)',
                'next' => [
                    'update' => 'update_info',
                    'info' => 'update_info',
                    'password' => 'reset_password',
                    'reset' => 'reset_password',
                    'delete' => 'delete_account',
                ]
            ],
            'update_info' => [
                'response' => 'Go to Settings > Profile > Edit',
                'next' => null
            ],
            'reset_password' => [
                'response' => 'Visit example.com/reset or use the "Forgot Password?" link',
                'next' => null
            ],
            'delete_account' => [
                'response' => 'To delete your account, go to Settings > Privacy > Delete Account. This cannot be undone.',
                'next' => null
            ]
        ];

        $node = $tree[$state] ?? null;

        // Enter tree
        if ($state === 'start' && $node && preg_match($node['pattern'], $message)) {
            $this->decisionTreeState[$conversationId] = 'start';
            return $node['response'];
        }

        // Traverse tree
        if ($node && $node['next']) {
            foreach ($node['next'] as $keyword => $nextState) {
                if (str_contains(strtolower($message), $keyword)) {
                    $this->decisionTreeState[$conversationId] = $nextState;
                    return $tree[$nextState]['response'] ?? "Done.";
                }
            }
        }

        // Exit tree after final answer
        if ($node && !$node['next']) {
            unset($this->decisionTreeState[$conversationId]);
        }

        return null;
    }

    // ========================================================================
    // 4. CONTEXTUAL MEMORY (PER CONVERSATION)
    // ========================================================================
    private function isContextualResponse(string $message, string $conversationId): bool
    {
        $lastThree = array_slice($this->conversationContext[$conversationId] ?? [], -3);
        $contextString = implode(' ', $lastThree);

        $contextTriggers = [
            'account' => ['account', 'profile', 'login', 'password', 'email'],
            'payment' => ['payment', 'bill', 'invoice', 'refund', 'charge'],
            'technical' => ['bug', 'error', 'crash', 'not working', 'issue'],
            'feature' => ['how to', 'use', 'feature', 'tutorial', 'guide']
        ];

        foreach ($contextTriggers as $context => $triggers) {
            foreach ($triggers as $trigger) {
                if (str_contains($contextString, $trigger)) {
                    $this->currentContext[$conversationId] = $context;
                    return true;
                }
            }
        }

        return false;
    }

    private function getContextualResponse(string $conversationId): ?string
    {
        $context = $this->currentContext[$conversationId] ?? null;
        $lastMessages = array_slice($this->conversationContext[$conversationId] ?? [], -3);

        if (!$context) return null;

        switch ($context) {
            case 'account':
                if ($this->containsAny($lastMessages, ['password', 'reset'])) {
                    return 'Reset password: Settings > Security > Change Password';
                }
                if ($this->containsAny($lastMessages, ['email', 'verify'])) {
                    return 'Verify email: Check spam or resend from Settings > Account';
                }
                return 'Account help: update profile, reset password, or delete account';

            case 'payment':
                if ($this->containsAny($lastMessages, ['refund', 'return'])) {
                    return 'Refunds take 5–7 days. Contact support@example.com';
                }
                return 'Billing: View invoices in Settings > Billing';

            case 'technical':
                return 'Please share: device, app version, and exact error';

            case 'feature':
                return 'Ask about any feature: upload, share, notifications, etc.';
        }

        return null;
    }

    // Helper
    private function containsAny(array $haystack, array $needles): bool
    {
        foreach ($needles as $needle) {
            foreach ($haystack as $item) {
                if (str_contains($item, $needle)) return true;
            }
        }
        return false;
    }

    // ========================================================================
    // 5. LEARNING + NOTIFICATIONS (UNCHANGED LOGIC)
    // ========================================================================
    private function learnResponse(string $message, string $response = '', string $category = null): void
    {
        $analysis = $this->analyzeMessage($message);
        $category = $category ?? $this->detectCategories($message)[0] ?? 'general';

        $existing = ChatbotTraining::where('trigger', 'like', "%$message%")
            ->when($category, fn($q) => $q->where('category', $category))
            ->first();

        if ($existing) {
            if ($existing->needs_review && empty($response)) {
                $this->sendChatbotNotifications($message, $category, $analysis['keywords']);
                event(new \App\Events\ChatbotTrainingNeeded($message, $category, $analysis['keywords']));
            }
            return;
        }

        $training = ChatbotTraining::create([
            'trigger' => $message,
            'response' => $response,
            'keywords' => $analysis['keywords'],
            'category' => $category,
            'needs_review' => empty($response),
            'trained_by' => auth()->id() ?? null,
            'is_active' => !empty($response)
        ]);

        if (empty($response)) {
            $this->sendChatbotNotifications($message, $category, $analysis['keywords']);
            event(new \App\Events\ChatbotTrainingNeeded($message, $category, $analysis['keywords']));
        }

        cache()->forget('learned_responses');
        cache()->forget('all_chatbot_trainings');
    }

    private function sendChatbotNotifications(string $message, string $category, array $keywords): void
    {
        try {
            $usersToNotify = User::where('ai_admin', true)->get();

            if ($usersToNotify->count() > 0) {
                \Illuminate\Support\Facades\Notification::send(
                    $usersToNotify,
                    new \App\Notifications\ChatbotTrainingNeeded($message, $category, $keywords)
                );
            }
        } catch (\Exception $e) {
            Log::error("Notification failed", ['error' => $e->getMessage()]);
        }
    }

    // ========================================================================
    // 6. NLP: TOKENIZE, SENTIMENT, CATEGORIES
    // ========================================================================
    private function analyzeMessage(string $message): array
    {
        $words = preg_split('/\s+/', strtolower($message));
        $stopWords = ['the', 'a', 'an', 'is', 'are', 'i', 'you', 'we', 'to', 'my', 'can', 'it', 'and', 'or', 'but', 'in', 'on', 'at'];
        $filtered = array_diff($words, $stopWords);

        $positive = ['happy', 'good', 'great', 'thanks', 'thank', 'awesome', 'excellent'];
        $negative = ['angry', 'bad', 'wrong', 'broken', 'issue', 'problem', 'fail', 'error'];

        $sentiment = 'neutral';
        foreach ($filtered as $word) {
            if (in_array($word, $positive)) $sentiment = 'positive';
            if (in_array($word, $negative)) $sentiment = 'negative';
        }

        return [
            'keywords' => array_values(array_unique($filtered)),
            'sentiment' => $sentiment
        ];
    }

    private function tokenizeMessage(string $message): array
    {
        $message = strtolower(preg_replace('/[^a-z0-9\s]/', '', $message));
        $words = preg_split('/\s+/', trim($message));
        $stopWords = ['the', 'a', 'an', 'is', 'are', 'i', 'you', 'we', 'to', 'my', 'can', 'it', 'and', 'explain', 'or', 'but', 'in', 'on', 'at'];
        return array_values(array_unique(array_diff($words, $stopWords)));
    }

    private function detectCategories(string $message): array
    {
        $categories = ['account', 'payment', 'post', 'feature', 'technical'];
        $found = [];
        foreach ($categories as $cat) {
            if (stripos($message, $cat) !== false) $found[] = $cat;
        }
        return $found;
    }

    // ========================================================================
    // 7. KEYWORD PATTERNS
    // ========================================================================
    private function checkKeywordPatterns(array $keywords): ?string
    {
        $patterns = [
            ['keywords' => ['hello', 'hi', 'hey'], 'response' => 'Hello there! How can I help you today?', 'priority' => 1],
            ['keywords' => ['thank', 'thanks'], 'response' => 'You\'re very welcome! Let me know if you need anything else.', 'priority' => 1],
            ['keywords' => ['account', 'profile', 'login'], 'response' => 'For account help: go to Settings > Account', 'priority' => 3],
            ['keywords' => ['payment', 'bill', 'refund'], 'response' => 'Payment support: visit Settings > Billing', 'priority' => 3],
            ['keywords' => ['bug', 'error', 'crash'], 'response' => 'Technical support: please describe your device and app version', 'priority' => 4],
        ];

        usort($patterns, fn($a, $b) => $b['priority'] <=> $a['priority']);

        foreach ($patterns as $p) {
            foreach ($keywords as $kw) {
                if (in_array($kw, $p['keywords'])) {
                    return $p['response'];
                }
            }
        }

        return null;
    }

    // ========================================================================
    // 8. AI FALLBACK (INSIDE RULE-BASED)
    // ========================================================================
    private function getAIResponse(string $message): ?string
    {
        try {
            $apiKey = config('services.openai.key');
            if (!$apiKey) return null;

            $response = Http::timeout(10)->withHeaders([
                'Authorization' => 'Bearer ' . $apiKey,
            ])->post('https://api.openai.com/v1/chat/completions', [
                'model' => 'gpt-3.5-turbo',
                'messages' => [['role' => 'user', 'content' => $message]],
                'temperature' => 0.7,
                'max_tokens' => 150
            ]);

            return $response->json('choices.0.message.content') ?? null;
        } catch (\Exception $e) {
            Log::warning("AI fallback failed", ['error' => $e->getMessage()]);
            return null;
        }
    }

    // ========================================================================
    // 9. AUTO-APPROVE SIMPLE QUESTIONS
    // ========================================================================
    private function isSimpleQuestion(string $message): bool
    {
        $message = strtolower($message);
        $questionWords = ['how', 'what', 'where', 'when', 'why', 'can', 'does', 'is'];
        $hasQuestion = count(array_intersect(
            preg_split('/\s+/', $message),
            $questionWords
        )) > 0;

        return strlen($message) < 80 && $hasQuestion;
    }

    // ========================================================================
    // 10. MEMORY CLEANUP
    // ========================================================================
    private function cleanOldContext(string $conversationId): void
    {
        if (!isset($this->conversationContext[$conversationId])) return;

        // Keep last 10 messages
        $this->conversationContext[$conversationId] = array_slice(
            $this->conversationContext[$conversationId], -10
        );

        // Clear after 30 minutes
        if (time() - ($this->contextTimestamps[$conversationId] ?? 0) > 1800) {
            unset($this->conversationContext[$conversationId]);
            unset($this->currentContext[$conversationId]);
            unset($this->decisionTreeState[$conversationId]);
            unset($this->contextTimestamps[$conversationId]);
        }
    }
    
    // ========================================================================
    // 11. RAG MICROSERVICE INTEGRATION
    // ========================================================================
private function askRAGMicroservice(string $message): ?string
{
    $maxRetries = 2;
    $retryDelay = 1000; // milliseconds
    
    for ($attempt = 0; $attempt < $maxRetries; $attempt++) {
        try {
            if ($attempt > 0) {
                // Wait before retry
                usleep($retryDelay * 1000);
                \Log::info("Retrying RAG request", [
                    'attempt' => $attempt + 1,
                    'message' => $message
                ]);
            }
            
            // Use persistent connection with proper timeouts
            $response = \Illuminate\Support\Facades\Http::withOptions([
                'connect_timeout' => 10,  // Connection timeout
                'timeout' => 15,          // Response timeout (increased)
                'verify' => false,        // For local development only
            ])
            ->retry(1, 100) // Retry once after 100ms
            ->post('http://127.0.0.1:8001/chat', [
                'question' => trim($message)
            ]);

            if ($response->successful()) {
                $data = $response->json();
                $answer = $data['answer'] ?? null;
                
                if ($answer) {
                    \Log::info("RAG service successful", [
                        'message' => $message,
                        'answer_length' => strlen($answer),
                        'attempt' => $attempt + 1
                    ]);
                    return $answer;
                }
            } else {
                \Log::warning("RAG service error", [
                    'status' => $response->status(),
                    'body' => $response->body(),
                    'attempt' => $attempt + 1
                ]);
            }
            
        } catch (\Illuminate\Http\Client\ConnectionException $e) {
            \Log::warning("RAG connection failed", [
                'error' => $e->getMessage(),
                'attempt' => $attempt + 1
            ]);
        } catch (\Exception $e) {
            \Log::error("RAG microservice error", [
                'error' => $e->getMessage(),
                'attempt' => $attempt + 1
            ]);
            
            // If it's a timeout, try again
            if (str_contains($e->getMessage(), 'timed out')) {
                continue;
            }
            
            // For other errors, break
            break;
        }
    }
    
    \Log::error("All RAG attempts failed", ['message' => $message]);
    return null;
}
    // ========================================================================
private function updateKnowledgeBase(): void
{
    try {
        $entries = ChatbotTraining::where('is_active', true)
            ->whereNotNull('response')
            ->where('response', '!=', '')
            ->get();

        $docs = $entries->map(fn($e) => [
            "text" => "Question: {$e->trigger}\nAnswer: {$e->response}",
            "source" => "trained_data"
        ])->toArray();

        $path = base_path('../python-ai-service/knowledge.json'); // ← correct path

        // Create directory if missing
        $dir = dirname($path);
        if (!is_dir($dir)) mkdir($dir, 0755, true);

        file_put_contents($path, json_encode($docs, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
    } catch (\Throwable $e) {
        \Log::warning("Could not update knowledge.json", ['error' => $e->getMessage()]);
        // ← Does NOT crash the chatbot
    }
}


    // ========================================================================
    // LEGACY / UNUSED (KEPT FOR COMPATIBILITY)
    // ========================================================================
    private function notifyAdmins(string $message): void
    {
        $admins = User::where('email', 'xusrew@yahoo.com')->get();
        foreach ($admins as $admin) {
            $admin->notify(new ChatbotTrainingNeeded($message));
        }
        event(new ChatbotTrainingNeeded($message));
    }

    private function checkKeywordPatterns2(array $keywords): ?string
    {
        $groups = [
            'greetings' => ['hello', 'hi', 'hey'],
            'thanks' => ['thank', 'thanks'],
            'account' => ['account', 'profile', 'login'],
        ];
        foreach ($keywords as $kw) {
            foreach ($groups as $response) {
                if (in_array($kw, $response)) {
                    return "$response response";
                }
            }
        }
        return null;
    }
}