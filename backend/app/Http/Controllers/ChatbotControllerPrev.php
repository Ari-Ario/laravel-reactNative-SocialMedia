<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;

use App\Models\ChatbotTraining;
use App\Models\User;
use App\Notifications\ChatbotTrainingNeeded;
use App\Events\ChatbotTrainingNeeded as ChatbotTrainingNeededEvent;

class ChatbotController extends Controller
{
    // Contextual memory variables
    private $conversationContext = [];
    private $currentContext = null;
    
    public function handleMessage(Request $request)
    {
        $request->validate([
            'message' => 'required|string',
            'conversation_id' => 'nullable|string' // For maintaining conversation context
        ]);

        $message = strtolower(trim($request->message));
        // Add to conversation history
        $this->conversationContext[] = $message;

        // Option 1: Simple rule-based responses
        $response = $this->getRuleBasedResponse($request->message);
        
        // Option 2: Integrate with an AI service (like OpenAI)
        // $response = $this->getAIResponse($request->message);

        return response()->json([
            'response' => $response,
            'conversation_id' => $request->conversation_id ?? uniqid()
        ]);
    }
        
    // Option 1: Simple rule-based responses currently using
    private function getRuleBasedResponse(string $message): string
    {
        // 1. Check exact matches
        $exactResponses = [
            'hello' => 'Hi! How can I help?',
            'hi' => 'Hi! How can I help?',
            'hey' => 'Hi! How can I help?',
            'help' => 'I can assist with account, payment, and technical questions.',
            'password' => 'You can reset your password at Settings > Security',
            'email' => 'Check your spam folder or request a new verification email',
            'refund' => 'Our refund policy allows returns within 30 days',
        ];
        
        if (isset($exactResponses[strtolower($message)])) {
            return $exactResponses[strtolower($message)];
        }
        
        // 2. Check learned responses
        $learnedResponses = cache()->get('learned_responses', []);
        if (isset($learnedResponses[$message])) {
            return $learnedResponses[$message];
        }
        
        // 3. Analyze message
        $analysis = $this->analyzeMessage($message);
        
        // 4. Handle by sentiment
        if ($analysis['sentiment'] === 'negative') {
            return "I'm sorry to hear you're having trouble. Let me help resolve this.";
        }
        
        // 5. Check keyword patterns
        if ($response = $this->checkKeywordPatterns($analysis['keywords'])) {
            return $response;
        }
        
        // 6. Check conversation context
        if ($this->isContextualResponse($message)) {
            if ($contextResponse = $this->getContextualResponse()) {
                return $contextResponse;
            }
        }
        
        // Check database first then go to step 7
        \Log::info("Processing message", ['message' => $message]);
    
        if ($response = $this->getTrainedResponses($message)) {
            return $response;
        }
        
        $analysis = $this->analyzeMessage($message);
        $category = $this->detectCategories($message)[0] ?? 'general';
        
        \Log::info("No trained response found, creating learning entry", [
            'message' => $message,
            'category' => $category,
            'keywords' => $analysis['keywords']
        ]);
        
        $this->learnResponse($message, '', $category);

        return "I'm still learning about $category questions. Our team will review this shortly.";

        // // Everything else goes to AI
        // $aiResponse = $this->getAIResponse($message);

        // return response()->json(['response' => $aiResponse]);
    }


    // Decision Tree
    private function handleAccountQuestions(string $message): string
    {
        $accountFlow = [
            'start' => [
                'pattern' => '/account|profile/',
                'response' => 'What would you like to do? (update info, reset password, delete account)',
                'next' => [
                    'update info' => 'update_info',
                    'reset password' => 'reset_password',
                    'delete account' => 'delete_account'
                ]
            ],
            'update_info' => [
                'response' => 'Go to Settings > Profile > Edit',
                'next' => null
            ],
            'reset_password' => [
                'response' => 'Visit our password reset page at example.com/reset',
                'next' => null
            ]
        ];
        
        // Implement tree traversal based on conversation history
        // ...
    }


    // Learning Capability
    private function learnResponse(string $message, string $response = '', string $category = null): void
    {
        $analysis = $this->analyzeMessage($message);
        $category = $category ?? $this->detectCategories($message)[0] ?? 'general';

        // Check for existing similar entries
        $existing = ChatbotTraining::where('trigger', 'like', "%$message%")
            ->when($category, fn($q) => $q->where('category', $category))
            ->first();
            
        if ($existing) {
            \Log::info("Similar training entry exists", [
                'message' => $message, 
                'existing_id' => $existing->id,
                'existing_needs_review' => $existing->needs_review
            ]);
            
            // If the existing entry needs review and we still don't have a response
            if ($existing->needs_review && empty($response)) {
                \Log::info("Existing entry still needs review - triggering notification");
                
                // Send notifications separately (not through the event)
                $this->sendChatbotNotifications($message, $category, $analysis['keywords']);
                
                // Still broadcast the event for real-time updates
                event(new \App\Events\ChatbotTrainingNeeded(
                    $message, 
                    $category, 
                    $analysis['keywords']
                ));
            }
            return;
        }

        // Create the training entry only if it doesn't exist
        $training = ChatbotTraining::create([
            'trigger' => $message,
            'response' => $response,
            'keywords' => $analysis['keywords'],
            'category' => $category,
            'needs_review' => empty($response),
            'trained_by' => auth()->id() ?? null
        ]);
        
        // If response is empty (needs review), notify private users and admins
        if (empty($response)) {
            \Log::info("🤖 Chatbot training needed - notifying private users and admins");
            
            // Send notifications separately
            $this->sendChatbotNotifications($message, $category, $analysis['keywords']);
            
            // Broadcast the event for real-time updates
            event(new \App\Events\ChatbotTrainingNeeded(
                $message, 
                $category, 
                $analysis['keywords']
            ));
        }
        
        // Clear cache to ensure new responses are available
        cache()->forget('learned_responses');
    }

    // Add this new method to handle notifications separately
    private function sendChatbotNotifications(string $message, string $category, array $keywords): void
    {
        try {
            \Log::info("📧 Starting separate notification process");
            
            // Get users with ai_admin = true
            $usersToNotify = \App\Models\User::where('ai_admin', true)->get();
            
            \Log::info("📧 Found users to notify", [
                'total_users' => $usersToNotify->count(),
                'user_emails' => $usersToNotify->pluck('email')->toArray(),
                'message' => $message
            ]);

            if ($usersToNotify->count() > 0) {
                \Illuminate\Support\Facades\Notification::send(
                    $usersToNotify, 
                    new \App\Notifications\ChatbotTrainingNeeded($message, $category, $keywords)
                );
                
                \Log::info("✅ Notifications sent successfully to queue");
            } else {
                \Log::warning("❌ No ai_admin users found to notify");
            }
        } catch (\Exception $e) {
            \Log::error("❌ Notification sending failed", [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);
        }
    }
    
    // Returning Learned questions 
    private function getTrainedResponses(string $message): ?string
    {
        // 1. First try exact match (properly escaped column name)
        $exactMatch = ChatbotTraining::where('is_active', true)
            ->whereRaw('LOWER(`trigger`) = ?', [strtolower($message)])
            ->first();
    
        if ($exactMatch) {
            \Log::info("Exact match found for: '$message'", [
                'id' => $exactMatch->id,
                'response' => $exactMatch->response
            ]);
            return $exactMatch->response;
        }
    
        // 2. Tokenize and analyze message
        $messageWords = $this->tokenizeMessage($message);
        $detectedCategories = $this->detectCategories($message);
        
        \Log::debug("Message analysis", [
            'message' => $message,
            'words' => $messageWords,
            'categories' => $detectedCategories
        ]);
    
        if (empty($messageWords)) {
            return null;
        }
    
        // 3. Get all potential responses with scoring
        $potentialResponses = ChatbotTraining::where('is_active', true)
            ->get()
            ->map(function ($training) use ($messageWords, $detectedCategories) {
                // Combine all matching criteria
                $trainingWords = array_merge(
                    $this->tokenizeMessage($training->trigger),
                    $training->keywords ?? [],
                    [$training->category]
                );
                
                $wordIntersection = array_intersect($messageWords, $trainingWords);
                $categoryMatch = in_array($training->category, $detectedCategories);
                
                return [
                    'response' => $training->response,
                    'score' => (count($wordIntersection) * 2) + ($categoryMatch ? 3 : 0),
                    'length' => strlen($training->trigger),
                    'id' => $training->id,
                    'category_match' => $categoryMatch
                ];
            })
            ->filter(fn($r) => $r['score'] > 0)
            ->sortBy([
                ['score', 'desc'],
                ['category_match', 'desc'], 
                ['length', 'desc']
            ]);
    
        \Log::debug("Potential responses", $potentialResponses->values()->toArray());
    
        if ($potentialResponses->isNotEmpty()) {
            $bestMatch = $potentialResponses->first();
            
            \Log::info("Best match selected", [
                'id' => $bestMatch['id'],
                'score' => $bestMatch['score'],
                'category_match' => $bestMatch['category_match'],
                'response' => $bestMatch['response']
            ]);
            
            return $bestMatch['response'];
        }
    
        \Log::info("No suitable match found for message", ['message' => $message]);
        return null;
    }
    
    private function detectCategories(string $message): array
    {
        $categories = ['account', 'payment', 'post', 'feature', 'technical'];
        $found = [];
        
        foreach ($categories as $category) {
            if (stripos($message, $category) !== false) {
                $found[] = $category;
            }
        }
        
        return $found;
    }

    // Sentiment
    // NLP 
    private function tokenizeMessage(string $message): array
    {
        $message = strtolower(trim($message));
        $words = preg_split('/\s+/', preg_replace('/[^a-z0-9\s]/', '', $message));
        
        $stopWords = ['the', 'a', 'an', 'is', 'are', 'i', 'you', 'we', 'to', 'my', 'can'];
        $words = array_diff($words, $stopWords);
        
        return array_values(array_unique(array_filter($words)));
    }

    private function analyzeMessage(string $message): array
    {
        // Tokenization
        $words = preg_split('/\s+/', strtolower($message));
        
        // Remove stop words
        $stopWords = ['the', 'a', 'is', 'are', 'i', 'you', 'we'];
        $filteredWords = array_diff($words, $stopWords);
        
        // Simple sentiment analysis
        $positiveWords = ['happy', 'good', 'great', 'thanks'];
        $negativeWords = ['angry', 'bad', 'wrong', 'broken'];
        
        $sentiment = 'neutral';
        foreach ($filteredWords as $word) {
            if (in_array($word, $positiveWords)) $sentiment = 'positive';
            if (in_array($word, $negativeWords)) $sentiment = 'negative';
        }
        
        return [
            'keywords' => array_values($filteredWords),
            'sentiment' => $sentiment
        ];
    }

    // Notification to admins
    private function notifyAdmins(string $message): void
    {
        // $admins = User::where('is_admin', true)->get();

        $admins = User::where('email', 'xusrew@yahoo.com')->get();
        
        foreach ($admins as $admin) {
            $admin->notify(new ChatbotTrainingNeeded($message));
        }
        
        // Also consider real-time notification
        // event(new ChatbotTrainingCreated($message));
        event(new ChatbotTrainingNeeded($message));
    }

    // Check keyword pattern 
    private function checkKeywordPatterns(array $keywords): ?string
    {
        $patterns = [
            [
                'keywords' => ['hello', 'hi', 'hey', 'greetings', 'good morning'],
                'response' => 'Hello there! How can I help you today?',
                'priority' => 1
            ],
            [
                'keywords' => ['account', 'profile', 'login', 'sign in', 'register'],
                'response' => 'For account help: go to Settings > Account or ask about login, password, or profile',
                'priority' => 3
            ],
            [
                'keywords' => ['payment', 'bill', 'invoice', 'refund', 'charge'],
                'response' => 'Payment support: visit Settings > Billing or ask about invoices, refunds, or charges',
                'priority' => 3
            ],
            [
                'keywords' => ['thank', 'thanks', 'appreciate', 'grateful'],
                'response' => 'You\'re very welcome! Let me know if you need anything else.',
                'priority' => 1
            ],
            [
                'keywords' => ['bug', 'error', 'crash', 'not working'],
                'response' => 'Technical support: please describe your issue including device model and app version',
                'priority' => 4
            ]
        ];

        // Sort by priority (highest first)
        usort($patterns, fn($a, $b) => $b['priority'] <=> $a['priority']);

        foreach ($patterns as $pattern) {
            foreach ($keywords as $keyword) {
                if (in_array($keyword, $pattern['keywords'])) {
                    \Log::debug("Keyword pattern matched", [
                        'keyword' => $keyword,
                        'pattern' => $pattern['keywords'],
                        'response' => $pattern['response']
                    ]);
                    return $pattern['response'];
                }
            }
        }

        return null;
    }


    // Contextual memory functions
    private function isContextualResponse(string $message): bool
    {
        // Always check against current active context first
        if ($this->currentContext) {
            return true;
        }

        $lastThreeMessages = array_slice($this->conversationContext, -3);
        $contextString = implode(' ', $lastThreeMessages);
        
        // Expanded context triggers
        $contextTriggers = [
            'account' => ['account', 'profile', 'login', 'sign in', 'register'],
            'payment' => ['payment', 'invoice', 'bill', 'credit', 'charge'],
            'technical' => ['bug', 'crash', 'error', 'not working', 'problem'],
            'feature' => ['feature', 'how to use', 'guide', 'tutorial', 'use']
        ];
        
        foreach ($contextTriggers as $context => $triggers) {
            foreach ($triggers as $trigger) {
                if (str_contains($contextString, $trigger)) {
                    $this->currentContext = $context;
                    return true;
                }
            }
        }
        
        return false;
    }
    
    private function getContextualResponse(): ?string
    {
        $lastMessages = array_slice($this->conversationContext, -3);
        
        // Account context responses
        if ($this->currentContext === 'account') {
            if (array_intersect(['password', 'reset'], $lastMessages)) {
                return 'You can reset your password at: Settings > Account > Reset Password';
            }
            if (array_intersect(['email', 'verify'], $lastMessages)) {
                return 'Check your spam folder or request a new verification email from your account settings';
            }
            return 'For account help, visit our support page or ask about: password reset, email verification, or profile changes';
        }
        
        // Payment context responses
        if ($this->currentContext === 'payment') {
            if (array_intersect(['refund', 'return'], $lastMessages)) {
                return 'Refunds are processed within 5-7 business days. Contact refunds@example.com for urgent requests';
            }
            if (array_intersect(['failed', 'declined'], $lastMessages)) {
                return 'For failed payments, please verify your card details or try an alternative payment method';
            }
            return 'For billing support, you can: check invoices in Settings > Billing, or contact payments@example.com';
        }
        
        // Technical support context
        if ($this->currentContext === 'technical') {
            if (array_intersect(['crash', 'freeze'], $lastMessages)) {
                return 'Try updating to the latest version. If crashes persist, please describe when it happens';
            }
            return 'For technical issues, please specify: device model, app version, and exact error message if available';
        }
        
        // Feature help context
        if ($this->currentContext === 'feature') {
            if (array_intersect(['how to', 'use'], $lastMessages)) {
                return 'We have video tutorials at help.example.com/videos or you can ask about specific features';
            }
            return 'Which feature do you need help with? You can ask about: uploading files, sharing, notifications, etc.';
        }
        
        print_r($lastMessages);
        // No specific context matched
        return null;
    }




    /////////// Extra Functions or similar functions but other form ////////////////

    private function checkKeywordPatterns2(array $keywords): ?string
    {
        // Define keyword groups and their responses
        $keywordGroups = [
            'greetings' => [
                'keywords' => ['hello', 'hi', 'hey', 'greetings'],
                'response' => 'Hello there! How can I help you today?'
            ],
            'thanks' => [
                'keywords' => ['thank', 'thanks', 'appreciate'],
                'response' => 'You\'re very welcome!'
            ],
            'account' => [
                'keywords' => ['account', 'profile', 'login'],
                'response' => '2-For account issues, go to Settings > Account'
            ],
            // Add more groups as needed
        ];

        // Check each keyword against all groups
        foreach ($keywords as $keyword) {
            foreach ($keywordGroups as $group) {
                if (in_array($keyword, $group['keywords'])) {
                    return $group['response'];
                }
            }
        }

        return null;
    }


    private function cleanOldContext(): void
    {
        // Keep only last 10 messages
        if (count($this->conversationContext) > 10) {
            $this->conversationContext = array_slice($this->conversationContext, -10);
        }
        
        // Clear context after 30 minutes of inactivity
        if ($this->lastMessageTime && time() - $this->lastMessageTime > 1800) {
            $this->conversationContext = [];
            $this->currentContext = null;
        }
    }

    // Option 2: Directly using or Fallback to an open AI 
    private function getAIResponse(string $message): string
    {
        $apiKey = config('services.openai.key');
        $response = Http::withHeaders([
            'Authorization' => 'Bearer ' . $apiKey,
            'Content-Type' => 'application/json'
        ])->post('https://api.openai.com/v1/chat/completions', [
            'model' => 'gpt-3.5-turbo',
            'messages' => [
                ['role' => 'user', 'content' => $message]
            ],
            'temperature' => 0.7
        ]);

        return $response->json()['choices'][0]['message']['content'] ?? 'Sorry, I encountered an error.';
    }

}