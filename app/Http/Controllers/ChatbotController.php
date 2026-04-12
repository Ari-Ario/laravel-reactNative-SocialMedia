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
        
        // Common typo dictionary (expanded)
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
            'neccessary' => 'necessary',
            'untill' => 'until',
            'tommorow' => 'tomorrow',
            'tommorrow' => 'tomorrow',
            'accomodate' => 'accommodate',
            'acheive' => 'achieve',
            'arguement' => 'argument',
            'commited' => 'committed',
            'embarass' => 'embarrass',
            'existance' => 'existence',
            'firey' => 'fiery',
            'gauge' => 'gauge',
            'harrass' => 'harass',
            'occurence' => 'occurrence',
            'persue' => 'pursue',
            'seige' => 'siege',
            'speach' => 'speech',
            'truely' => 'truly',
            'filmz' => 'films',
            'theatre' => 'theater',
            'theather' => 'theater',
            'directer' => 'director',
            'screenplaye' => 'screenplay',
            'storey' => 'story',
            'storeytelling' => 'storytelling',
            'zmzir' => 'Zmzir',
            'vaualt' => 'Privacy Vault',
            'privcy' => 'Privacy',
            'spase' => 'Space',
            'spases' => 'Spaces',
            'chanel' => 'Channel',
            'brodcast' => 'Broadcast Hub',
            'stared' => 'Starred',
            'bookmrks' => 'Bookmarks',
            'marching' => 'matching',
            'collab' => 'Collaboration',
            'colaborate' => 'collaborate',
            'pollz' => 'Polls',
            'vot' => 'vote',
            'stori' => 'story',
            'storis' => 'stories',
            'interacton' => 'interaction',
            'segmnt' => 'segment',
            'repostd' => 'reposted',
            'rankd' => 'ranked',
            'weightd' => 'weighted',
            'activty' => 'activity',
            'recur' => 'recurring',
            'propos' => 'proposed',
            'trrust' => 'trust',
            'witboard' => 'whiteboard',
            'whitbord' => 'whiteboard',
            'whitboard' => 'whiteboard',
            'syncron' => 'synchronicity',
            'sinchronicity' => 'synchronicity',
            'synergi' => 'synergy',
            'reputaton' => 'reputation',
            'repurtation' => 'reputation',
            'scren' => 'screen',
            'shadw' => 'shadow',
            'factcheck' => 'fact check',
            'mismatch' => 'matching',
            'setings' => 'settings',
            'conainer' => 'container',
            'widt' => 'width',
            'centrd' => 'centered',
            'zentered' => 'centered',
            'inits' => 'initials',
            'fback' => 'fallback',
            'realtime' => 'real-time',
            'notif' => 'notification',
            'maxwidth' => 'maxWidth',
            'zindex' => 'zIndex',
            'isdark' => 'isDark',
            'bookmar' => 'bookmark',
            'sent icon' => 'send icon',
        ];
        
        // Word boundary replacement for all typos
        foreach ($typos as $wrong => $correct) {
            $text = preg_replace('/\b' . preg_quote($wrong, '/') . '\b/i', $correct, $text);
        }
        
        // Fix common contractions
        $contractions = [
            "cant" => "can't",
            "dont" => "don't",
            "wont" => "won't",
            "isnt" => "isn't",
            "arent" => "aren't",
            "wasnt" => "wasn't",
            "werent" => "weren't",
            "havent" => "haven't",
            "hasnt" => "hasn't",
            "hadnt" => "hadn't",
            "wouldnt" => "wouldn't",
            "shouldnt" => "shouldn't",
            "couldnt" => "couldn't",
            "mightnt" => "mightn't",
            "mustnt" => "mustn't",
            "im" => "I'm",
            "youre" => "you're",
            "hes" => "he's",
            "shes" => "she's",
            "its" => "it's",
            "were" => "we're",
            "theyre" => "they're",
            "ive" => "I've",
            "youve" => "you've",
            "weve" => "we've",
            "theyve" => "they've",
            "ill" => "I'll",
            "youll" => "you'll",
            "hell" => "he'll",
            "shell" => "she'll",
            "itll" => "it'll",
            "well" => "we'll",
            "theyll" => "they'll",
        ];
        
        foreach ($contractions as $wrong => $correct) {
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
            'zmzir' => 'Zmzir is your ultimate social experience platform, enhanced with AI for seamless communication and collaboration.',
            'privacy vault' => 'The Privacy Vault allows you to manage your visibility, birthday privacy, and account security settings. It is now part of the route-based safety system.',
            'spaces' => 'Spaces are collaboration hubs where you can chat, hold meetings, share whiteboards, and use AI assistants. Direct spaces are now unified and strictly private.',
            'protected space' => 'Protected spaces require an invitation or password to join, ensuring your discussions stay private.',
            'broadcast hub' => 'Broadcast Hub is where you can see all your active channels and announcements. Broadcasts now sync in real-time with instant chat list updates for all members.',
            'bookmarks' => 'You can save any post to your Bookmarks to view it later. Bookmarks have been moved to a dedicated route-based page in Settings for better performance.',
            'tell a friend' => 'Use the Tell a Friend feature in Settings to invite others via email or social media.',
            'settings' => 'Our Settings are now optimized for web with a 1440px max-width container and centered layout. Features like Bookmarks and AI Safety now use dedicated navigation routes.',
            'profile photo' => 'If a user has no profile photo, Zmzir now automatically generates premium initials with a sleek gradient instead of using the sender\'s photo or a generic placeholder.',
            'ai assistant' => 'Every Space can activate an AI Assistant with personalities like Creative, Analytical, or Helpful.',
            'polls' => 'Polls allow you to gather feedback in any Space. We support Single, Multiple, Ranked, and Weighted voting styles!',
            'stories' => 'Stories are ephemeral 24h updates. Use Collaborative Stories to invite others to add segments to your story chain.',
            'ai suggestions' => 'Our platform AI can suggest hashtags, questions for your posts, and even how to continue your stories.',
            'activities' => 'Collaborative Activities are events you can schedule within a Space. Support includes recurring daily, weekly, or monthly events.',
            'scheduled events' => 'You can propose or schedule activities in any Space. Manage participants, durations, and see activity metrics for your group.',
            'trust score' => 'Your Trust Score is a measure of your community standing. High scores can improve content visibility and reporting integrity.',
            'whiteboard' => 'The Collaborative Whiteboard allows real-time drawing and brainstorming in any Space. You can even see other people cursors!',
            'compliance' => 'Compliance tracking monitors violation and false report counts. You can check your own record in your Safety Settings.',
            'cursor tracking' => 'Real-time cursor tracking allows you to see exactly where your collaborators are working on the Shared Whiteboard.',
            'screen share' => 'You can toggle Screen Sharing during any Space call to present your work or review designs in real-time.',
            'mood detection' => 'Zmzir uses AI to detect the mood of your messages (Positive, Negative, or Neutral) to help better categorize interactions!',
            'reactions' => 'React to any message with emojis to keep the conversation lively! You can also see who reacted and when.',
            'forwarding' => 'You can forward messages, posts, polls, and documents to any other Space or individual contact easily.',
            'media limits' => 'We support high-quality uploads! You can share videos and files up to 40MB in any chat or post.',
            'mediaviewer' => 'The MediaViewer is our premium full-screen experience for photos and videos. It uses zIndex: 1000 for layering and supports swipe-to-dismiss. Interaction icons inside are optimized for dark backgrounds with high-contrast white and green colors.',
            'interaction layering' => 'Our portal-based layering system ensures all overlays like Comments, Reposts, and Bookmarks consistently stay on top of the MediaViewer. We use zIndex: 6000 for these high-priority interactive components.',
            'web layout' => 'Desktop web views are standardized to a 1440px maximum width and are centered horizontally. This applies to all major overlays including the MediaViewer, Comment Sheets, and Bookmark Gallery.',
            'repost logic' => 'Reposting is now more intuitive! The Repost context popup (ContextTagSelector) can be dismissed instantly by tapping anywhere on the blurred backdrop, removing the need for a manual close button.',
            'bookmark gallery' => 'The Bookmark Gallery is a high-fidelity modal that replaces the old bookmark page. It features an "Add Your Note" section for personal high-fidelity cards and categorization.',
            'unified design' => 'Zmzir uses a unified design system where all overlays are width-constrained (1440px) and centered on web, while mobile remains fully responsive and full-width.',
            'theme modes' => 'We support 4 premium modes: Light (clean aesthetic), Dark (high-contrast premium experience with #0A84FF tints), Automatic (OS-sync), and Dynamic (Android Material 3 Monet colors).',
            'repost flow' => 'Our 2024 Repost flow features a blurred backdrop that allows instant dismissal by tapping anywhere outside the selector—no close button required!',
            'unified spaces' => 'Direct spaces are now unified and strictly private. They support real-time collaboration features like shared whiteboards with living cursor tracking.',
        ];

        // ————————————————————————————————————
        // 1. Direct Exact Matches; depending on above array, no external functions like next steps
        // ————————————————————————————————————
        if (isset($exactResponses[$lowerMessage])) {
            return $exactResponses[$lowerMessage] . " (general exact match)";
        }

        // ————————————————————————————————————
        // 2. Cached Responses
        // ————————————————————————————————————
        $learnedResponses = cache()->get('learned_responses', []);
        if (isset($learnedResponses[$lowerMessage])) {
            return $learnedResponses[$lowerMessage] . ' (from cache memory)';
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
                $response .= " Did you mean: " . $message;
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
            // If the returned/stored response already mentions that it's from trained
            // responses (various wordings may be used), don't append another tag.
            // This prevents duplicate parentheticals when the DB text already
            // contains that note.
            if (preg_match('/trained\s+responses/i', $response)) {
                return $response;
            }

            return $response . " (from our trained responses by employees)";
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
        $detectedCategories = $this->detectCategories($message);

        if (empty($messageWords)) {
            return null;
        }

        // Cache all active trainings
        $allTrainings = Cache::remember('all_chatbot_trainings', 3600, function () {
            return ChatbotTraining::where('is_active', true)->get();
        });

        $candidates = [];

        // FIRST: Check for exact trigger match with typo correction
        foreach ($allTrainings as $t) {
            $normalizedMessage = strtolower(trim($this->correctMessage($message)));
            $normalizedTrigger = strtolower(trim($t->trigger));
            
            // Direct exact match
            if ($normalizedMessage === $normalizedTrigger) {
                \Log::info("Exact trigger match found", [
                    'message' => $message,
                    'trigger' => $t->trigger,
                    'response_id' => $t->id
                ]);
                return trim($t->response);
            }
            
            // Check with punctuation removed
            $cleanMessage = preg_replace('/[^\w\s]/', '', $normalizedMessage);
            $cleanTrigger = preg_replace('/[^\w\s]/', '', $normalizedTrigger);
            if ($cleanMessage === $cleanTrigger) {
                \Log::info("Exact trigger match (punctuation removed)", [
                    'message' => $message,
                    'trigger' => $t->trigger,
                    'response_id' => $t->id
                ]);
                return trim($t->response);
            }
            
            // Check if message contains trigger or vice versa (for very close matches)
            $messageWordsLower = array_map('strtolower', $messageWords);
            $triggerWords = array_map('strtolower', $this->tokenizeMessage($t->trigger));
            
            $intersection = count(array_intersect($messageWordsLower, $triggerWords));
            $minWords = min(count($messageWordsLower), count($triggerWords));
            
            // If all trigger words are in message or vice versa
            if ($minWords > 0 && $intersection == $minWords) {
                \Log::info("Complete word overlap match", [
                    'message' => $message,
                    'trigger' => $t->trigger,
                    'response_id' => $t->id
                ]);
                return trim($t->response);
            }
        }

        // Weight configuration - easily adjustable
        $wordOverlapWeight = 0.70; // 70% of total score
        $categoryMatchWeight = 0.30; // 30% of total score

        // IMPROVEMENT #1: Performance optimization - limit processing for long candidate lists
        $performanceLimit = 100; // Process maximum 100 trainings at once
        
        foreach ($allTrainings as $t) {
            // IMPROVEMENT #7: Cache processed training data
            $trainingKey = 'training_' . $t->id;
            $processedTraining = Cache::remember($trainingKey, 3600, function() use ($t) {
                $categories = array_map('trim', explode(',', $t->category ?? 'general'));
                $categories = array_filter($categories);
                
                return [
                    'categories' => $categories,
                    'trigger_words' => $this->tokenizeMessage($t->trigger),
                    'keywords' => is_array($t->keywords) ? $t->keywords : json_decode($t->keywords ?? '[]', true),
                    'category_count' => count($categories),
                ];
            });
            
            $trainingCategories = $processedTraining['categories'];
            $totalTrainingCategories = $processedTraining['category_count'];
            $triggerWords = $processedTraining['trigger_words'];
            $keywordWords = $processedTraining['keywords'];
            
            $docWords = array_merge($triggerWords, $keywordWords, $trainingCategories);
            $docWords = array_unique($docWords);
            $totalDocWords = count($docWords);

            // Calculate word overlap - IMPROVED STRATEGY
            $overlap = count(array_intersect($messageWords, $docWords));
            
            // STRATEGY 1: Trigger word focus (most important)
            $triggerOverlap = count(array_intersect($messageWords, $triggerWords));
            $triggerOverlapPercentage = count($triggerWords) > 0 
                ? ($triggerOverlap / count($triggerWords)) * 100 
                : 0;
                
            // STRATEGY 2: Message coverage (how much of user's message is covered)
            $messageCoverage = count($messageWords) > 0 
                ? ($overlap / count($messageWords)) * 100 
                : 0;
                
            // STRATEGY 3: All document words
            $allOverlapPercentage = $totalDocWords > 0 
                ? ($overlap / $totalDocWords) * 100 
                : 0;
            
            // COMBINED: Weighted average for better precision
            $wordOverlapPercentage = 
                ($triggerOverlapPercentage * 0.6) +  // 60% weight to trigger words
                ($messageCoverage * 0.3) +          // 30% weight to message coverage
                ($allOverlapPercentage * 0.1);      // 10% weight to all document words

            $wordScore = ($wordOverlapPercentage * $wordOverlapWeight) / 100;

            // Calculate category match percentage - IMPROVED with stemming
            $matchedCategories = [];
            foreach ($detectedCategories as $detected) {
                $detected = trim($detected);
                if (empty($detected)) continue;
                
                // IMPROVEMENT #3: Stem detected word
                $detectedStemmed = $this->stemWord($detected);
                $detectedLower = strtolower($detected);
                
                foreach ($trainingCategories as $cat) {
                    $cat = trim($cat);
                    if (empty($cat)) continue;
                    
                    $catStemmed = $this->stemWord($cat);
                    $catLower = strtolower($cat);
                    
                    // Check for match with multiple strategies including stemming
                    $isMatch = false;
                    
                    // 1. Exact match
                    if ($catLower === $detectedLower) {
                        $isMatch = true;
                    }
                    // 2. Stemmed match
                    elseif ($catStemmed === $detectedStemmed) {
                        $isMatch = true;
                    }
                    // 3. Contains match (but not too short to avoid false matches)
                    elseif ((str_contains($catLower, $detectedLower) || 
                        str_contains($detectedLower, $catLower)) &&
                        strlen($detected) > 2 && strlen($cat) > 2) {
                        $isMatch = true;
                    }
                    // 4. Singular/plural variations
                    elseif (($catLower === $detectedLower . 's' || 
                            $detectedLower === $catLower . 's' ||
                            $catLower === $detectedLower . 'es' || 
                            $detectedLower === $catLower . 'es') &&
                        strlen($detected) > 2) {
                        $isMatch = true;
                    }
                    
                    if ($isMatch && !in_array($cat, $matchedCategories)) {
                        $matchedCategories[] = $cat;
                    }
                }
            }

            $matchedCategoryCount = count($matchedCategories);
            $categoryMatchPercentage = $totalTrainingCategories > 0 
                ? ($matchedCategoryCount / $totalTrainingCategories) * 100 
                : ($matchedCategoryCount > 0 ? 100 : 0);
            $categoryScore = ($categoryMatchPercentage * $categoryMatchWeight) / 100;

            // Calculate total score (0-100%)
            $totalScore = ($wordScore + $categoryScore) * 100;

            // BONUS: Exact word order match in trigger
            $exactWordOrderBonus = 0;
            $messageLower = strtolower($message);
            $triggerLower = strtolower($t->trigger);
            
            // Check if message contains exact trigger phrase
            if (str_contains($messageLower, $triggerLower)) {
                $exactWordOrderBonus = 20; // Big bonus for exact phrase match
            }
            
            // Check if trigger contains exact message phrase
            elseif (str_contains($triggerLower, $messageLower)) {
                $exactWordOrderBonus = 15;
            }
            
            // Check for significant word sequence matches
            else {
                $messageWordsStr = implode(' ', array_map('strtolower', $messageWords));
                $triggerWordsStr = implode(' ', array_map('strtolower', $triggerWords));
                
                // Use similar_text for phrase similarity
                similar_text($messageWordsStr, $triggerWordsStr, $similarity);
                if ($similarity > 60) {
                    $exactWordOrderBonus = $similarity / 5; // Up to 12 bonus points
                }
            }
            
            $totalScore += $exactWordOrderBonus;
            
            // IMPROVEMENT #2: Add length normalization (prefer responses for longer queries)
            $lengthFactor = min(1.0, count($messageWords) / 20); // Normalize to 0-1
            $lengthBonus = $lengthFactor * 10; // Up to 10% bonus for longer queries
            $totalScore += $lengthBonus;
            
            // IMPROVEMENT #5: Dynamic threshold adjustment
            $dynamicThreshold = max(25, min(45, 35 - (count($messageWords) * 0.5)));
            // Shorter messages (<10 words): higher threshold (30-35)
            // Longer messages (>20 words): lower threshold (25-30)
            
            // IMPROVEMENT #6: Add response quality metrics
            $responseLength = strlen(trim($t->response));
            $responseQualityScore = min(1.0, $responseLength / 500); // Normalize
            $qualityAdjustment = 0.9 + ($responseQualityScore * 0.2); // Adjust by ±10%
            $totalScore *= $qualityAdjustment;
            
            // IMPROVEMENT #4: Add conversation context awareness
            if ($conversationId) {
                $conversationContext = $this->getConversationContext($conversationId);
                if ($conversationContext) {
                    $contextBonus = $this->calculateContextBonus($t, $conversationContext);
                    $totalScore += $contextBonus;
                }
            }

            // Only include if has response and score >= dynamic threshold
            if (!empty(trim($t->response)) && $totalScore >= $dynamicThreshold) {
                $candidates[] = [
                    'response' => trim($t->response),
                    'score'     => $totalScore,
                    'id'        => $t->id,
                    'trigger'   => $t->trigger,
                    'category'  => $t->category,
                    'matched_category' => !empty($matchedCategories) ? implode(', ', $matchedCategories) : null,
                    'word_overlap_percentage' => $wordOverlapPercentage,
                    'trigger_overlap_percentage' => $triggerOverlapPercentage,
                    'message_coverage_percentage' => $messageCoverage,
                    'category_match_percentage' => $categoryMatchPercentage,
                    'matched_category_count' => $matchedCategoryCount,
                    'total_training_categories' => $totalTrainingCategories,
                    'total_doc_words' => $totalDocWords,
                    'exact_order_bonus' => $exactWordOrderBonus,
                    'length_bonus' => $lengthBonus,
                    'quality_adjustment' => $qualityAdjustment,
                    'dynamic_threshold' => $dynamicThreshold,
                ];
            }
            
            // IMPROVEMENT #1: Performance optimization - stop if too many candidates
            if (count($candidates) > 50) {
                // Sort and keep only top 30 for further processing
                usort($candidates, fn($a, $b) => $b['score'] <=> $a['score']);
                $candidates = array_slice($candidates, 0, 30);
                break; // Stop processing more trainings
            }
        }

        if (empty($candidates)) {
            \Log::info("No trained responses found for message", [
                'message' => $message,
                'detected_categories' => $detectedCategories,
                'word_count' => count($messageWords)
            ]);
            return null; // Let GPT handle it
        }

        // IMPROVED TIERED SORTING
        $filteredCandidates = [];

        foreach ($candidates as $candidate) {
            // Tier 1: High trigger overlap (> 75%) OR exact word order bonus
            if ($candidate['trigger_overlap_percentage'] > 75 || $candidate['exact_order_bonus'] > 15) {
                $candidate['tier'] = 1;
                $candidate['tier_score'] = 
                    ($candidate['trigger_overlap_percentage'] * 1000) + 
                    ($candidate['exact_order_bonus'] * 500) + 
                    $candidate['score'];
                $filteredCandidates[] = $candidate;
            }
            // Tier 2: Good word overlap (> 60%)
            elseif ($candidate['word_overlap_percentage'] > 60) {
                $candidate['tier'] = 2;
                $candidate['tier_score'] = 
                    ($candidate['word_overlap_percentage'] * 100) + 
                    ($candidate['trigger_overlap_percentage'] * 50) + 
                    $candidate['score'];
                $filteredCandidates[] = $candidate;
            }
            // Tier 3: Medium word overlap (> 40%)
            elseif ($candidate['word_overlap_percentage'] > 40) {
                $candidate['tier'] = 3;
                $candidate['tier_score'] = 
                    ($candidate['word_overlap_percentage'] * 50) + 
                    ($candidate['category_match_percentage'] * 25) + 
                    $candidate['score'];
                $filteredCandidates[] = $candidate;
            }
            // Tier 4: Low word overlap (≤ 40%) - EXCLUDED FROM RESULTS
            else {
                // Do not add to filtered candidates - they're too low quality
                \Log::debug("Excluding low quality candidate", [
                    'id' => $candidate['id'],
                    'trigger' => $candidate['trigger'],
                    'word_overlap' => $candidate['word_overlap_percentage'],
                    'score' => $candidate['score']
                ]);
                // Skip this candidate completely
                continue;
            }
        }

        // Replace original candidates with filtered ones
        $candidates = $filteredCandidates;

        // Check if we have any candidates left after filtering
        if (empty($candidates)) {
            \Log::info("No quality trained responses found after filtering", [
                'message' => $message,
                'detected_categories' => $detectedCategories,
                'original_candidates_count' => count($filteredCandidates),
                'filtered_out' => count($filteredCandidates) - count($candidates)
            ]);
            return null; // Let GPT handle it
        }

        // Sort by tier first, then tier score
        usort($candidates, function($a, $b) {
            // Compare tiers
            if ($a['tier'] !== $b['tier']) {
                return $a['tier'] <=> $b['tier']; // Lower tier number = better
            }
            // Same tier, compare tier score
            return $b['tier_score'] <=> $a['tier_score'];
        });

        // Take top 3 (or less)
        $top = array_slice($candidates, 0, 3);

        // Build final response
        $parts = [];
        $parts[] = $top[0]['response'];

        if (isset($top[1])) {
            if (trim($top[1]['response']) !== trim($top[0]['response'])) {
                $parts[] = "Another helpful answer:\n" . $top[1]['response'];
            }
        }

        if (isset($top[2])) {
            if (trim($top[2]['response']) !== trim($top[0]['response']) &&
                (!isset($top[1]) || trim($top[2]['response']) !== trim($top[1]['response']))) {
                $parts[] = "Also related:\n" . $top[2]['response'];
            }
        }

        // Enhanced logging with IMPROVEMENT #9: Heatmap breakdown
        \Log::info("Chatbot scoring", [
            'message' => $message,
            'detected_categories' => $detectedCategories,
            'scoring_config' => [
                'word_overlap_weight' => $wordOverlapWeight,
                'category_match_weight' => $categoryMatchWeight,
                'dynamic_threshold_applied' => 'yes',
            ],
            'scoring_breakdown' => [
                'word_overlap_base' => round($wordOverlapPercentage, 2) . '%',
                'word_overlap_weighted' => round($wordScore * 100, 2) . '%',
                'category_base' => round($categoryMatchPercentage, 2) . '%',
                'category_weighted' => round($categoryScore * 100, 2) . '%',
                'exact_order_bonus' => round($exactWordOrderBonus, 2),
                'length_bonus' => round($lengthBonus, 2),
                'quality_adjustment' => round($qualityAdjustment, 3),
                'final_score' => round($totalScore, 2) . '%',
            ],
            'candidates' => array_map(fn($c) => [
                'id' => $c['id'],
                'trigger' => $c['trigger'],
                'tier' => $c['tier'],
                'total_score' => round($c['score'], 2) . '%',
                'word_overlap' => round($c['word_overlap_percentage'], 2) . '%',
                'trigger_overlap' => round($c['trigger_overlap_percentage'], 2) . '%',
                'message_coverage' => round($c['message_coverage_percentage'], 2) . '%',
                'category_match' => round($c['category_match_percentage'], 2) . '%',
                'exact_order_bonus' => round($c['exact_order_bonus'], 2),
                'length_bonus' => round($c['length_bonus'], 2),
                'matched_categories' => $c['matched_category'],
                'category_stats' => "{$c['matched_category_count']}/{$c['total_training_categories']}",
            ], $candidates),
            'top_selected' => array_map(fn($c) => [
                'id' => $c['id'],
                'trigger' => $c['trigger'],
                'score' => round($c['score'], 2) . '%',
                'tier' => $c['tier']
            ], $top)
        ]);

        return implode("\n\n", $parts);
    }

    // NEW HELPER METHODS TO ADD TO YOUR CLASS:

    /**
     * IMPROVEMENT #3: Simple word stemming
     */
    private function stemWord($word)
    {
        $word = strtolower(trim($word));
        
        // Common English plural/singular patterns
        $patterns = [
            '/(ies|ied)$/' => 'y',
            '/(es|ed|ing|s)$/' => '',
            '/(ational|tional|enci|anci)$/' => '',
            '/(izer|ization)$/' => 'ize',
        ];
        
        foreach ($patterns as $pattern => $replacement) {
            $word = preg_replace($pattern, $replacement, $word);
        }
        
        return $word;
    }

    /**
     * IMPROVEMENT #4: Get conversation context from your class property
     */
    private function getConversationContext($conversationId)
    {
        // Use your existing conversationContext property instead of a Conversation model
        if (isset($this->conversationContext[$conversationId])) {
            return $this->conversationContext[$conversationId];
        }
        return [];
    }

    /**
     * IMPROVEMENT #4: Calculate context bonus
     */
    private function calculateContextBonus($training, $conversationContext)
    {
        if (empty($conversationContext)) {
            return 0;
        }
        
        $bonus = 0;
        $contextText = implode(' ', $conversationContext);
        $contextWords = $this->tokenizeMessage($contextText);
        
        // Check if training content appears in recent context
        // Handle both string (JSON) and array formats for keywords
        $keywords = $training->keywords;
        if (is_string($keywords)) {
            $keywordWords = json_decode($keywords ?? '[]', true) ?: [];
        } else {
            $keywordWords = is_array($keywords) ? $keywords : [];
        }
        
        $trainingWords = array_merge(
            $this->tokenizeMessage($training->trigger),
            $keywordWords,
            array_map('trim', explode(',', $training->category ?? ''))
        );
        
        $contextOverlap = count(array_intersect($contextWords, $trainingWords));
        if ($contextOverlap > 0) {
            $bonus = min(15, $contextOverlap * 3); // Up to 15 bonus points
        }
        
        return $bonus;
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
                    'privacy' => 'privacy_start',
                    'settings' => 'settings_start',
                    'theme' => 'settings_theme',
                    'polls' => 'polls_start',
                    'stories' => 'stories_platform_start',
                    'ai' => 'ai_platform_start',
                    'activities' => 'activities_start',
                    'safety' => 'safety_trust_start',
                    'sync' => 'sync_collaboration_start',
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
            ],
            // --- SPACES BRANCH ---
            'spaces_start' => [
                'pattern' => '/\b(space|spaces|collab)\b/i',
                'response' => 'Zmzir Spaces are for everyone! Do you want to know about "space types", "ai assistants", or "how to join"?',
                'next' => [
                    'types' => 'space_types',
                    'ai' => 'space_ai',
                    'join' => 'space_join',
                ]
            ],
            'space_types' => [
                'response' => 'We have: Channels (public), Protected (private), Direct (1-on-1), and Creative (Whiteboard/Meeting) spaces.',
                'next' => null
            ],
            'space_ai' => [
                'response' => 'Every Space can activate an AI Assistant. You can choose personalities like Helpful, Analytical, or Creative to assist your group.',
                'next' => null
            ],
            'space_join' => [
                'response' => 'You can join a space via a direct invitation link or by searching for public channels in the Discover tab.',
                'next' => null
            ],
            // --- POSTS BRANCH ---
            'posts_start' => [
                'pattern' => '/\b(post|posts|share|upload|repost|media|segment)\b/i',
                'response' => 'Ready to share? Ask about "repost logic", "media viewer", "bookmark gallery", or "location tagging".',
                'next' => [
                    'repost' => 'post_repost_logic',
                    'viewer' => 'post_media_viewer',
                    'bookmark' => 'post_bookmark_gallery',
                    'location' => 'post_location',
                    'trim' => 'post_trim',
                    'bookmarks' => 'post_bookmarks',
                ]
            ],
            'post_trim' => [
                'response' => 'When uploading a video, use the slider to trim the start and end points before hitting Post.',
                'next' => null
            ],
            'post_location' => [
                'response' => 'Tap the location icon when creating a post to tag where you are. It helps others discover your content!',
                'next' => null
            ],
            'post_bookmarks' => [
                'response' => 'Saved items are in Settings > Bookmarks. You can also organize them into specific collections.',
                'next' => null
            ],
            // --- PRIVACY BRANCH ---
            'privacy_start' => [
                'pattern' => '/\b(privacy|vault|secret|visibility)\b/i',
                'response' => 'Privacy is our priority. Do you need help with "vault settings", "birthday visibility", or "private mode"?',
                'next' => [
                    'vault' => 'privacy_vault',
                    'birthday' => 'privacy_birthday',
                    'private' => 'privacy_mode',
                ]
            ],
            'privacy_vault' => [
                'response' => 'The Privacy Vault in Settings lets you secure specific chats and media behind a secondary password.',
                'next' => null
            ],
            'privacy_birthday' => [
                'response' => 'You can hide your birthday or change who sees it in Settings > Privacy > Birthday Visibility.',
                'next' => null
            ],
            'privacy_mode' => [
                'response' => 'Private Mode hides your online status and read receipts. Toggle it in your Privacy Settings.',
                'next' => null
            ],
            // --- SETTINGS BRANCH ---
            'settings_start' => [
                'pattern' => '/\b(settings|options|customize|setup|theme)\b/i',
                'response' => 'Everything is customizable! Ask about "linked devices", "theme modes", "storage cleanup", or "tell a friend".',
                'next' => [
                    'devices' => 'settings_devices',
                    'theme' => 'settings_theme',
                    'storage' => 'settings_storage',
                    'friend' => 'settings_friend',
                ]
            ],
            'settings_theme' => [
                'response' => 'We offer 4 themes: Light (Focus on clarity), Dark (OLED-optimized high-contrast), Automatic (Follows your phone settings), and Dynamic (Android Material 3 wallpaper colors).',
                'next' => null
            ],
            'settings_devices' => [
                'response' => 'Manage active sessions in Settings > Linked Devices. You can log out from any device remotely.',
                'next' => null
            ],
            'settings_storage' => [
                'response' => 'Clear your cache or set media auto-clear duration in Settings > Storage & Data.',
                'next' => null
            ],
            'settings_friend' => [
                'response' => 'Love Zmzir? Go to Settings > Tell a Friend to invite your contacts and earn badges!',
                'next' => null
            ],
            // --- POLLS BRANCH ---
            'polls_start' => [
                'pattern' => '/\b(poll|polls|survey|vote)\b/i',
                'response' => 'Get the consensus! Do you want to know about "poll types", "voting settings", or "forwarding polls"?',
                'next' => [
                    'types' => 'poll_types',
                    'settings' => 'poll_settings',
                    'forward' => 'poll_forward',
                ]
            ],
            'poll_types' => [
                'response' => 'We support: Single Choice, Multiple Choice, Ranked (order of preference), and Weighted (point distribution).',
                'next' => null
            ],
            'poll_settings' => [
                'response' => 'In Poll Settings, you can set deadlines, make votes anonymous, or restrict results to "after vote" or "creator only".',
                'next' => null
            ],
            'poll_forward' => [
                'response' => 'You can forward any poll you created (or moderate) to another Space to reach more voters!',
                'next' => null
            ],
            // --- STORIES BRANCH ---
            'stories_platform_start' => [
                'pattern' => '/\b(story|stories|segment|segments)\b/i',
                'response' => 'Share your day! Ask about "ephemeral stories", "collaborative chains", or "magic events".',
                'next' => [
                    'ephemeral' => 'story_24h',
                    'chains' => 'story_chains',
                    'magic' => 'story_magic',
                ]
            ],
            'story_24h' => [
                'response' => 'Stories expire after 24 hours automatically. You can share photos or videos up to 40MB.',
                'next' => null
            ],
            'story_chains' => [
                'response' => 'Collaborative chains let multiple people add video/photo segments to a single story topic.',
                'next' => null
            ],
            'story_magic' => [
                'response' => 'Magic Events happen in your Space whenever someone contributes to a linked collaborative story!',
                'next' => null
            ],
            // --- AI PLATFORM BRANCH ---
            'ai_platform_start' => [
                'pattern' => '/\b(ai|intelligence|predict|suggestion|suggest)\b/i',
                'response' => 'Our AI is everywhere! Need help with "post suggestions", "engagement prediction", or "story continuation"?',
                'next' => [
                    'post' => 'ai_post_help',
                    'predict' => 'ai_predict_help',
                    'story' => 'ai_story_help',
                ]
            ],
            'ai_post_help' => [
                'response' => 'The AI can suggest trending hashtags, engaging questions for your captions, and even reply sentiments.',
                'next' => null
            ],
            'ai_predict_help' => [
                'response' => 'Before you post, our AI can predict your content engagement based on similar successful posts!',
                'next' => null
            ],
            'ai_story_help' => [
                'response' => 'Stuck? The AI suggests how to continue your story branches or what context to add next.',
                'next' => null
            ],
            // --- NEW: DESIGN & LAYERING BRANCH ---
            'design_layering_start' => [
                'pattern' => '/\b(layer|layering|stacking|z-index|width|desktop|web)\b/i',
                'response' => 'We use a portal-based layering system! Want to know about "z-indexes", "web widths", or "how overlays work"?',
                'next' => [
                    'z-indexes' => 'layering_zindex',
                    'width' => 'layering_width',
                    'overlays' => 'layering_logic',
                ]
            ],
            'layering_zindex' => [
                'response' => 'MediaViewer uses zIndex: 1000. All interactive overlays (Comments, Emojis, Reposts, Bookmarks) use zIndex: 6000 to stay on top.',
                'next' => null
            ],
            'layering_width' => [
                'response' => 'On Web, all major components are limited to a 1440px maximum width and centered. This ensures a premium ultra-wide monitor experience!',
                'next' => null
            ],
            'layering_logic' => [
                'response' => 'Modals are conditionally mounted to append to the end of the portal root, ensuring they override the current view layer.',
                'next' => null
            ],

            'post_repost_logic' => [
                'response' => 'The Repost popup closes when you tap the blurred backdrop. No manual close button is needed anymore for a faster flow!',
                'next' => null
            ],
            'post_media_viewer' => [
                'response' => 'The MediaViewer features high-contrast white icons and a bold green bookmark/repost status. Close it with the arrow on the top-left.',
                'next' => null
            ],
            'post_bookmark_gallery' => [
                'response' => 'Save posts to your high-fidelity Bookmark Gallery! You can add personal "notes" that appear as premium cards.',
                'next' => null
            ],
            // --- ACTIVITIES BRANCH ---
            'activities_start' => [
                'pattern' => '/\b(activity|activities|event|events|schedule)\b/i',
                'response' => 'Stay organized! Do you want to know about "scheduling", "recurring events", or "activity status"?',
                'next' => [
                    'scheduling' => 'activity_scheduling',
                    'recurring' => 'activity_recurring',
                    'status' => 'activity_status',
                ]
            ],
            'activity_scheduling' => [
                'response' => 'Propose an activity in your Space with a title, description, and planned time. You can also set participant limits.',
                'next' => null
            ],
            'activity_recurring' => [
                'response' => 'We support Daily, Weekly, and Monthly recurrence patterns to help you automate regular meetups or tasks.',
                'next' => null
            ],
            'activity_status' => [
                'response' => 'Activities can be Proposed, Scheduled, or Completed. Track activity metrics like "last proposed" in Space settings.',
                'next' => null
            ],
            // --- SAFETY & TRUST BRANCH ---
            'safety_trust_start' => [
                'pattern' => '/\b(safety|trust|reputation|score|standing)\b/i',
                'response' => 'Safety first! Do you want to know about your "trust score", "shadow checking", or "compliance status"?',
                'next' => [
                    'score' => 'safety_score_info',
                    'shadow' => 'safety_shadow_info',
                    'compliance' => 'safety_compliance_info',
                ]
            ],
            'safety_score_info' => [
                'response' => 'Your Trust Score is based on your reporting integrity and history. High scores can grant you Protected Status!',
                'next' => null
            ],
            // --- SYNC & COLLABORATION BRANCH ---
            'sync_collaboration_start' => [
                'pattern' => '/\b(sync|synergy|skill|matching|whiteboard|cursor|screen)\b/i',
                'response' => 'Better together! Ask me about "skill synergy", "whiteboard tracking", "timing matches", or "screen sharing".',
                'next' => [
                    'synergy' => 'sync_synergy_info',
                    'whiteboard' => 'sync_whiteboard_info',
                    'tracking' => 'sync_tracking_info',
                    'timing' => 'sync_timing_info',
                    'screen' => 'sync_screen_info',
                    'mood' => 'sync_mood_info',
                ]
            ],
            'sync_synergy_info' => [
                'response' => 'Synchronicity matches users via Synergy Traits. We look for compatible collaboration styles to build the best teams.',
                'next' => null
            ],
            'sync_whiteboard_info' => [
                'response' => 'The Whiteboard supports element versioning and real-time drawing. Your changes are saved persistently within the Space.',
                'next' => null
            ],
            'sync_tracking_info' => [
                'response' => 'Real-time cursor tracking lets you see where others are drawing. This makes remote brainstorming feel like you are in the same room!',
                'next' => null
            ],
            'sync_timing_info' => [
                'response' => 'Timing matches detect "Morning Peak" sessions or "High Engagement" patterns based on space activity metrics.',
                'next' => null
            ],
            'sync_screen_info' => [
                'response' => 'Toggle Screen Sharing in any Space call for visual reviews. You can also see who has their camera or microphone muted.',
                'next' => null
            ],
            'sync_mood_info' => [
                'response' => 'Our system automatically detects message mood (Sentiment Analysis). This helps in engagement pattern detection and community health monitoring!',
                'next' => null
            ],
        ];

        $node = $tree[$state] ?? null;

        // Enter tree - Multi-node entry support
        $startNodes = ['start', 'spaces_start', 'posts_start', 'privacy_start', 'settings_start', 'polls_start', 'stories_platform_start', 'ai_platform_start', 'activities_start', 'safety_trust_start', 'sync_collaboration_start', 'design_layering_start'];
        
        if ($state === 'start') {
            foreach ($startNodes as $startNode) {
                $nodeCandidate = $tree[$startNode];
                if (preg_match($nodeCandidate['pattern'], $message)) {
                    $this->decisionTreeState[$conversationId] = $startNode;
                    return $nodeCandidate['response'];
                }
            }
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
            'feature' => ['use', 'feature', 'tutorial', 'guide'],
            'spaces' => ['space', 'join', 'assistant', 'personality', 'channel'],
            'posts' => ['post', 'bookmark', 'location', 'trim', 'share']
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

            case 'spaces':
                if ($this->containsAny($lastMessages, ['join', 'link'])) {
                    return 'To join a space, use the invitation link or find it via Discover.';
                }
                if ($this->containsAny($lastMessages, ['ai', 'assistant', 'personality'])) {
                    return 'AI personalities: Analytical (data focus), Creative (ideas), Helpful (support). Activate in Space Settings.';
                }
                return 'Spaces help: create channels, invite members, or manage your AI assistant.';

            case 'posts':
                if ($this->containsAny($lastMessages, ['bookmark', 'save'])) {
                    return 'View your saved items in Profile > Bookmarks or Settings > Bookmarks.';
                }
                if ($this->containsAny($lastMessages, ['trim', 'video'])) {
                    return 'Trimming: Available for videos during upload. In the MediaViewer, icons are white/green with zIndex: 6000.';
                }
                return 'Posts help: media uploads, location tagging, and the new Bookmark Gallery with personal notes.';
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
                event(new ChatbotTrainingNeededEvent($message, $category, $analysis['keywords']));
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
            event(new ChatbotTrainingNeededEvent($message, $category, $analysis['keywords']));
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
                    new ChatbotTrainingNeeded($message, $category, $keywords)
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

        $positive = ['happy', 'good', 'great', 'thanks', 'thank', 'awesome', 'excellent', 'love', 'like', 'fantastic', 'positive', 'satisfied', 'pleased', 'helpful'];
        $negative = ['angry', 'bad', 'wrong', 'broken', 'issue', 'problem', 'fail', 'error', 'hate', 'dislike', 'terrible', 'negative', 'unsatisfied', 'frustrated', 'dissatisfied'];

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
            'spaces'           => ['space', 'spaces', 'collab', 'whiteboard', 'meeting room', 'voice channel'],
            'posts'            => ['post', 'posts', 'feed', 'repost', 'caption', 'trending'],
            'account'          => ['account', 'profile', 'login', 'signup', 'register', 'password', 'email verify'],
            'payment'          => ['payment', 'billing', 'subscription', 'refund', 'charge', 'paypal', 'stripe', 'invoice'],
            'technical'        => ['bug', 'error', 'crash', 'not working', 'broken', 'issue', 'slow', 'lag', 'freeze'],
            'feature'          => ['feature', 'add', 'missing', 'wish', 'request', 'idea', 'suggestion'],
            'mobile'           => ['mobile', 'app', 'android', 'ios', 'iphone', 'play store', 'app store'],
            'notification'     => ['notification', 'alert', 'bell', 'push', 'reminder'],
            'privacy'          => ['privacy', 'data', 'delete account', 'gdpr', 'personal info'],
            'settings'         => ['settings', 'preferences', 'options', 'customize', 'configuration'],
            'general'          => ['help', 'support', 'question', 'how to', 'guide', 'information'],
            'troubleshooting' => ['troubleshoot', 'fix', 'resolve', 'solution', 'workaround'],

            // Tech & Development
            'ai'               => ['ai', 'artificial intelligence', 'chatgpt', 'gpt', 'llm', 'grok', 'claude', 'gemini'],
            'machine-learning' => ['machine learning', 'ml', 'deep learning', 'neural network', 'training data'],
            'programming'      => ['programming', 'code', 'python', 'javascript', 'php', 'laravel', 'react', 'vue'],
            'web-dev'          => ['web development', 'frontend', 'backend', 'html', 'css', 'api', 'rest'],
            'cloud'            => ['cloud', 'aws', 'azure', 'google cloud', 'server', 'hosting', 'docker', 'kubernetes'],
            'security'         => ['security', 'hacking', 'cybersecurity', 'encryption', '2fa', 'password manager'],
            'data-science'     => ['data science', 'data analysis', 'data visualization', 'pandas', 'numpy', 'jupyter'],
            'devops'          => ['devops', 'ci/cd', 'continuous integration', 'deployment', 'infrastructure as code'],
            'blockchain'       => ['blockchain', 'smart contract', 'solidity', 'decentralized', 'defi'],
            'robotics'         => ['robotics', 'robot', 'automation', 'drone', 'mechatronics'],
            'iot'              => ['iot', 'internet of things', 'smart device', 'sensor', 'embedded'],
            'quantum-computing' => ['quantum computing', 'qubit', 'quantum algorithm', 'entanglement'],

            // Media & Arts (your film/theater test case)
            'film'             => ['film', 'movie', 'cinema', 'netflix', 'streaming', 'hollywood', 'bollywood'],
            'sci-fi'           => ['sci-fi', 'science fiction', 'scifi', 'dune', 'blade runner', 'matrix'],
            'theater'          => ['theater', 'theatre', 'play', 'stage', 'acting', 'drama', 'schauspiel'],
            'storytelling'     => ['story', 'narrative', 'plot', 'script', 'screenplay', 'writing story', 'storytelling', 'storyteller'],
            'director'         => ['director', 'filmmaker', 'nolan', 'scorsese', 'tarantino', 'villeneuve'],
            'documentary'      => ['documentary', 'doc', 'real story', 'true story'],
            'animation'       => ['animation', 'animated', 'cartoon', 'pixar', 'disney', 'anime'],
            'visual-effects'  => ['visual effects', 'vfx', 'cgi', 'special effects', 'green screen'],
            'cinematography'  => ['cinematography', 'camera work', 'shot composition', 'lighting', 'lens'],
            'film-history'    => ['film history', 'cinema history', 'classic films', 'silent era', 'golden age of hollywood'],

            // Science & Academia
            'physics'          => ['physics', 'quantum', 'relativity', 'einstein', 'particle'],
            'biology'          => ['biology', 'dna', 'genes', 'evolution', 'cells', 'biotech'],
            'math'            => ['math', 'mathematics', 'calculus', 'algebra', 'statistics', 'geometry'],
            'space'            => ['space', 'nasa', 'mars', 'astronomy', 'cosmos', 'black hole', 'telescope'],

            // Health & Life
            'health'           => ['health', 'fitness', 'diet', 'exercise', 'mental health', 'therapy'],
            'medicine'         => ['medicine', 'doctor', 'hospital', 'disease', 'vaccine', 'pharma'],
            'psychology'       => ['psychology', 'mind', 'behavior', 'cognitive', 'emotion', 'therapy'],
            'nutrition'        => ['nutrition', 'vitamins', 'supplements', 'healthy eating', 'meal plan'],
            'wellness'        => ['wellness', 'self-care', 'mindfulness', 'meditation', 'stress management'],
            'fitness'         => ['fitness', 'workout', 'gym', 'training', 'cardio', 'strength'],

            // Business & Money
            'business'         => ['business', 'startup', 'entrepreneur', 'marketing', 'sales', 'money'],
            'crypto'           => ['crypto', 'bitcoin', 'ethereum', 'blockchain', 'nft', 'web3'],
            'investing'        => ['investing', 'stocks', 'bonds', 'portfolio', 'financial planning'],
            'economics'        => ['economics', 'market', 'inflation', 'recession', 'supply and demand'],
            'real-estate'      => ['real estate', 'property', 'housing market', 'mortgage', 'renting', 'buying'],
            'personal-finance' => ['personal finance', 'budgeting', 'saving', 'debt', 'credit score'],
            'tax'              => ['tax', 'irs', 'filing', 'deduction', 'refund'],

            // Education & Learning
            'education'        => ['education', 'school', 'university', 'course', 'learning', 'study', 'exam'],
            'language'         => ['language', 'english', 'german', 'french', 'spanish', 'learn language'],
            'history-academia' => ['history', 'philosophy', 'sociology', 'anthropology', 'archaeology'],
            'research'         => ['research', 'paper', 'study', 'experiment', 'findings'],
            'teaching'         => ['teaching', 'lesson plan', 'curriculum', 'student engagement'],
            'online-learning'  => ['online learning', 'e-learning', 'mooc', 'virtual classroom', 'distance education'],
            'child-education'  => ['child education', 'early childhood', 'developmental milestones', 'parenting', 'learning through play'],
            'adult-education'  => ['adult education', 'continuing education', 'lifelong learning', 'skills development', 'professional development'],
            'special-education' => ['special education', 'learning disabilities', 'individualized education plan', 'inclusive education', 'special needs'],
            'educational-technology' => ['educational technology', 'edtech', 'learning management system', 'digital learning tools', 'virtual reality in education'],

            // Lifestyle & Culture
            'travel'           => ['travel', 'vacation', 'flight', 'hotel', 'country', 'city'],
            'food'             => ['food', 'cooking', 'recipe', 'restaurant', 'cuisine'],
            'music'            => ['music', 'song', 'spotify', 'album', 'concert', 'band'],
            'gaming'           => ['gaming', 'game', 'playstation', 'xbox', 'nintendo', 'pc gaming'],
            'fashion'          => ['fashion', 'clothes', 'style', 'designer', 'trend'],
            'sports'           => ['sports', 'football', 'soccer', 'basketball', 'tennis', 'olympics', 'world cup'],
            'history'          => ['history', 'ancient', 'medieval', 'modern history', 'historical event'],
            'literature'       => ['literature', 'book', 'novel', 'author', 'poetry', 'reading'],
            'art'              => ['art', 'painting', 'sculpture', 'museum', 'gallery', 'artist'],
            'photography'      => ['photography', 'photo', 'camera', 'lens', 'shooting', 'editing'],
            'environment'      => ['environment', 'climate change', 'sustainability', 'pollution', 'conservation'],
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
            ['keywords' => ['privacy', 'vault', 'private', 'mode'], 'response' => 'Privacy Vault: Access it in Settings > Privacy to secure your profile and manage visibility.', 'priority' => 5],
            ['keywords' => ['space', 'spaces', 'collaboration'], 'response' => 'Spaces are interactive hubs. Try asking: "What are space types?" or "How to use AI in spaces?"', 'priority' => 6],
            ['keywords' => ['post', 'discovery', 'share'], 'response' => 'Creating Posts: Tap the "+" icon. You can add media, trim videos, and tag locations.', 'priority' => 5],
            ['keywords' => ['bookmark', 'bookmarks', 'save'], 'response' => 'Bookmarks: Tap the bookmark icon on any post to save it. View them in Profile > Bookmarks.', 'priority' => 5],
            ['keywords' => ['storage', 'clear', 'cache'], 'response' => 'Storage Management: Go to Settings > Storage & Data to clear cache or adjust media upload quality.', 'priority' => 5],
            ['keywords' => ['invite', 'friend', 'social'], 'response' => 'Spread the word: Go to Settings > Tell a Friend to invite others via email or link.', 'priority' => 5],
            ['keywords' => ['ranked', 'weighted', 'poll', 'vote'], 'response' => 'Advanced Polls: Try "Ranked" to list preferences or "Weighted" for multi-value importance voting!', 'priority' => 6],
            ['keywords' => ['story', 'segment', 'chain', 'collab'], 'response' => 'Collaborative Stories: Enable this on your story to let others add segments and build a chain!', 'priority' => 6],
            ['keywords' => ['suggestion', 'hashtag', 'predict', 'ai'], 'response' => 'AI Platform: Use AI to suggest hashtags, predict engagement, or get story continuation ideas.', 'priority' => 6],
            ['keywords' => ['activity', 'event', 'schedule', 'recurring'], 'response' => 'Collaborative Activities: Schedule recurring events in your Space to keep everyone engaged!', 'priority' => 6],
            ['keywords' => ['trust', 'score', 'standing', 'reputation'], 'response' => 'Safety & Trust: Your Trust Score reflects your community contributions. Check your status in Settings > Safety.', 'priority' => 7],
            ['keywords' => ['shadow', 'check', 'safe', 'moderation'], 'response' => 'Shadow Check: Use our real-time AI to check if your content meets community standards before posting.', 'priority' => 7],
            ['keywords' => ['synergy', 'traits', 'skill', 'match'], 'response' => 'Synchronicity: We match your unique synergy traits with others in your Space for building perfect teams!', 'priority' => 7],
            ['keywords' => ['layering', 'stacking', 'z-index', 'top'], 'response' => 'Interaction Layering: MediaViewer (1000) vs Overlays (6000). High-priority portals ensure popups always stay on top.', 'priority' => 8],
            ['keywords' => ['width', 'desktop', '1440', 'px'], 'response' => 'Unified Layout: Standardized 1440px centered width for all Web UI components for a premium desktop experience.', 'priority' => 8],
            ['keywords' => ['repost', 'outside', 'backdrop', 'dismiss'], 'response' => 'Repost Flow: Tap the blurred backdrop to instantly close the Context Selector. No close button required!', 'priority' => 8],
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
            
            $response = Http::withOptions([
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
            /** @var \App\Models\User $admin */
            $admin->notify(new ChatbotTrainingNeeded($message, 'general', []));
        }
        event(new ChatbotTrainingNeededEvent($message, 'general', []));
    }

    private function checkKeywordPatterns2(array $keywords): ?string
    {
        $groups = [
            'greetings' => ['hello', 'hi', 'hey'],
            'thanks' => ['thank', 'thanks'],
            'account' => ['account', 'profile', 'login'],
        ];
        foreach ($keywords as $kw) {
            foreach ($groups as $key => $keywords_list) {
                if (in_array($kw, $keywords_list)) {
                    return "$key response";
                }
            }
        }
        return null;
    }
}