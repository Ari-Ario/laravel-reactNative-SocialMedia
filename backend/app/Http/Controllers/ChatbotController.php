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
        $ragResult = $this->askRAGMicroservice($message);

        if ($ragResult['success']) {
            $answer = $ragResult['answer'];
            $confidence = $ragResult['confidence'] ?? 0;
            $isFallback = $ragResult['is_fallback'] ?? false;
            
            if (!$isFallback && $confidence >= 0.6) {
                // Good match - return answer
                return $answer . " (powered by AI)";
            } else {
                // Low confidence or fallback - trigger learning
                $this->learnResponse($message, '', $category);
                return "I'm still learning about $category questions...";
            }
        } else {
            // RAG failed - trigger learning
            $this->learnResponse($message, '', $category);
            return "I'm still learning about $category questions...";
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
        $stopWords = [
            // Basic English stop words
            "a","about","above","after","again","against","all","am","an","and","any",
            "are","aren","as","at","be","because","been","before","being","below",
            "between","both","but","by","can","cannot","could","couldn","did","didn",
            "do","does","doesn","doing","don","down","during","each","few","for",
            "from","further","had","hadn","has","hasn","have","haven","having","he",
            "her","here","hers","herself","him","himself","his","how","i","if","in",
            "into","is","isn","it","its","itself","just","ll","me","might","mightn",
            "more","most","must","mustn","my","myself","needn","no","nor","not","now",
            "of","off","on","once","only","or","other","our","ours","ourselves","out",
            "over","own","re","s","same","shan","she","should","shouldn","so","some",
            "such","t","than","that","the","their","theirs","them","themselves","then",
            "there","these","they","this","those","through","to","too","under",
            "until","up","ve","very","was","wasn","we","were","weren","what","when",
            "where","which","while","who","whom","why","will","with","won","would",
            "wouldn","you","your","yours","yourself","yourselves",

            // Contractions & chat shorthand
            "im","i'm","ive","i’ve","you're","youre","youve","you’ve","we're","weve",
            "theyre","they're","theyve","they’ve","can't","dont","won't","didn't",
            "doesn't","isn't","aren't","wasn't","weren't","shouldn't","couldn't",
            "wouldn't","mustn't","shan't","ain","ma",

            // Fillers / meaningless in chat queries
            "hey","hi","hello","yo","ok","okay","hmm","uh","um","oh","ah","well",
            "please","pls","tho","though","btw","asap","haha","lol","lmao",

            // Polite / irrelevant to intent
            "thanks","thank","thankyou","thx","regards","kind","dear",
            "sorry","pardon", "excuse", "sir","madam", "mr","mrs","ms",
            "greetings","welcome", "appreciate","appreciated", "gratitude",

            // Common question filler words
            "tell","explain","define","about","say","me","just","really","basically",
            "actually","kinda","sorta", "like","thing","stuff","anything","everything",
            "some","more","less","bit","lot","lots","part","parts", "way","ways",

            // Noise tokens (common mistakes)
            "y","d","ll","t","ve","re","m", "s","n", "em", "'", "’", "“","”","\"",

            // Non-meaningful pronouns / determiners
            "this","that","these","those","here","there", "anyone","anybody","someone",
            "somebody","everyone","everybody","nobody","noone","none","all","both", "each",
            "either","neither","one","ones","others", "whose", 
        ];

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
        $categories = [
            // Core app & support
            'account', 'advertising', 'api', 'app', 'backup', 'block', 'bug',
            'cancellation', 'comment', 'crash', 'data', 'desktop', 'download',
            'error', 'faq', 'feature', 'follow', 'guide', 'how-to', 'integration',
            'like', 'login', 'mobile', 'notification', 'payment', 'performance',
            'post', 'privacy', 'profile', 'refund', 'report', 'restore', 'security',
            'settings', 'share', 'speed', 'storage', 'subscription', 'technical',
            'third-party', 'trial', 'unfollow', 'upload', 'web',

            // Technology
            'algorithms', 'analytics', 'android', 'api development',
            'artificial intelligence', 'augmented reality',
            'automation', 'big data', 'blockchain', 'cloud computing',
            'computing', 'computer science', 'crypto', 'cryptography',
            'cybersecurity', 'data engineering', 'data science', 'databases',
            'deep learning', 'devops', 'digital marketing', 'e-commerce',
            'frontend development', 'full-stack development', 'gaming',
            'hardware', 'iot', 'javascript', 'machine learning', 'mobile apps',
            'networking', 'programming', 'quantum computing', 'robotics',
            'software', 'software development', 'system administration',
            'ui design', 'ux design', 'virtual reality', 'web development',

            // Science fields
            'astronomy', 'astrophysics', 'biology', 'biotechnology',
            'chemistry', 'climate science', 'cosmology', 'ecology',
            'environmental science', 'evolution', 'genetics', 'geology',
            'life sciences', 'marine biology', 'mathematics', 'meteorology',
            'nanotechnology', 'neuroscience', 'oceanography', 'physics',
            'planetary science', 'space science',

            // Health & medicine
            'anatomy', 'cardiology', 'dentistry', 'disease', 'fitness',
            'health', 'immunology', 'medical technology', 'medicine',
            'mental health', 'microbiology', 'nutrition', 'pharmacology',
            'physiology', 'public health',

            // Social sciences
            'anthropology', 'archaeology', 'communication', 'criminology',
            'economics', 'education', 'finance', 'geography',
            'history', 'international relations', 'law',
            'linguistics', 'management', 'marketing', 'philosophy',
            'political science', 'psychology', 'social science', 'sociology',

            // Humanities & Arts
            'architecture', 'art', 'aesthetics', 'culture', 'dance',
            'design', 'film', 'language', 'literature', 'logic',
            'media', 'music', 'painting', 'photography', 'poetry',
            'theatre', 'visual arts', 'writing',

            // Business & professional
            'accounting', 'business', 'business strategy', 'entrepreneurship',
            'human resources', 'investment', 'leadership', 'management consulting',
            'project management', 'real estate', 'sales', 'startups',

            // Geography & environment
            'climate', 'cities', 'countries', 'ecosystems',
            'environment', 'mountains', 'natural resources',
            'oceans', 'rivers', 'space', 'travel',

            // Modern fields
            '3d printing', 'aerospace', 'agriculture', 'analytics',
            'bioinformatics', 'cloud security', 'communication technology',
            'data privacy', 'digital art', 'digital transformation',
            'energy', 'green technology', 'renewable energy',
            'space technology',

            // Extras / general topics
            'education technology', 'ethics', 'food science', 'gaming industry',
            'history of science', 'information systems', 'knowledge',
            'language learning', 'machine vision', 'mobility tech',
            'nanomaterials', 'open source', 'product design', 'research',
            'smart cities', 'statistics', 'transportation', 'video production'
        ];

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
private function askRAGMicroservice(string $message): array
{
    $maxRetries = 2;
    $retryDelay = 1000;
    
    for ($attempt = 0; $attempt < $maxRetries; $attempt++) {
        try {
            if ($attempt > 0) {
                usleep($retryDelay * 1000);
                \Log::info("Retrying RAG request", [
                    'attempt' => $attempt + 1,
                    'message' => $message
                ]);
            }
            
            $response = \Illuminate\Support\Facades\Http::withOptions([
                'connect_timeout' => 10,
                'timeout' => 15,
                'verify' => false,
            ])
            ->retry(1, 100)
            ->post('http://127.0.0.1:8001/chat', [
                'question' => trim($message)
            ]);

            if ($response->successful()) {
                $data = $response->json();
                $answer = $data['answer'] ?? null;
                $confidence = $data['confidence'] ?? 0;
                
                if ($answer) {
                    \Log::info("RAG service successful", [
                        'message' => $message,
                        'confidence' => $confidence,
                        'answer_length' => strlen($answer)
                    ]);
                    
                    return [
                        'answer' => $answer,
                        'confidence' => $confidence,
                        'success' => true
                    ];
                }
            }
            
        } catch (\Exception $e) {
            \Log::warning("RAG attempt failed", [
                'error' => $e->getMessage(),
                'attempt' => $attempt + 1
            ]);
        }
    }
    
    return [
        'answer' => null,
        'confidence' => 0,
        'success' => false
    ];
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