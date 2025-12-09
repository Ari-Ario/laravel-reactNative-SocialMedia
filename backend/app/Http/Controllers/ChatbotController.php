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

    private function correctMessage(string $text): string
    {
        // Trim
        $text = trim($text);
        // Replace multiple spaces
        $text = preg_replace('/\s+/', ' ', $text);

        // Capitalize first letter
        $text = ucfirst($text);

        // Add missing period if no punctuation
        // if (!preg_match('/[.!?]$/', $text)) {
        //     $text .= '.';
        // }

        // Common typo dictionary
        $typos = [
            'teh' => 'the',
            'recieve' => 'receive',
            'adress' => 'address',
            'langauge' => 'language',
            'plz' => 'please',
            'pls' => 'please',
            'thx' => 'thanks',
            'u ' => 'you ',
            'ur ' => 'your ',
            'r ' => 'are ',
            'btw' => 'by the way',
            'asap' => 'as soon as possible',
            'idk' => 'I don\'t know',
            'imo' => 'in my opinion',
            'fyi' => 'for your information',
            'gr8' => 'great',
            'l8r' => 'later',
            'b4' => 'before',
            'w/ ' => 'with ',
            'w/o ' => 'without ',
            'thier' => 'their',
            'definately' => 'definitely',
            'occured' => 'occurred',
            'seperate' => 'separate',
            'wich' => 'which',
            'wierd' => 'weird',
            'alot' => 'a lot',
        ];

        foreach ($typos as $wrong => $correct) {
            $text = preg_replace('/\b' . preg_quote($wrong, '/') . '\b/i', $correct, $text);
        }

        return $text;
    }

    public function handleMessage(Request $request)
    {
        $request->validate([
            'message' => 'required|string',
            'conversation_id' => 'nullable|string'
        ]);

        $message = $this->correctMessage($request->message);
        $hasTypo = $message !== $request->message;
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
        $response = $this->getRuleBasedResponse($message, $hasTypo, $conversationId);

        return response()->json([
            'response' => $response,
            'conversation_id' => $conversationId
        ]);
    }

    // ========================================================================
    // MAIN RESPONSE ENGINE – FULLY EXTENDED
    // ========================================================================
    private function getRuleBasedResponse(string $message, $hasTypo, string $conversationId): string
    {
        $lowerMessage = strtolower($message);

        // 1–8: All your existing fast checks (exact, cache, keywords, etc.)
        $exactResponses = [
            'hello' => 'Hi! How can I help?',
            'hi' => 'Hi! How can I help?',
            'hey' => 'Hi! How can I help?',
            'thanks' => 'You\'re welcome! Let me know if you need anything else.',
            'thank you' => 'You\'re welcome! Let me know if you need anything else.',
            'thankyou' => 'You\'re welcome! Let me know if you need anything else.',
            'help' => 'Sure! What do you need assistance with?',
            // ... keep all your existing ones
        ];

        // ————————————————————————————————————
        // 1. Direkt Exact Matches; depending on above array, no external functionslike next steps
        // ————————————————————————————————————
        if (isset($exactResponses[$lowerMessage])) {
            return $exactResponses[$lowerMessage] . " (general exact match)";
        }

        // ————————————————————————————————————
        // 2. Cached Responses
        // ————————————————————————————————————
        $learnedResponses = cache()->get('learned_responses', []);
        if (isset($learnedResponses[$lowerMessage])) {
            return $learnedResponses[$lowerMessage] . ' (from cach-memory)';
        }

        // ————————————————————————————————————
        // 3. Sentiment Analysis
        // ————————————————————————————————————
        $analysis = $this->analyzeMessage($message);
        $keywords = $analysis['keywords'];
        $sentiment = $analysis['sentiment'];

        if ($sentiment === 'negative') {
            return "I'm sorry to hear you're having trouble. Let me help resolve this.";
        }

        // ————————————————————————————————————
        // 4. Keyword Pattern Matching
        // ————————————————————————————————————
        if ($response = $this->checkKeywordPatterns($keywords)) {
            return $response . " (based on keywords)";
        }

        // ————————————————————————————————————
        // 5. Decision Tree for Account Questions
        // ————————————————————————————————————
        if ($response = $this->handleAccountQuestions($message, $conversationId)) {
            if ($hasTypo) {
                $response .= " did you mean:" . $message;
            }
            return $response;
        }
        // ————————————————————————————————————    
        // 6. Contextual Memory Check
        // ————————————————————————————————————
        if ($this->isContextualResponse($message, $conversationId)) {
            if ($response = $this->getContextualResponse($conversationId)) {
                return $response . " (based on recent context)";
            }
        }

        // ————————————————————————————————————
        // 7. Learned Responses from DB (Fuzzy + Scoring)
        // ————————————————————————————————————
        if ($response = $this->getTrainedResponses($message, $conversationId)) {
            return $response . " (from trained responses by employees)";
        }

        // ————————————————————————————————————
        // 8. Fallback to meaningless check and keywords
        // ————————————————————————————————————
        if (count($keywords) === 0) {
            return 'Could you please provide more details so I can assist you better?';
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
            return "(GPT) I'm still learning about $category questions...";
        }

        // ————————————————————————————————————
        // FINAL FALLBACK for security: Trigger learning + notify
        // ————————————————————————————————————
        $this->learnResponse($message, '', $category);
        $this->updateKnowledgeBase();

        return "I'm still learning about $category questions. Our team will review this shortly.";
    }

    // ========================================================================
    // 2. LEARNED RESPONSES FROM DB (FUZZY + SCORING)
    // ========================================================================
    private function getTrainedResponses(string $message, string $conversationId): ?string
    {
        $messageWords = $this->tokenizeMessage($message);
        $detectedCategories = $this->detectCategories($message); // e.g. ['technical']

        if (empty($messageWords)) {
            return null;
        }

        // Cache all active trainings
        $allTrainings = Cache::remember('all_chatbot_trainings', 3600, function () {
            return ChatbotTraining::where('is_active', true)->get();
        });

        $candidates = [];

        foreach ($allTrainings as $t) {
            // Fix 1: Split comma-separated categories
            $trainingCategories = array_map('trim', explode(',', $t->category ?? 'general'));
            $trainingCategories = array_filter($trainingCategories);

            $triggerWords = $this->tokenizeMessage($t->trigger);
            $keywordWords = is_array($t->keywords) ? $t->keywords : json_decode($t->keywords ?? '[]', true);
            $docWords = array_merge($triggerWords, $keywordWords, $trainingCategories);

            // Remove duplicates
            $docWords = array_unique($docWords);

            $overlap = count(array_intersect($messageWords, $docWords));
            $score = $overlap * 2.5; // Slightly higher weight per word

            // Fix 2: Category match = big bonus (even partial)
            $categoryMatched = false;
            $matchedCategory = array();
            foreach ($detectedCategories as $detected) {
                foreach ($trainingCategories as $cat) {
                    if (str_contains(strtolower($cat), strtolower($detected)) ||
                        str_contains(strtolower($detected), strtolower($cat))) {
                        $categoryMatched = true;
                        array_push($matchedCategory, $cat);
                        // break 2;
                    }
                }
            }
            $countCategory = count($matchedCategory);
            if ($countCategory > 0 && !empty($matchedCategory)) {
                foreach ($matchedCategory as $matcheCategory) {
                    $score += 4; // Bonus for each category match
                }
            }

            // Only include if has response and score > 1
            if (!empty(trim($t->response)) && $score >= 12) {
                $candidates[] = [
                    'response' => trim($t->response),
                    'score'     => $score,
                    'id'        => $t->id,
                    'trigger'   => $t->trigger,
                    'category'  => $t->category,
                    'matched_category' => $categoryMatched ? $matcheCategory : null,
                    'raw_score' => $overlap,
                ];
            }
        }

        if (empty($candidates)) {
            return null;
        }

        // Sort by score DESC
        usort($candidates, fn($a, $b) => $b['score'] <=> $a['score']);

        // Take top 3 (or less)
        $top = array_slice($candidates, 0, 3);

        // Build final response like Python version
        $parts = [];

        // 1. Always include the best one
        $parts[] = $top[0]['response'];

        // 2. Add 2nd if different
        if (isset($top[1])) {
            if (trim($top[1]['response']) !== trim($top[0]['response'])) {
                $parts[] = "Another helpful answer:\n" . $top[1]['response'];
            }
        }

        // 3. Add 3rd if different
        if (isset($top[2])) {
            if (
                trim($top[2]['response']) !== trim($top[0]['response']) &&
                (!isset($top[1]) || trim($top[2]['response']) !== trim($top[1]['response']))
            ) {
                $parts[] = "Also related:\n" . $top[2]['response'];
            }
        }
        \Log::info("Chatbot scoring", [
            'message' => $message,
            'candidates' => array_map(fn($c) => [
                'id' => $c['id'],
                'trigger' => $c['trigger'],
                'score' => $c['score'],
                'raw_score' => $c['raw_score'],
                'matched_category' => $c['matched_category'],
                // 'word_ratio' => $c['word_ratio'],
                // 'cat_match' => $c['cat_match']
            ], $candidates)
        ]);
        return implode("\n\n", $parts);
    }


    // ========================================================================
    // 3. DECISION TREE – ACCOUNT FLOW (FULLY IMPLEMENTED)
    // ========================================================================
    private function handleAccountQuestions(string $message, string $conversationId): ?string
    {
        $analysis = $this->analyzeMessage($message);
        $keywords = $analysis['keywords'] ?? []; // e.g. ['account', 'reset', 'password']
        $message = implode(' ', $keywords); // simplified message for tree traversal
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
                // this returns even a partial match like info in informatics then it goes to update_info and finall y returns "Go to Settings > Profile > Edit"
                // if (str_contains(strtolower($message), $keyword))
                if (preg_match('/\b' . preg_quote($keyword, '/') . '\b/i', $message)) {
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
        $analysis = $this->analyzeMessage($message);
        $keywords = $analysis['keywords'] ?? [];

        $contextTriggers = [
            'account' => ['account', 'profile', 'login', 'password', 'email'],
            'payment' => ['payment', 'bill', 'invoice', 'refund', 'charge'],
            'technical' => ['bug', 'error', 'crash', 'not working', 'issue'],
            'feature' => ['use', 'feature', 'tutorial', 'guide']
        ];

        foreach ($contextTriggers as $context => $triggers) {
            foreach ($triggers as $trigger) {
                // many cases where str_contains is used to find partial matches and then check if the trigger is in keywords and also if it's the first keyword and keywords length is equal to 1
                if (str_contains($contextString, $trigger) && in_array($trigger, $keywords) && count($keywords) === 1) {
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
    // 5. LEARNING + NOTIFICATIONS FOR REVIEW
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
    // analyzeMessage for interpreting a user query. sentiment + keyword extraction improves routing
    private function analyzeMessage(string $message): array
    {
        // tokenizer + stopword removal + sentiment detection + normalization
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

    // tokenizeMessage matching message to  training dataset. fewer filters = higher chance of overlap with training data triggers
    private function tokenizeMessage(string $message): array
    {
        // light tokenizer + minimal stopword removal for training matching
        $message = strtolower(preg_replace('/[^a-z0-9\s]/', '', $message));
        $words = preg_split('/\s+/', trim($message));
        $stopWords = ['the', 'a', 'an', 'is', 'are', 'i', 'you', 'we', 'to', 'my', 'can', 'it', 'and', 'explain', 'or', 'but', 'in', 'on', 'at'];
        return array_values(array_unique(array_diff($words, $stopWords)));
    }

    private function detectCategories(string $message): array
    {
        $lower = strtolower(trim($message));

        // Master category map: real category → list of trigger words/phrases
        // This is the GOLD standard for 2025 chatbots
        $categoryMap = [
            // Core app & platform
            'account'          => ['account', 'profile', 'login', 'signup', 'register', 'password', 'email verify'],
            'payment'          => ['payment', 'billing', 'subscription', 'refund', 'charge', 'paypal', 'stripe', 'invoice'],
            'technical'        => ['bug', 'error', 'crash', 'not working', 'broken', 'issue', 'slow', 'lag', 'freeze'],
            'feature'          => ['feature', 'add', 'missing', 'wish', 'request', 'idea', 'suggestion'],
            'mobile'           => ['mobile', 'app', 'android', 'ios', 'iphone', 'play store', 'app store'],
            'notification'     => ['notification', 'alert', 'bell', 'push', 'reminder'],
            'privacy'          => ['privacy', 'data', 'delete account', 'gdpr', 'personal info'],

            // Tech & Development
            'ai'               => ['ai', 'artificial intelligence', 'chatgpt', 'gpt', 'llm', 'grok', 'claude', 'gemini'],
            'machine-learning' => ['machine learning', 'ml', 'deep learning', 'neural network', 'training data'],
            'programming'      => ['programming', 'code', 'python', 'javascript', 'php', 'laravel', 'react', 'vue'],
            'web-dev'          => ['web development', 'frontend', 'backend', 'html', 'css', 'api', 'rest'],
            'cloud'            => ['cloud', 'aws', 'azure', 'google cloud', 'server', 'hosting', 'docker', 'kubernetes'],
            'security'         => ['security', 'hacking', 'cybersecurity', 'encryption', '2fa', 'password manager'],

            // Media & Arts (your film/theater test case)
            'film'             => ['film', 'movie', 'cinema', 'netflix', 'streaming', 'hollywood', 'bollywood'],
            'sci-fi'           => ['sci-fi', 'science fiction', 'scifi', 'dune', 'blade runner', 'matrix'],
            'theater'          => ['theater', 'theatre', 'play', 'stage', 'acting', 'drama', 'schauspiel'],
            'storytelling'     => ['story', 'narrative', 'plot', 'script', 'screenplay', 'writing story'],
            'director'         => ['director', 'filmmaker', 'nolan', 'scorsese', 'tarantino', 'villeneuve'],
            'documentary'      => ['documentary', 'doc', 'real story', 'true story'],

            // Science & Academia
            'physics'          => ['physics', 'quantum', 'relativity', 'einstein', 'particle'],
            'biology'          => ['biology', 'dna', 'genes', 'evolution', 'cells', 'biotech'],
            'math'            => ['math', 'mathematics', 'calculus', 'algebra', 'statistics', 'geometry'],
            'space'            => ['space', 'nasa', 'mars', 'astronomy', 'cosmos', 'black hole', 'telescope'],

            // Health & Life
            'health'           => ['health', 'fitness', 'diet', 'exercise', 'mental health', 'therapy'],
            'medicine'         => ['medicine', 'doctor', 'hospital', 'disease', 'vaccine', 'pharma'],

            // Business & Money
            'business'         => ['business', 'startup', 'entrepreneur', 'marketing', 'sales', 'money'],
            'crypto'           => ['crypto', 'bitcoin', 'ethereum', 'blockchain', 'nft', 'web3'],

            // Education & Learning
            'education'        => ['education', 'school', 'university', 'course', 'learning', 'study', 'exam'],
            'language'         => ['language', 'english', 'german', 'french', 'spanish', 'learn language'],

            // Lifestyle & Culture
            'travel'           => ['travel', 'vacation', 'flight', 'hotel', 'country', 'city'],
            'food'             => ['food', 'cooking', 'recipe', 'restaurant', 'cuisine'],
            'music'            => ['music', 'song', 'spotify', 'album', 'concert', 'band'],
            'gaming'           => ['gaming', 'game', 'playstation', 'xbox', 'nintendo', 'pc gaming'],
        ];

        $detected = [];

        foreach ($categoryMap as $category => $triggers) {
            foreach ($triggers as $trigger) {
                // Exact word or phrase match (with word boundaries)
                if (preg_match('/\b' . preg_quote($trigger, '/') . '\b/i', $message)) {
                    $detected[] = $category;
                    break; // one match per category is enough
                }
            }
        }

        // Special cases: multi-word phrases that must be together
        $specialPhrases = [
            'machine learning'     => 'machine-learning',
            'artificial intelligence' => 'ai',
            'science fiction'      => 'sci-fi',
            'web development'      => 'web-dev',
            'mental health'        => 'health',
            'data science'         => 'machine-learning',
        ];

        foreach ($specialPhrases as $phrase => $cat) {
            if (stripos($lower, $phrase) !== false) {
                $detected[] = $cat;
            }
        }

        // Remove duplicates and return
        return array_values(array_unique($detected));
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