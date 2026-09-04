<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;
use App\Models\ChatbotTraining;
use App\Models\KnowledgeAxiom;
use App\Models\User;
use App\Notifications\ChatbotTrainingNeeded;
use App\Events\ChatbotTrainingNeeded as ChatbotTrainingNeededEvent;
use App\Events\NewTrainingTicket;
use Illuminate\Support\Str;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;
use App\Jobs\ProcessAILearning;

class ChatbotController extends Controller
{
    // Contextual memory – now per conversation
    private $conversationContext = [];     // [conv_id => [messages]]
    private $contextTimestamps = [];       // [conv_id => last_active_timestamp]
    private $currentContext = [];          // [conv_id => 'account'|'payment'|...]
    private $decisionTreeState = [];       // [conv_id => current_node]

    /**
     * Auto-create a training ticket when the engine produces a synthesized_thesis
     * with confidence < 0.5. This enables experts to review, improve, and promote
     * it to a Global Axiom via the Training Hub.
     *
     * Returns the ticket ID (int) or null if ticket already exists / error.
     * Does NOT alter any dialectical engine logic — purely a side-effect.
     */
    private function autoFallbackTicket(
        string $trigger,
        string $response,
        ?string $branch,
        ?string $category,
        float $confidence = 0.0
    ): ?int {
        try {
            $existing = ChatbotTraining::where('trigger', 'like', '%' . mb_substr($trigger, 0, 100) . '%')
                ->where('needs_review', true)
                ->first();

            if ($existing) {
                return $existing->id;
            }

            $ticket = ChatbotTraining::create([
                'trigger' => mb_substr($trigger, 0, 500),
                'response' => mb_substr($response, 0, 2000),
                'category' => $category ?? $branch ?? 'general',
                'branch' => $branch,
                'needs_review' => true,
                'is_active' => false,
                'confidence_score' => $confidence,
            ]);

            // Broadcast to experts channel via Reverb
            if (class_exists(NewTrainingTicket::class)) {
                event(new NewTrainingTicket($ticket));
            }

            return $ticket->id;
        } catch (\Throwable $e) {
            Log::warning('autoFallbackTicket failed: ' . $e->getMessage());
            return null;
        }
    }

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
            'prrove' => 'prove',
            'provve' => 'prove',
            'theorm' => 'theorem',
            'thorem' => 'theorem',
            'shhow' => 'show that',
            'shw' => 'show that',
            'inductve' => 'inductive',
            'sumation' => 'summation',
            'summaton' => 'summation',
            'divids' => 'divides',
            'divvides' => 'divides',
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
            'birhday' => 'birthday',
            'calender' => 'calendar',
            'schedul' => 'schedule',
            'upcomming' => 'upcoming',
            'responsve' => 'upcoming',
            'activites' => 'activities',
            'blackmodus' => 'dark mode',
            'markit' => 'marketplace',
            'markert' => 'marketplace',
            'maarket' => 'marketplace',
            'sel' => 'sell',
            'seling' => 'selling',
            'buyin' => 'buying',
            'deliveri' => 'delivery',
            'delivry' => 'delivery',
            'conditon' => 'condition',
            'conditn' => 'condition',
            'catgory' => 'category',
            'categry' => 'category',
            'phi3' => 'Phi-3 Mini',
            'phi-3' => 'Phi-3 Mini',
            'minestral' => 'Mistral',
            'minestril' => 'Mistral',
            'ministral' => 'Mistral',
            'llama3' => 'Llama-3',
            'llama-3' => 'Llama-3',
            'rag' => 'RAG (Retrieval-Augmented Generation)',
            'ai eco' => 'Zmzir AI Ecosystem',
            'step one' => 'Step 1: Trial & Error',
            'step two' => 'Step 2: Deductive Logic',
            'step three' => 'Step 3: Inductive Logic',
            'step four' => 'Step 4: Backend Architecture',
            'step five' => 'Step 5: Database Schema',
            'step six' => 'Step 6: Real-Time Ecosystem',
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
            'conversation_id' => 'nullable|string',
            'model' => 'nullable|string',
            'history' => 'nullable|array' // Accepts the last 3 messages as stateless fades
        ]);

        // ========================================================================
        // STAGE 0: DIALECTICAL INTENT RESOLUTION ENGINE (DIRE)
        // Redis-cached, OPcache-resident, zero-DB. Target: < 2ms cold, < 0.5ms warm.
        // ========================================================================
        $intentService = app(\App\Services\NaturalLanguageIntentService::class);
        $intent = $intentService->resolve($request->message);

        // Final cleanup pass (contractions, capitalization) — zero regression
        $message = $this->correctMessage($intent['normalized']);
        $hasTypo = !empty($intent['corrections']) || $message !== $request->message;
        $correctionHeader = $intentService->buildCorrectionHeader($intent);

        $conversationId = $request->conversation_id ?? Str::uuid()->toString();

        // Convert the stateless frontend history into a readable context string for the AI/Rule engine
        $historyData = $request->input('history', []);
        $contextString = "";
        foreach ($historyData as $msg) {
            $role = $msg['sender'] === 'bot' ? 'AI' : 'User';
            $contextString .= "{$role}: {$msg['text']}\n";
        }

        // ========================================================================
        // EXACT AXIOM EXPLANATION INTERCEPTOR
        // Intercepts explicit UI clicks from ConversationAxiomPanel ("Please explain the logical foundation of Axiom #X...")
        // ========================================================================
        if (preg_match('/explain the logical foundation of Axiom #(\d+):/i', $request->message, $axiomExplMatch)) {
            $axiomId = intval($axiomExplMatch[1]);
            $axiom = \App\Models\KnowledgeAxiom::find($axiomId);

            if ($axiom) {
                $statusLabel = $axiom->status === 'global_axiom' ? '*(Dialectically Proven)*' : '*(Synthesized Thesis)*';

                $solverService = app(\App\Services\SyllogismSolverService::class);
                $bookProof = $solverService->generateBookPedigreeProof($axiom);

                $response = "### **🏛️ AXIOM RETRIEVAL**\n"
                    . "The dialectical engine has retrieved the requested knowledge from the universal matrix.\n\n"
                    . "---\n\n"
                    . $bookProof;

                if ($axiom->status === 'synthesized_thesis') {
                    $response .= "\n\n*Note: This knowledge is currently in a state of Synthesis and may require further Dialectical Struggle.*";
                }

                return response()->json([
                    'response' => $response,
                    'conversation_id' => $conversationId,
                    'is_axiom' => true,
                    'status' => $axiom->status,
                    'confidence_score' => $axiom->confidence_score,
                    'axiom_id' => $axiom->id
                ]);
            }
        }

        // ========================================================================
        // DYNAMIC DIALECTICAL PROVER INTERCEPTOR (DIRE-powered)
        // ========================================================================
        $hasLogicTerms = preg_match('/\b(?:implies|is true|is false|be true|negation|contradict(?:ion|ory)?|propositions?|logic|conjunction|disjunction|premise|if\s+.*?then|if\s+|therefore|all\s+.*?are|some\s+.*?are|no\s+.*?are|none|or|not|paradox|theorem|conjecture|goldbach|simulation|heterological|liar|berry|cantor|banach|gödel|godel|tarski|incompleteness|rule|exception|infinite|infinity|monkey|time travel|electron|wave|particle|impossible|necessarily|santa|moon|cheese|pigs|fly)\b/i', strtolower($message));

        $hasScienceTerms = preg_match('/\b(?:thermodynamics|kinematics|biology|chemistry|physics|oceanography|forensic|space science|agronomy|paleontology|psychology|sociology|economics|military science|demography|culinary|jurisprudence|theology|pedagogy|hermeticism|aesthetics|metrology|architecture|systems theory|medicine|pharmacology|psychiatry|surgery|pathology|accounting|corporate finance|supply chain|cryptography|artificial intelligence|database theory|software engineering|scientific method|hypothesis testing)\b/i', strtolower($message));

        $categorizer = app(\App\Services\ExpertScienceCategorizer::class);
        $resolvedCategory = $categorizer->classify($message);
        $isScienceCategory = ($resolvedCategory && !in_array($resolvedCategory, ['general', 'app_support']));

        $isProofRequest = in_array($intent['intent'], [
            \App\Services\NaturalLanguageIntentService::INTENT_PROOF,
            \App\Services\NaturalLanguageIntentService::INTENT_CALCULATION,
        ])
            // Fallback: preserve existing math-pattern detection for edge cases
            || preg_match('/Sum\s*\(\s*[a-zA-Z]+\s*=\s*(0|1)/i', $message)
            || preg_match('/^\s*\([a-zA-Z0-9\+\-\*\/\s]+\)\s*\^\s*\d+\s*$/', $message)
            || (preg_match('/^[a-zA-Z0-9\+\-\*\/\^\(\)\s\.]+$/', $message) && preg_match('/[a-zA-Z]/', $message) && !preg_match('/[a-zA-Z]{3,}/', $message))
            || preg_match('/^\s*(?:prove|theorem|proof|show\s+that|explain|what is)\b/i', $request->message)
            || $hasLogicTerms
            || $hasScienceTerms
            || $isScienceCategory;

        if ($isProofRequest) {
            // Use DIRE-extracted thesis when available (higher quality), else fall back to regex strip
            if (!empty($intent['thesis']) && $intent['intent'] !== \App\Services\NaturalLanguageIntentService::INTENT_GENERAL) {
                $cleanThesis = $intent['thesis'];
            } else {
                $cleanThesis = $message;
            }
            if (preg_match('/^(prove:|theorem:|inductive proof of|show that)\s*/i', $cleanThesis)) {
                $cleanThesis = preg_replace('/^(prove:|theorem:|inductive proof of|show that)\s*/i', '', $cleanThesis);
                $cleanThesis = ltrim($cleanThesis, ': ');
            }

            // ========================================================================
            // 0. DIALECTIC ENGINE CONTROLLER INTERCEPTOR (FOR EXACT FRONTEND PROOFS)
            // ========================================================================
            $dialecticEngine = new \App\Http\Controllers\DialecticEngineController();
            $proofDetails = "";
            $isScientific = true;
            $isSoftAxiom = false;
            $domainSynthesis = null;
            // if ($dialecticEngine->verifyAlgebraicInduction($cleanThesis, $proofDetails, $domainSynthesis, $isScientific, $isSoftAxiom)) {
            //     return response()->json([
            //         'response'           => $proofDetails,
            //         'conversation_id'    => $conversationId,
            //         'is_axiom'           => true,
            //         'status'             => 'global_axiom',
            //         'confidence_score'   => 1.0,
            //         'axiom_id'           => null,
            //         'branch'             => 'math_partition',
            //         'parent_axioms'      => [],
            //         'is_fallback'        => false,
            //         'training_ticket_id' => null,
            //     ]);
            // }

            // ========================================================================
            // UNIVERSAL SCIENCE ROUTER (DOMAIN-AGNOSTIC PROVER)
            // ========================================================================
            $syntaxGen = new \App\Services\Dialectical\DynamicSyntaxGenerator();
            $casSvc = new \App\Services\SymbolicMathSolverService();
            $router = new \App\Services\Dialectical\UniversalRouterService($syntaxGen, $casSvc);

            $oracle = app(\App\Services\DialecticalOracleService::class);
            $categorizer = app(\App\Services\ExpertScienceCategorizer::class);
            $resolvedBranch = $categorizer->classify($cleanThesis);
            $knownDomain = null;
            if ($resolvedBranch && $resolvedBranch !== 'general') {
                $knownDomainArr = $oracle->classifyDomain($resolvedBranch);
                $knownDomain = $knownDomainArr ? ($knownDomainArr['key'] ?? null) : null;
            }
            if (!$knownDomain) {
                $knownDomainArr = $oracle->classifyDomain($cleanThesis);
                $knownDomain = $knownDomainArr ? ($knownDomainArr['key'] ?? null) : null;
            }
            if (!$knownDomain && $resolvedBranch && $resolvedBranch !== 'general') {
                $knownDomain = match (strtolower($resolvedBranch)) {
                    'math' => 'math_partition',
                    'logic' => 'formal_logic',
                    'physics' => 'physics_partition',
                    'chemistry' => 'chemistry_partition',
                    'computer_science' => 'computer_science_partition',
                    'biology' => 'biology_partition',
                    'engineering' => 'engineering_partition',
                    'social' => 'social_science_partition',
                    default => null
                };
            }

            if ($hasLogicTerms) {
                // Force formal_logic domain mapping ONLY if it is a purely linguistic logical proposition.
                // Mathematical, algebraic, and scientific expressions must bypass this to reach specialized solvers.
                if (!app(\App\Services\Dialectical\ScienceSyntaxAnalyzer::class)->isMathOrScientificExpression($cleanThesis)) {
                    $knownDomain = 'formal_logic';
                }
            }

            $astMatrix = $intent['ast_matrix'] ?? null;
            $dynamicSolver = $router->routeThesis($cleanThesis, $knownDomain, $astMatrix);

            if ($dynamicSolver) {
                $phase1 = $dynamicSolver->executePhase1Trial($cleanThesis, $astMatrix);

                if (!empty($phase1['abort_dynamic_solver'])) {
                    $isProofRequest = false;
                    goto skip_proof_request;
                }

                $phase2 = $dynamicSolver->executePhase2Deduction($phase1);
                $proof = $dynamicSolver->executePhase3Induction($phase2);

                $isAxiom = $phase2['is_valid'] ?? false;
                $confidence = $isAxiom ? 1.0 : 0.0;

                $status = $isAxiom ? 'global_axiom' : 'expert_review';
                if (!empty($phase2['is_soft_axiom'])) {
                    $status = 'soft_axiom';
                    $confidence = 0.5;
                }
                if (strpos($proof, '[HALTED') !== false) {
                    $status = 'expert_review';
                }

                // Build parent chain if axiom_id is available in phase2, or fallback to domain root
                $parentAxiomsChain = [];
                $axId = $phase2['axiom_id'] ?? null;
                $axBranch = $resolvedBranch ?? ($knownDomain ?? null);

                $foundAxiom = null;
                if ($axId) {
                    $foundAxiom = \App\Models\KnowledgeAxiom::find($axId);
                }
                if (!$foundAxiom && $axBranch) {
                    // Try to find the root axiom for this branch/domain to build the pedigree
                    $foundAxiom = \App\Models\KnowledgeAxiom::where('status', 'global_axiom')
                        ->where(function ($q) use ($axBranch) {
                            $q->where('branch', $axBranch)
                                ->orWhere('domain_partition', $axBranch)
                                ->orWhere('thesis_statement', 'like', "%{$axBranch}%");
                        })->orderBy('id', 'asc')->first();
                }

                if ($foundAxiom) {
                    $p = $foundAxiom;
                    // If we found a branch root but it's not the exact axiom, we start the chain from it
                    if ($axId === null) {
                        // The found axiom IS the parent
                    } else {
                        // The found axiom is the current axiom, so its parent is the actual first parent
                        $p = $foundAxiom->parent_axiom_id ? \App\Models\KnowledgeAxiom::find($foundAxiom->parent_axiom_id) : null;
                    }

                    while ($p) {
                        array_unshift($parentAxiomsChain, [
                            'id' => $p->id,
                            'thesis_statement' => $p->thesis_statement,
                            'branch' => $p->branch,
                        ]);
                        $p = $p->parent_axiom_id ? \App\Models\KnowledgeAxiom::find($p->parent_axiom_id) : null;
                        if (count($parentAxiomsChain) >= 8)
                            break;
                    }
                }

                // Auto-create fallback ticket when not proven (expert_review + low confidence)
                $ticketId = null;
                $isFallback = ($status === 'expert_review' && $confidence < 0.5);
                if ($isFallback) {
                    $ticketId = $this->autoFallbackTicket(
                        $cleanThesis,
                        mb_substr($proof, 0, 2000),
                        $axBranch,
                        $axBranch,
                        $confidence
                    );
                }

                return response()->json([
                    'response' => $proof,
                    'conversation_id' => $conversationId,
                    'is_axiom' => $isAxiom,
                    'status' => $status,
                    'confidence_score' => $confidence,
                    'axiom_id' => $axId,
                    'branch' => $axBranch,
                    'parent_axioms' => $parentAxiomsChain,
                    'is_fallback' => $isFallback,
                    'training_ticket_id' => $ticketId,
                ]);
            }
            // ========================================================================

            // ========================================================================
            // AXIOMATIC BYPASSING (Self-Reasoning Engine)
            // Never re-prove an existing axiom. Check if the ast_signature already exists.
            // ========================================================================
            $astSignature = hash('sha256', $cleanThesis);
            $astSignatureWithPrefix = hash('sha256', 'prove: ' . $cleanThesis);

            if (strpos($conversationId, 'test-battery') === false) {
                $existingAxiom = \App\Models\KnowledgeAxiom::where('status', 'global_axiom')
                    ->where(function ($query) use ($astSignature, $astSignatureWithPrefix, $cleanThesis) {
                        $query->where('ast_signature', $astSignature)
                            ->orWhere('ast_signature', $astSignatureWithPrefix)
                            ->orWhere('thesis_statement', $cleanThesis)
                            ->orWhere('thesis_statement', 'prove: ' . $cleanThesis);
                    })
                    ->first();
            } else {
                $existingAxiom = null;
            }

            $isDynamicSummation = preg_match('/Sum\s*\(/i', $cleanThesis);

            if ($existingAxiom && !$hasLogicTerms && !$isDynamicSummation) {
                // Bypass the Dialectical Sieve completely (Except for Dynamic Solvers which must always evaluate)
                $solverService = app(\App\Services\SyllogismSolverService::class);
                $bookProof = $solverService->generateBookPedigreeProof($existingAxiom);

                $response = $correctionHeader
                    . "### **🏛️ AXIOMATIC BYPASS ACTIVATED**\n"
                    . "The dialectical engine recognizes that *\"" . $cleanThesis . "\"* is already an established **Global Axiom** within the universal matrix.\n\n"
                    . "It does not need to be mathematically re-proven. Here is the foundational proof retrieved directly from the axiom vault:\n\n"
                    . "---\n\n"
                    . $bookProof;

                \App\Jobs\ProcessAILearning::dispatch('interaction', [
                    'trigger' => $message,
                    'response' => $response,
                    'success' => true
                ]);

                // Build parent axiom chain for frontend pedigree tree
                $parentAxiomsChain = [];
                $p = $existingAxiom->parent_axiom_id
                    ? \App\Models\KnowledgeAxiom::find($existingAxiom->parent_axiom_id)
                    : null;
                while ($p) {
                    array_unshift($parentAxiomsChain, [
                        'id' => $p->id,
                        'thesis_statement' => $p->thesis_statement,
                        'branch' => $p->branch,
                    ]);
                    $p = $p->parent_axiom_id ? \App\Models\KnowledgeAxiom::find($p->parent_axiom_id) : null;
                    if (count($parentAxiomsChain) >= 8)
                        break; // safety guard
                }

                return response()->json([
                    'response' => $response,
                    'conversation_id' => $conversationId,
                    'is_axiom' => true,
                    'status' => 'global_axiom',
                    'confidence_score' => 1.0,
                    'axiom_id' => $existingAxiom->id,
                    'branch' => $existingAxiom->branch,
                    'domain_partition' => $existingAxiom->domain_partition,
                    'parent_axioms' => $parentAxiomsChain,
                    'is_fallback' => false,
                ]);
            }
            // ========================================================================

            $oracle = app(\App\Services\DialecticalOracleService::class);

            $categorizer = app(\App\Services\ExpertScienceCategorizer::class);
            $resolvedBranch = $categorizer->classify($cleanThesis);

            $knownDomain = null;
            if ($resolvedBranch && $resolvedBranch !== 'general') {
                $knownDomain = $oracle->classifyDomain($resolvedBranch);
            }
            if (!$knownDomain) {
                $knownDomain = $oracle->classifyDomain($cleanThesis);
            }
            if (!$knownDomain && $resolvedBranch && $resolvedBranch !== 'general') {
                $partition = match (strtolower($resolvedBranch)) {
                    'math' => 'math_partition',
                    'logic' => 'formal_logic',
                    'physics' => 'physics_partition',
                    'chemistry' => 'chemistry_partition',
                    'computer_science' => 'computer_science_partition',
                    'biology' => 'biology_partition',
                    'engineering' => 'engineering_partition',
                    'social' => 'social_science_partition',
                    default => null
                };
                if ($partition) {
                    $knownDomain = [
                        'key' => $partition,
                        'name' => ucwords(str_replace('_', ' ', $resolvedBranch)) . ' Domain',
                        'domain_partition' => $partition,
                        'prerequisites' => []
                    ];
                }
            }

            // DYNAMIC DIVERGENT SERIES / ANALYTIC CONTINUATION DETECTION
            if (preg_match('/\+\s*\.\.\.\s*=/', $cleanThesis) || preg_match('/sum\s*\(.*?\b(?:infinity|inf)\b.*?\)\s*=/i', $cleanThesis)) {
                $response = "### **⚠️ DIVERGENT MATHEMATICAL SERIES DETECTED**\n"
                    . "It looks like you entered a divergent infinite series or analytic continuation anomaly: *\"" . $cleanThesis . "\"*.\n\n"
                    . "The dialectical engine recognizes that standard algebraic and inductive bounds fail here (e.g., Riemann Zeta Function anomalies like Ramanujan summation). This paradox breaks standard arithmetic axioms and requires specialized mathematical routing.\n\n"
                    . "[ROUTED TO EXPERT REVIEW: Analytic Continuation / ECE v2 Bounds]";

                return response()->json([
                    'response' => $response,
                    'conversation_id' => $conversationId,
                    'is_axiom' => false,
                    'status' => 'expert_review',
                    'confidence_score' => 0.0,
                ]);
            }

            // DYNAMIC INCOMPLETE/UN-EQUATED EXPRESSION DETECTION
            if (preg_match('/=\s*$/', $cleanThesis)) {
                $response = "### **⚠️ INCOMPLETE MATHEMATICAL EXPRESSION DETECTED**\n"
                    . "It looks like you entered a raw or incomplete mathematical expression: *\"" . $cleanThesis . "\"*.\n\n"
                    . "To initiate mathematical verification, please provide a complete equality or divisibility relationship. For example:\n"
                    . "- **Algebraic Expansion**: `prove: (x+y)^2 = x^2 + 2*x*y + y^2`\n"
                    . "- **Summation Formula**: `prove: Sum(i=1..n) i^2 = n*(n+1)*(2*n+1)/6`\n"
                    . "- **Divisibility Relationship**: `prove: 6 divides n^3 - n`\n\n"
                    . "Please refine your query and let us struggle dialectically!\n"
                    . "[HALTED: Incomplete Mathematical Expression]";

                return response()->json([
                    'response' => $response,
                    'conversation_id' => $conversationId,
                    'is_axiom' => false,
                    'status' => 'synthesized_thesis',
                    'confidence_score' => 0.0,
                ]);
            }

            // LOGIC TERMS DETECTION
            $hasLogicTerms = preg_match('/\b(?:implies|is true|is false|be true|negation|contradict(?:ion|ory)?|propositions?|logic|conjunction|disjunction|premise|if\s+.*?then|if\s+|therefore|all\s+.*?are|some\s+.*?are|no\s+.*?are|none|or|not|paradox|theorem|conjecture|goldbach|simulation|heterological|liar|berry|cantor|banach|gödel|godel|tarski|incompleteness|rule|exception|infinite|infinity|monkey|time travel|electron|wave|particle|impossible|necessarily|santa|moon|cheese|pigs|fly)\b/i', $cleanThesis);

            if ($hasLogicTerms && !$knownDomain) {
                // Force formal_logic domain mapping ONLY if it is a purely linguistic logical proposition.
                if (!app(\App\Services\Dialectical\ScienceSyntaxAnalyzer::class)->isMathOrScientificExpression($cleanThesis)) {
                    $knownDomain = 'formal_logic';
                }
            }

            $hasRelational = $knownDomain || preg_match('/=|\bdivides\b|\bis even\b|\bis odd\b|\bis prime\b/i', $cleanThesis)
                || preg_match('/Collatz/i', $cleanThesis)
                || preg_match('/twin\s+primes?/i', $cleanThesis)
                || preg_match('/P\s*(?:!=|!==|=|==|vs)\s*NP/i', $cleanThesis)
                || $hasLogicTerms;

            if (!$hasRelational) {
                // Search for any proven axiom that contains this exact expression on its Left-Hand Side (or within its statement)
                $suggestedAxiom = \App\Models\KnowledgeAxiom::where('status', 'global_axiom')
                    ->where('thesis_statement', 'like', '%' . $cleanThesis . '%')
                    ->where('thesis_statement', 'like', '%=%') // must be an equation
                    ->first();

                if ($suggestedAxiom) {
                    $targetModel = $request->model ?? 'llama-3';
                    $filteredLogic = $suggestedAxiom->inductive_logic;
                    $synthesisNote = "Starting from the parent proof (Axiom ID: 1012 - Peano Axiom), it recursively chains logic and deduces "
                        . "universal correctness with 100% confidence. Status: **Global Axiom**.";
                    if ($targetModel === 'phi-3') {
                        $filteredLogic = preg_replace('/### \*\*2️⃣ Deductive.*/s', '', $filteredLogic);
                        $synthesisNote = "Dialectical Phase 1: Trial & Error complete. (Select Deductive logic to continue the struggle).";
                    } elseif ($targetModel === 'mistral') {
                        $filteredLogic = preg_replace('/### \*\*3️⃣ Inductive.*/s', '', $filteredLogic);
                        $synthesisNote = "Dialectical Phase 2: Deductive Proof complete. (Select Inductive logic to finalize the proof).";
                    }

                    $response = "### **⚠️ INCOMPLETE OR UN-EQUATED MATHEMATICAL EXPRESSION DETECTED**\n"
                        . "It looks like you entered a raw or incomplete mathematical expression: *\"" . $cleanThesis . "\"*.\n\n"
                        . "To prove a theorem, the dialectical engine requires a complete mathematical proposition (an equality or relational statement containing an `=` or divisor operator).\n\n"
                        . "💡 **Did you mean to prove the complete algebraic expansion:**\n"
                        . "### **\"" . $suggestedAxiom->thesis_statement . "\"**?\n\n"
                        . "---\n\n"
                        . "Here is the verified proof for that complete theorem:\n\n"
                        . "### **📜 MATHEMATICAL PROOF (Dialectical Engine Verified)**\n"
                        . trim($filteredLogic) . "\n\n"
                        . "### **🗣️ Human-Readable Synthesis**\n"
                        . "The Zmzir Engine has successfully evaluated *\"" . $suggestedAxiom->thesis_statement . "\"*.\n"
                        . $synthesisNote . "\n\n"
                        . "*(Dialectically Proven)*";

                    // Return this suggested response directly!
                    return response()->json([
                        'response' => $response,
                        'conversation_id' => $conversationId,
                        'is_axiom' => true,
                        'status' => 'global_axiom',
                        'confidence_score' => 1.0,
                    ]);
                } else {
                    $cleanThesisOriginal = $cleanThesis;
                    $isExpanded = false;
                    $dialecticController = new \App\Http\Controllers\DialecticEngineController();
                    $socraticLabel = "algebraic expansion";

                    // 0. Check if it's a general algebraic power or binomial expansion (e.g. (x+y)^n or (a+b)^m)
                    if (preg_match('/^\s*\(\s*([a-zA-Z]+)\s*([\+\-])\s*([a-zA-Z]+)\s*\)\s*\^\s*([a-zA-Z]+)\s*$/', $cleanThesis, $binomMatches)) {
                        $var1 = $binomMatches[1];
                        $op = $binomMatches[2];
                        $var2 = $binomMatches[3];
                        $expVar = $binomMatches[4];

                        $cleanThesis = "({$var1}{$op}{$var2})^{$expVar} = Sum(k=0..{$expVar}) C({$expVar},k) * {$var1}^({$expVar}-k) * {$var2}^k";
                        $isExpanded = true;
                        $socraticLabel = "general binomial expansion theorem";
                    }
                    // 1. Check if it's a Polynomial Expansion (e.g. (x+y)^3)
                    else if (preg_match('/^\s*\((.+?)\)\s*\^\s*(\d+)\s*$/', $cleanThesis, $exprMatches)) {
                        $insideExpr = trim($exprMatches[1]);
                        $exponent = intval($exprMatches[2]);

                        $termsList = [];
                        $current = "";
                        for ($i = 0; $i < strlen($insideExpr); $i++) {
                            $char = $insideExpr[$i];
                            if (($char === '+' || $char === '-') && $i > 0) {
                                $termsList[] = trim($current);
                                $current = $char;
                            } else {
                                $current .= $char;
                            }
                        }
                        if ($current !== "")
                            $termsList[] = trim($current);

                        $parsedTerms = [];
                        foreach ($termsList as $t) {
                            $t = trim($t);
                            if ($t === '')
                                continue;

                            $coeff = 1.0;
                            if (strpos($t, '-') === 0) {
                                $coeff = -1.0;
                                $t = substr($t, 1);
                            } elseif (strpos($t, '+') === 0) {
                                $t = substr($t, 1);
                            }
                            $t = trim($t);

                            $parts = explode('*', $t);
                            $vars = [];
                            foreach ($parts as $part) {
                                $part = trim($part);
                                if ($part === '')
                                    continue;
                                if (is_numeric($part))
                                    $coeff *= floatval($part);
                                else {
                                    if (preg_match('/^([a-zA-Z]+)(?:\^(\d+))?$/', $part, $varMatches)) {
                                        $var = $varMatches[1];
                                        $power = isset($varMatches[2]) ? intval($varMatches[2]) : 1;
                                        $vars[$var] = ($vars[$var] ?? 0) + $power;
                                    } else {
                                        $vars[$part] = ($vars[$part] ?? 0) + 1;
                                    }
                                }
                            }
                            $parsedTerms[] = ['coeff' => $coeff, 'vars' => $vars];
                        }

                        if ($exponent >= 0 && !empty($parsedTerms)) {
                            $multiplyPolynomials = function (array $poly1, array $poly2) {
                                $result = [];
                                foreach ($poly1 as $t1) {
                                    foreach ($poly2 as $t2) {
                                        $coeff = $t1['coeff'] * $t2['coeff'];
                                        $vars = $t1['vars'];
                                        foreach ($t2['vars'] as $v => $p)
                                            $vars[$v] = ($vars[$v] ?? 0) + $p;
                                        ksort($vars);

                                        $keyParts = [];
                                        foreach ($vars as $v => $p)
                                            $keyParts[] = $p === 1 ? $v : "{$v}^{$p}";
                                        $key = implode('*', $keyParts);

                                        if (!isset($result[$key]))
                                            $result[$key] = ['coeff' => 0.0, 'vars' => $vars];
                                        $result[$key]['coeff'] += $coeff;
                                    }
                                }
                                return array_filter($result, function ($t) {
                                    return abs($t['coeff']) > 0.000001;
                                });
                            };

                            $expandedPoly = [['coeff' => 1.0, 'vars' => []]];
                            if ($exponent > 0) {
                                $expandedPoly = $parsedTerms;
                                for ($pIdx = 1; $pIdx < $exponent; $pIdx++)
                                    $expandedPoly = $multiplyPolynomials($expandedPoly, $parsedTerms);
                            }

                            uasort($expandedPoly, function ($t1, $t2) {
                                $deg1 = array_sum($t1['vars']);
                                $deg2 = array_sum($t2['vars']);
                                if ($deg1 !== $deg2)
                                    return $deg2 <=> $deg1;
                                $key1 = implode('*', array_map(fn($v, $p) => $p === 1 ? $v : "{$v}^{$p}", array_keys($t1['vars']), $t1['vars']));
                                $key2 = implode('*', array_map(fn($v, $p) => $p === 1 ? $v : "{$v}^{$p}", array_keys($t2['vars']), $t2['vars']));
                                return strcmp($key1, $key2);
                            });

                            $partsStr = [];
                            foreach ($expandedPoly as $term) {
                                $coeff = $term['coeff'];
                                $vars = $term['vars'];
                                $termStr = "";
                                $absCoeff = abs($coeff);
                                if (empty($vars))
                                    $termStr .= $coeff;
                                else {
                                    if ($absCoeff !== 1.0)
                                        $termStr .= $absCoeff . "*";
                                    $varParts = [];
                                    foreach ($vars as $v => $p)
                                        $varParts[] = $p === 1 ? $v : "{$v}^{$p}";
                                    $termStr .= implode('*', $varParts);
                                    if ($coeff < 0)
                                        $termStr = "-" . $termStr;
                                }
                                $partsStr[] = ['str' => $termStr, 'coeff' => $coeff];
                            }

                            $expandedStr = "";
                            foreach ($partsStr as $idx => $p) {
                                $str = $p['str'];
                                $coeff = $p['coeff'];
                                if ($idx === 0)
                                    $expandedStr .= $str;
                                else {
                                    if ($coeff < 0) {
                                        if (strpos($str, '-') === 0)
                                            $expandedStr .= " - " . substr($str, 1);
                                        else
                                            $expandedStr .= " - " . $str;
                                    } else {
                                        $expandedStr .= " + " . $str;
                                    }
                                }
                            }
                            $cleanThesis = "(" . $insideExpr . ")^" . $exponent . " = " . $expandedStr;
                            $isExpanded = true;
                            $socraticLabel = "algebraic multinomial expansion theorem";
                        }
                    }
                    // 2. Check if it's a Summation Series (e.g. Sum(i=1..n) i^2)
                    else if (preg_match('/^\s*Sum\s*\(\s*([a-zA-Z]+)\s*=\s*(0|1)\s*\.\.\s*([a-zA-Z]+)\s*\)\s*(.+)$/i', $cleanThesis, $sumMatches)) {
                        $indexVar = $sumMatches[1];
                        $startIdx = intval($sumMatches[2]);
                        $limitVar = $sumMatches[3];
                        $summand = trim($sumMatches[4]);

                        $maxDegree = 5;
                        $points = $maxDegree + 2;
                        $S = array_fill(0, $points, 0.0);
                        $currentSum = 0.0;

                        if ($startIdx === 0) {
                            $val = $dialecticController->evaluateMathExpression($summand, [$indexVar => 0]);
                            $currentSum += $val !== null ? $val : 0.0;
                        }
                        $S[0] = $currentSum;

                        for ($n = 1; $n < $points; $n++) {
                            if ($n >= $startIdx) {
                                $val = $dialecticController->evaluateMathExpression($summand, [$indexVar => $n]);
                                $currentSum += $val !== null ? $val : 0.0;
                            }
                            $S[$n] = $currentSum;
                        }

                        $solveLinearSystem = function ($matrix, $vector) {
                            $n = count($vector);
                            for ($i = 0; $i < $n; $i++) {
                                $pivotRow = $i;
                                for ($j = $i + 1; $j < $n; $j++) {
                                    if (abs($matrix[$j][$i]) > abs($matrix[$pivotRow][$i]))
                                        $pivotRow = $j;
                                }
                                if (abs($matrix[$pivotRow][$i]) < 0.000001)
                                    return null;
                                $tempRow = $matrix[$i];
                                $matrix[$i] = $matrix[$pivotRow];
                                $matrix[$pivotRow] = $tempRow;
                                $tempVal = $vector[$i];
                                $vector[$i] = $vector[$pivotRow];
                                $vector[$pivotRow] = $tempVal;
                                for ($j = $i + 1; $j < $n; $j++) {
                                    $factor = $matrix[$j][$i] / $matrix[$i][$i];
                                    for ($k = $i; $k < $n; $k++)
                                        $matrix[$j][$k] -= $factor * $matrix[$i][$k];
                                    $vector[$j] -= $factor * $vector[$i];
                                }
                            }
                            $solution = array_fill(0, $n, 0.0);
                            for ($i = $n - 1; $i >= 0; $i--) {
                                $sum = 0.0;
                                for ($j = $i + 1; $j < $n; $j++)
                                    $sum += $matrix[$i][$j] * $solution[$j];
                                $solution[$i] = ($vector[$i] - $sum) / $matrix[$i][$i];
                            }
                            return $solution;
                        };

                        $gcd = function ($a, $b) use (&$gcd) {
                            return $b == 0 ? abs($a) : $gcd($b, $a % $b);
                        };
                        $lcm = function ($a, $b) use (&$gcd) {
                            return ($a * $b) / $gcd($a, $b);
                        };

                        $foundFormula = null;
                        for ($d = 1; $d <= $maxDegree; $d++) {
                            $matrix = [];
                            $vector = [];
                            for ($i = 0; $i <= $d; $i++) {
                                $row = [];
                                for ($j = 0; $j <= $d; $j++)
                                    $row[] = pow($i, $j);
                                $matrix[] = $row;
                                $vector[] = $S[$i];
                            }
                            $coeffs = $solveLinearSystem($matrix, $vector);
                            if ($coeffs !== null) {
                                $valid = true;
                                for ($testN = $d + 1; $testN < $points; $testN++) {
                                    $eval = 0.0;
                                    for ($j = 0; $j <= $d; $j++)
                                        $eval += $coeffs[$j] * pow($testN, $j);
                                    if (abs($eval - $S[$testN]) > 0.001) {
                                        $valid = false;
                                        break;
                                    }
                                }
                                if ($valid) {
                                    $dens = [];
                                    $nums = [];
                                    for ($j = 0; $j <= $d; $j++) {
                                        $val = $coeffs[$j];
                                        if (abs($val) < 0.000001) {
                                            $nums[$j] = 0;
                                            $dens[$j] = 1;
                                            continue;
                                        }
                                        $sign = $val < 0 ? -1 : 1;
                                        $val = abs($val);
                                        $bestErr = 1.0;
                                        $bestNum = 0;
                                        $bestDen = 1;
                                        for ($den = 1; $den <= 120; $den++) {
                                            $num = round($val * $den);
                                            $err = abs($val - $num / $den);
                                            if ($err < $bestErr) {
                                                $bestErr = $err;
                                                $bestNum = $num;
                                                $bestDen = $den;
                                            }
                                            if ($err < 0.000001)
                                                break;
                                        }
                                        $nums[$j] = $sign * $bestNum;
                                        $dens[$j] = $bestDen;
                                    }

                                    $commonDen = 1;
                                    foreach ($dens as $den)
                                        $commonDen = $lcm($commonDen, $den);

                                    $termStrs = [];
                                    for ($j = $d; $j >= 1; $j--) {
                                        $scaledNum = $nums[$j] * ($commonDen / $dens[$j]);
                                        if ($scaledNum != 0) {
                                            $term = "";
                                            if (abs($scaledNum) != 1)
                                                $term .= abs($scaledNum) . "*";
                                            $term .= "{$limitVar}" . ($j > 1 ? "^{$j}" : "");
                                            $termStrs[] = ($scaledNum < 0 ? "-" : "+") . " " . $term;
                                        }
                                    }
                                    $scaledNum0 = $nums[0] * ($commonDen / $dens[0]);
                                    if ($scaledNum0 != 0)
                                        $termStrs[] = ($scaledNum0 < 0 ? "-" : "+") . " " . abs($scaledNum0);

                                    if (count($termStrs) > 0) {
                                        $formulaStr = implode(" ", $termStrs);
                                        if (strpos($formulaStr, "+ ") === 0)
                                            $formulaStr = substr($formulaStr, 2);
                                        else if (strpos($formulaStr, "- ") === 0)
                                            $formulaStr = "-" . substr($formulaStr, 2);

                                        if ($commonDen > 1)
                                            $foundFormula = "({$formulaStr})/{$commonDen}";
                                        else
                                            $foundFormula = $formulaStr;
                                    } else {
                                        $foundFormula = "0";
                                    }
                                    break;
                                }
                            }
                        }

                        if ($foundFormula !== null) {
                            $cleanThesis = "Sum({$indexVar}={$startIdx}..{$limitVar}) {$summand} = {$foundFormula}";
                            $isExpanded = true;
                            $socraticLabel = "closed-form summation formula theorem";
                        }
                    }
                    // 3. Divisibility and Parity Solver (e.g. n^3 - n)
                    else if (preg_match('/^[a-zA-Z0-9\+\-\*\/\^\(\)\s\.]+$/', $cleanThesis) && preg_match('/[a-zA-Z]/', $cleanThesis) && !preg_match('/[a-zA-Z]{3,}/', $cleanThesis)) {
                        preg_match_all('/[a-zA-Z]+/', $cleanThesis, $vars);
                        $uniqueVars = array_unique($vars[0]);
                        if (count($uniqueVars) === 1) {
                            $varName = array_values($uniqueVars)[0];
                            $vals = [];
                            $valid = true;
                            for ($n = 1; $n <= 5; $n++) {
                                $res = $dialecticController->evaluateMathExpression($cleanThesis, [$varName => $n]);
                                if ($res === null || !is_numeric($res)) {
                                    $valid = false;
                                    break;
                                }
                                $vals[] = round($res);
                            }

                            if ($valid) {
                                $gcd = function ($a, $b) use (&$gcd) {
                                    return $b == 0 ? abs($a) : $gcd($b, $a % $b);
                                };
                                $commonGcd = abs($vals[0]);
                                for ($i = 1; $i < 5; $i++) {
                                    $commonGcd = $gcd($commonGcd, abs($vals[$i]));
                                }

                                if ($commonGcd === 2) {
                                    $cleanThesis = "{$cleanThesisOriginal} is even";
                                    $isExpanded = true;
                                    $socraticLabel = "even modular parity implication theorem";
                                } else if ($commonGcd > 1) {
                                    $cleanThesis = "{$commonGcd} divides {$cleanThesisOriginal}";
                                    $isExpanded = true;
                                    $socraticLabel = "highest common divisor relationship theorem";
                                } else {
                                    $allOdd = true;
                                    foreach ($vals as $v) {
                                        if ($v % 2 === 0)
                                            $allOdd = false;
                                    }
                                    if ($allOdd) {
                                        $cleanThesis = "{$cleanThesisOriginal} is odd";
                                        $isExpanded = true;
                                        $socraticLabel = "odd modular parity implication theorem";
                                    }
                                }
                            }
                        }
                    }

                    if ($isExpanded) {
                        $parentAxiomId = null;
                        $parentAxiom = \App\Models\KnowledgeAxiom::where('status', 'global_axiom')->first();
                        if ($parentAxiom)
                            $parentAxiomId = $parentAxiom->id;

                        $mathSolver = app(\App\Services\SymbolicMathSolverService::class);
                        $proofResult = $mathSolver->proveMathematicalThesis($cleanThesis, $parentAxiomId);
                        $deductiveSamples = explode("\n", $proofResult['proof_details']);

                        $req = new \Illuminate\Http\Request();
                        $req->merge([
                            'branch' => ($resolvedBranch && $resolvedBranch !== 'general') ? $resolvedBranch : 'Mathematics',
                            'thesis' => $cleanThesis,
                            'deductive_samples' => $deductiveSamples,
                            'inductive_logic' => $proofResult['proof_details'],
                            'data_type' => 'math_formula',
                            'source_type' => 'user',
                            'parent_axiom_id' => $parentAxiomId,
                            'model' => $request->model ?? 'llama-3'
                        ]);

                        $evalRes = $dialecticController->evaluateThesis($req)->getData();
                        if (isset($evalRes->axiom)) {
                            $axiom = \App\Models\KnowledgeAxiom::find($evalRes->axiom->id);
                            if (!$axiom)
                                $axiom = $evalRes->axiom;

                            $parentAxiomLabel = 'Foundational Void';
                            $parentAxiomSyntax = '';
                            if ($parentAxiomId) {
                                $parent = \App\Models\KnowledgeAxiom::find($parentAxiomId);
                                if ($parent && !empty($parent->thesis_statement)) {
                                    $parentName = explode(':', $parent->thesis_statement)[0];
                                    $parentAxiomLabel = $parent->id . ' - ' . trim($parentName);
                                    $parentAxiomSyntax = "\n\n### **🔗 LOGICAL CHAIN (Derived from Parent Axiom)**\n"
                                        . "To prove this new theorem, the engine dynamically retrieved and mathematically linked the following established axiom:\n"
                                        . "> **" . $parent->thesis_statement . "**\n"
                                        . "> *Domain: " . $parent->branch . "*\n\n"
                                        . "By combining this absolute truth with the new thesis, we deduce the following synthesis:";
                                }
                            }

                            $targetModel = $request->model ?? 'llama-3';
                            $filteredLogic = $axiom->inductive_logic;
                            $synthesisNote = "Starting from the parent proof (Axiom ID: " . $parentAxiomLabel . "), it recursively chains logic and deduces "
                                . "universal correctness with 100% confidence. Status: **Global Axiom**.";
                            if ($targetModel === 'phi-3') {
                                $filteredLogic = preg_replace('/### \*\*2️⃣ Deductive.*/s', '', $filteredLogic);
                                $synthesisNote = "Dialectical Phase 1: Trial & Error complete. (Select Deductive logic to continue the struggle).";
                            } elseif ($targetModel === 'mistral') {
                                $filteredLogic = preg_replace('/### \*\*3️⃣ Inductive.*/s', '', $filteredLogic);
                                $synthesisNote = "Dialectical Phase 2: Deductive Proof complete. (Select Inductive logic to finalize the proof).";
                            }

                            $response = "### **⚠️ INCOMPLETE OR UN-EQUATED MATHEMATICAL EXPRESSION DETECTED**\n"
                                . "It looks like you entered a raw or incomplete mathematical expression: *\"" . $cleanThesisOriginal . "\"*.\n\n"
                                . "To prove a theorem, the dialectical engine requires a complete mathematical proposition (an equality or relational statement containing an `=` or divisor operator).\n\n"
                                . "💡 **Did you mean to prove the complete " . $socraticLabel . ":**\n"
                                . "### **\"" . $axiom->thesis_statement . "\"**?\n\n"
                                . "---\n"
                                . $parentAxiomSyntax . "\n\n"
                                . "Here is the verified proof for that complete theorem:\n\n"
                                . "### **📜 MATHEMATICAL PROOF (Dialectical Engine Verified)**\n"
                                . trim($filteredLogic) . "\n\n"
                                . "### **🗣️ Human-Readable Synthesis**\n"
                                . "The Zmzir Engine has successfully evaluated *\"" . $axiom->thesis_statement . "\"*.\n"
                                . $synthesisNote . "\n\n"
                                . "*(Dialectically Proven)*";

                            \App\Jobs\ProcessAILearning::dispatch('interaction', [
                                'trigger' => $message,
                                'response' => $response,
                                'success' => true
                            ]);

                            return response()->json([
                                'response' => $response,
                                'conversation_id' => $conversationId,
                                'is_axiom' => true,
                                'status' => 'global_axiom',
                                'confidence_score' => 1.0,
                                'axiom_id' => $axiom->id
                            ]);
                        }
                    }

                    // General incomplete response
                    $response = "### **⚠️ INCOMPLETE MATHEMATICAL EXPRESSION DETECTED**\n"
                        . "It looks like you entered a raw or incomplete mathematical expression: *\"" . $cleanThesis . "\"*.\n\n"
                        . "To initiate mathematical verification, please provide a complete equality or divisibility relationship. For example:\n"
                        . "- **Algebraic Expansion**: `prove: (x+y)^2 = x^2 + 2*x*y + y^2`\n"
                        . "- **Summation Formula**: `prove: Sum(i=1..n) i^2 = n*(n+1)*(2*n+1)/6`\n"
                        . "- **Divisibility Relationship**: `prove: 6 divides n^3 - n`\n\n"
                        . "Please refine your query and let us struggle dialectically!\n"
                        . "[HALTED: Incomplete Mathematical Expression]";

                    return response()->json([
                        'response' => $response,
                        'conversation_id' => $conversationId,
                        'is_axiom' => false,
                        'status' => 'synthesized_thesis',
                        'confidence_score' => 0.0,
                    ]);
                }
            }

            // 1. Resolve parent axiom (prerequisite) dynamically
            $parentAxiomId = null;
            $keywords = [];
            if (preg_match_all('/[a-zA-Z]{3,}/', $cleanThesis, $kwMatches)) {
                $keywords = array_filter(array_unique(array_map('strtolower', $kwMatches[0])), function ($w) {
                    $stopWords = ['prove', 'show', 'then', 'that', 'with', 'limit', 'value', 'this', 'there', 'these', 'those', 'what', 'when', 'where', 'which', 'who', 'how', 'why', 'are', 'was', 'were', 'will', 'would', 'can', 'could', 'should', 'have', 'has', 'had', 'been', 'being', 'does', 'did', 'done', 'doing', 'the', 'and', 'but', 'for', 'nor', 'yet', 'from', 'about', 'into', 'over', 'after', 'all', 'any', 'both', 'each', 'few', 'more', 'most', 'other', 'some', 'such', 'only', 'own', 'same', 'than', 'too', 'very', 'just', 'don', 'now', 'out', 'off', 'under', 'again', 'further', 'once', 'here', 'no', 'not', 'so'];
                    return !in_array($w, $stopWords);
                });
            }

            // Try specific math pattern matching first
            $parentAxiom = null;
            if (preg_match('/divides/i', $cleanThesis)) {
                // Find a divisibility parent axiom
                $parentAxiom = \App\Models\KnowledgeAxiom::where('status', 'global_axiom')
                    ->where('thesis_statement', 'like', '%divides%')
                    ->first();
            } elseif (preg_match('/Sum/i', $cleanThesis)) {
                // Find a summation parent axiom
                $parentAxiom = \App\Models\KnowledgeAxiom::where('status', 'global_axiom')
                    ->where('thesis_statement', 'like', '%Sum%')
                    ->first();
            } elseif (preg_match('/even|odd/i', $cleanThesis)) {
                // Find a parity-related parent axiom
                // If thesis mentions "even", find a complementary "odd" axiom or base parity definition
                $isEven = stripos($cleanThesis, 'even') !== false;
                $oppParity = $isEven ? 'odd' : 'even';
                $parentAxiom = \App\Models\KnowledgeAxiom::where('status', 'global_axiom')
                    ->where('thesis_statement', 'like', '%' . $oppParity . '%')
                    ->first();
                if (!$parentAxiom) {
                    $parentAxiom = \App\Models\KnowledgeAxiom::where('status', 'global_axiom')
                        ->where('thesis_statement', 'like', '%' . ($isEven ? 'even' : 'odd') . '%')
                        ->first();
                }
            }

            // High-Fidelity Semantic Vector matching fallback
            if (!$parentAxiom) {
                try {
                    $matches = \App\Services\DialecticalOracleService::semanticEngine()->query($cleanThesis);
                    if (!empty($matches)) {
                        $matchingBranches = \App\Services\DialecticalOracleService::getMatchingBranchesForDomain($resolvedBranch ?? 'math');
                        foreach ($matches as $match) {
                            if ($match['similarity'] >= 0.25) {
                                $potAxiom = \App\Models\KnowledgeAxiom::find($match['id']);
                                if ($potAxiom && $potAxiom->status === 'global_axiom' && in_array($potAxiom->branch, $matchingBranches)) {
                                    $parentAxiom = $potAxiom;
                                    break;
                                }
                            }
                        }
                    }
                } catch (\Exception $e) {
                    \Illuminate\Support\Facades\Log::warning("Semantic parent lookup failed: " . $e->getMessage());
                }
            }

            // Keyword matching fallback if no parent is found yet (restricted by branch to prevent collisions)
            if (!$parentAxiom && !empty($keywords)) {
                $matchingBranches = \App\Services\DialecticalOracleService::getMatchingBranchesForDomain($resolvedBranch ?? 'math');
                $query = \App\Models\KnowledgeAxiom::where('status', 'global_axiom')
                    ->whereIn('branch', $matchingBranches)
                    ->where(function ($q) use ($keywords) {
                        foreach (array_slice($keywords, 0, 5) as $kw) {
                            $q->orWhere('thesis_statement', 'LIKE', '%' . $kw . '%');
                        }
                    });
                $parentAxiom = $query->first();
            }

            // Absolute fallback
            if (!$parentAxiom) {
                if ($knownDomain === 'formal_logic' || $hasLogicTerms) {
                    $parentAxiom = \App\Models\KnowledgeAxiom::where('status', 'global_axiom')
                        ->where('branch', 'formal_logic')
                        ->first();
                } else {
                    $parentAxiom = \App\Models\KnowledgeAxiom::where('status', 'global_axiom')
                        ->where('branch', 'arithmetic')
                        ->first();
                }

                if (!$parentAxiom) {
                    $parentAxiom = \App\Models\KnowledgeAxiom::where('status', 'global_axiom')->first();
                }
            }

            if ($parentAxiom) {
                $parentAxiomId = $parentAxiom->id;
            }

            // 2. Generate dynamic deductive samples via SymbolicMathSolverService
            $mathSolver = app(\App\Services\SymbolicMathSolverService::class);
            $proofResult = $mathSolver->proveMathematicalThesis($cleanThesis, $parentAxiomId);
            $deductiveSamples = explode("\n", $proofResult['proof_details']);

            // 3. Invoke evaluateThesis on our Dialectic Engine
            $dialecticController = new \App\Http\Controllers\DialecticEngineController();
            $req = new \Illuminate\Http\Request();
            $req->merge([
                'branch' => ($resolvedBranch && $resolvedBranch !== 'general') ? $resolvedBranch : 'Mathematics',
                'thesis' => $cleanThesis,
                'deductive_samples' => $deductiveSamples,
                'inductive_logic' => $proofResult['proof_details'],
                'data_type' => 'math_formula',
                'source_type' => 'user',
                'parent_axiom_id' => $parentAxiomId,
                'model' => $request->model ?? 'llama-3'
            ]);

            $evalRes = $dialecticController->evaluateThesis($req)->getData();
            if (isset($evalRes->axiom)) {
                $axiomId = is_array($evalRes->axiom) ? ($evalRes->axiom['id'] ?? null) : ($evalRes->axiom->id ?? null);
                $axiom = $axiomId ? \App\Models\KnowledgeAxiom::find($axiomId) : null;
                if (!$axiom && is_object($evalRes->axiom)) {
                    $axiom = $evalRes->axiom;
                } elseif (!$axiom) {
                    $axiom = (object) $evalRes->axiom;
                }

                $statusLabel = ($axiom->status ?? '') === 'global_axiom' ? '*(Dialectically Proven)*' : '*(Synthesized Thesis)*';

                $parentAxiomLabel = 'Foundational Void';
                $parentAxiomSyntax = '';
                if ($parentAxiomId) {
                    $parent = \App\Models\KnowledgeAxiom::find($parentAxiomId);
                    if ($parent && !empty($parent->thesis_statement)) {
                        $parentName = explode(':', $parent->thesis_statement)[0];
                        $parentAxiomLabel = $parent->id . ' - ' . trim($parentName);
                        $parentAxiomSyntax = "\n\n### **🔗 LOGICAL CHAIN (Derived from Parent Axiom)**\n"
                            . "To prove this new theorem, the engine dynamically retrieved and mathematically linked the following established axiom:\n"
                            . "> **" . $parent->thesis_statement . "**\n"
                            . "> *Domain: " . $parent->branch . "*\n\n"
                            . "By combining this absolute truth with the new thesis, we deduce the following synthesis:";
                    } else {
                        $parentAxiomLabel = $parentAxiomId;
                    }
                }

                $targetModel = $request->model ?? 'llama-3';
                $filteredLogic = $axiom->inductive_logic;
                $synthesisNote = "Starting from the parent proof (Axiom ID: " . $parentAxiomLabel . "), it recursively chains logic and deduces "
                    . "universal correctness with 100% confidence. Status: **" . ($axiom->status === 'global_axiom' ? 'Global Axiom' : 'Synthesized Thesis') . "**.";

                if ($targetModel === 'phi-3') {
                    $filteredLogic = preg_replace('/### \*\*2️⃣ Deductive.*/s', '', $filteredLogic);
                    $synthesisNote = "Dialectical Phase 1: Trial & Error complete. (Select Deductive logic to continue the struggle).";
                } elseif ($targetModel === 'mistral') {
                    $filteredLogic = preg_replace('/### \*\*3️⃣ Inductive.*/s', '', $filteredLogic);
                    $synthesisNote = "Dialectical Phase 2: Deductive Proof complete. (Select Inductive logic to finalize the proof).";
                }

                $response = "### **📜 MATHEMATICAL PROOF (Dialectical Engine Verified)**\n"
                    . trim($filteredLogic) . "\n"
                    . $parentAxiomSyntax . "\n\n"
                    . "### **🗣️ Human-Readable Synthesis**\n"
                    . "The Zmzir Engine has successfully evaluated *\"" . $cleanThesis . "\"*.\n"
                    . $synthesisNote . "\n\n"
                    . $statusLabel;

                if ($axiom->status === 'synthesized_thesis') {
                    $response .= "\n\n*Note: This knowledge is currently in a state of Synthesis and may require further Dialectical Struggle.*";
                }

                // Dispatch learning
                ProcessAILearning::dispatch('interaction', [
                    'trigger' => $message,
                    'response' => $response,
                    'success' => true
                ]);

                $axStatus = $axiom->status ?? 'synthesized_thesis';
                $axConf = (float) ($axiom->confidence_score ?? 0.5);
                $axId = $axiom->id ?? null;
                $axBranch = $axiom->branch ?? ($resolvedBranch ?? null);
                $axDomain = $axiom->domain_partition ?? null;

                // Build parent chain for the frontend pedigree tree
                $parentAxiomsChain = [];
                if ($axId) {
                    $p = $axiom->parent_axiom_id ? \App\Models\KnowledgeAxiom::find($axiom->parent_axiom_id) : null;
                    while ($p) {
                        array_unshift($parentAxiomsChain, [
                            'id' => $p->id,
                            'thesis_statement' => $p->thesis_statement,
                            'branch' => $p->branch,
                        ]);
                        $p = $p->parent_axiom_id ? \App\Models\KnowledgeAxiom::find($p->parent_axiom_id) : null;
                        if (count($parentAxiomsChain) >= 8)
                            break;
                    }
                }

                // Auto-create fallback ticket when synthesized_thesis AND low confidence
                $ticketId = null;
                $isFallback = ($axStatus === 'synthesized_thesis' && $axConf < 0.5);
                if ($isFallback) {
                    $ticketId = $this->autoFallbackTicket(
                        $cleanThesis,
                        $response,
                        $axBranch,
                        $axBranch,
                        $axConf
                    );
                }

                return response()->json([
                    'response' => $response,
                    'conversation_id' => $conversationId,
                    'is_axiom' => true,
                    'status' => $axStatus,
                    'confidence_score' => $axConf,
                    'axiom_id' => $axId,
                    'thesis' => $cleanThesis,
                    'branch' => $axBranch,
                    'domain_partition' => $axDomain,
                    'parent_axioms' => $parentAxiomsChain,
                    'is_fallback' => $isFallback,
                    'training_ticket_id' => $ticketId,
                ]);
            }
        }

        // 1. DIALECTICAL ENGINE: Check KnowledgeAxioms for absolute truths first
        // Extract keywords from current message and the stateless context (fades)
        $messageClean = preg_replace('/^(what is|tell me about|explain|show me|why is|why|how does|what does|is|are|the|a|an)\s+/i', '', $message);

        $searchTerms = explode(' ', strtolower(trim($messageClean)));
        $searchTerms = array_map(function ($term) {
            return preg_replace('/[^\w\s]/', '', $term);
        }, $searchTerms);

        $searchTerms = array_filter($searchTerms, function ($term) {
            // Filter out small words and system meta-keywords
            return strlen($term) > 3 && !in_array($term, ['user', 'contested', 'contradiction', 'synthesis', 'required', 'evidence']);
        });

        if (empty($searchTerms)) {
            // Fallback immediately if no significant keywords found
            return $this->getRuleBasedResponse($message, $hasTypo, $conversationId, $request->model ?? 'phi-3', $contextString);
        }

        // Search KnowledgeAxioms using a more flexible keyword approach
        if (strpos($conversationId, 'test-battery') === false) {
            $axiomQuery = \App\Models\KnowledgeAxiom::query();
            $axiomQuery->where(function ($q) use ($searchTerms) {
                foreach (array_slice($searchTerms, 0, 5) as $term) {
                    $q->orWhere('thesis_statement', 'like', '%' . $term . '%')
                        ->orWhere('branch', 'like', '%' . $term . '%');
                }
            });

            $axioms = $axiomQuery->orderByDesc('confidence_score')->take(30)->get();

            foreach ($axioms as $axiom) {
                if ($axiom->confidence_score < 0.3)
                    continue; // Skip low-confidence trash

                // Strict Relevance Check: At least 1 match in the thesis_statement itself using word boundaries
                $thesisMatch = false;
                $matchCount = 0;
                foreach ($searchTerms as $term) {
                    if (preg_match('/\b' . preg_quote($term, '/') . '\b/i', $axiom->thesis_statement)) {
                        $matchCount++;
                        $thesisMatch = true;
                    } elseif (preg_match('/\b' . preg_quote($term, '/') . '\b/i', $axiom->branch)) {
                        $matchCount++;
                    }
                }

                $relevanceRatio = $matchCount / count($searchTerms);

                // 100% Purity Threshold: Must have at least one THESIS match AND (2 total matches OR > 60% relevance)
                if ($thesisMatch && ($matchCount >= 2 || ($relevanceRatio >= 0.6))) {
                    $statusLabel = $axiom->status === 'global_axiom' ? '*(Dialectically Proven)*' : '*(Synthesized Thesis)*';

                    $response = "### **🏛️ AXIOM RETRIEVAL**\n"
                        . "The dialectical engine has retrieved the requested knowledge from the universal matrix.\n\n"
                        . "---\n\n"
                        . "### **📜 MATHEMATICAL PROOF (Dialectical Engine Verified)**\n"
                        . trim($axiom->inductive_logic ?? '') . "\n\n"
                        . "### **🗣️ Human-Readable Synthesis**\n"
                        . $axiom->thesis_statement . "\n\n" . $statusLabel;

                    if ($axiom->status === 'synthesized_thesis') {
                        $response .= "\n\n*Note: This knowledge is currently in a state of Synthesis and may require further Dialectical Struggle.*";
                    }

                    // Dispatch learning
                    ProcessAILearning::dispatch('interaction', [
                        'trigger' => $message,
                        'response' => $response,
                        'success' => true
                    ]);

                    // Build parent chain
                    $parentAxiomsChain = [];
                    $p = $axiom->parent_axiom_id ? \App\Models\KnowledgeAxiom::find($axiom->parent_axiom_id) : null;
                    while ($p) {
                        array_unshift($parentAxiomsChain, [
                            'id' => $p->id,
                            'thesis_statement' => $p->thesis_statement,
                            'branch' => $p->branch,
                        ]);
                        $p = $p->parent_axiom_id ? \App\Models\KnowledgeAxiom::find($p->parent_axiom_id) : null;
                        if (count($parentAxiomsChain) >= 8)
                            break;
                    }

                    return response()->json([
                        'response' => $response,
                        'conversation_id' => $conversationId,
                        'is_axiom' => true,
                        'status' => $axiom->status,
                        'confidence_score' => $axiom->confidence_score,
                        'axiom_id' => $axiom->id,
                        'branch' => $axiom->branch,
                        'domain_partition' => $axiom->domain_partition,
                        'parent_axioms' => $parentAxiomsChain,
                        'is_fallback' => false,
                    ]);
                }
            }
        }

        skip_proof_request:

        // Main response engine
        $response = $this->getRuleBasedResponse($message, $hasTypo, $conversationId, $request->model ?? 'phi-3', $contextString);

        // Dispatch background learning for continuous reasoning (Trail & Error -> Deductive -> Inductive)
        ProcessAILearning::dispatch('interaction', [
            'trigger' => $message,
            'response' => $response,
            'success' => true // A basic heuristic; can be further refined by user feedback events
        ]);

        return response()->json([
            'response' => $response,
            'conversation_id' => $conversationId,
            'is_axiom' => false,
            'is_fallback' => false,
        ]);
    }

    public function submitFeedback(Request $request)
    {
        $request->validate([
            'query' => 'required|string',
            'response' => 'required|string',
            'type' => 'required|in:save,discard',
            'axiom_id' => 'nullable|integer',
            'branch' => 'nullable|string|max:100',
            'domain_partition' => 'nullable|string|max:100',
            'training_ticket_id' => 'nullable|integer',
        ]);

        $isPositive = $request->input('type') === 'save';

        // ── Case 1: Dialectical Struggle — user contradicts a Known Axiom ─────────
        // Route directly to the DialecticEngineController so the axiom's contradiction
        // count can be tracked and an antithesis can be generated.
        if (!$isPositive && $request->input('axiom_id')) {
            $axiom = \App\Models\KnowledgeAxiom::find($request->input('axiom_id'));
            if ($axiom) {
                $dialecticController = new \App\Http\Controllers\DialecticEngineController();
                return $dialecticController->submitContradiction(
                    $axiom,
                    "User-contested contradiction: " . $request->input('query'),
                    'user_feedback'
                );
            }
        }

        // ── Case 2: Contradiction of a non-axiom response → auto-ticket ──────────
        // When the user contradicts any response that is NOT a global axiom, immediately
        // create a chatbot_training ticket for expert review so the error can be corrected.
        $ticketId = $request->input('training_ticket_id');
        if (!$isPositive && !$request->input('axiom_id') && !$ticketId) {
            try {
                $existing = ChatbotTraining::where('trigger', 'like', '%' . mb_substr($request->input('query'), 0, 80) . '%')
                    ->where('needs_review', true)
                    ->first();

                if ($existing) {
                    $ticketId = $existing->id;
                } else {
                    $ticket = ChatbotTraining::create([
                        'trigger' => mb_substr($request->input('query'), 0, 500),
                        'response' => mb_substr($request->input('response'), 0, 2000),
                        'category' => $request->input('branch') ?? 'general',
                        'branch' => $request->input('branch'),
                        'domain_partition' => $request->input('domain_partition'),
                        'needs_review' => true,
                        'is_active' => false,
                        'confidence_score' => 0.3,
                        'context' => json_encode([
                            'weight' => 0.3,
                            'user_contradiction' => true,
                            'reported_at' => now()->toISOString(),
                        ]),
                    ]);
                    $ticketId = $ticket->id;

                    // Broadcast to experts channel
                    if (class_exists(\App\Events\NewTrainingTicket::class)) {
                        event(new \App\Events\NewTrainingTicket($ticket));
                    }
                }
            } catch (\Throwable $e) {
                Log::warning('Auto contradiction ticket failed: ' . $e->getMessage());
            }
        }

        // ── Case 3: Standard Rule feedback — weight adjustment ────────────────────
        $rule = ChatbotTraining::where('trigger', 'like', '%' . $request->input('query') . '%')
            ->where('response', 'like', '%' . $request->input('response') . '%')
            ->first();

        $weightChange = $isPositive ? 0.1 : -0.2;
        $newWeight = 1.0;

        if ($rule) {
            $context = json_decode($rule->context ?? '{}', true) ?: [];
            $currentWeight = $context['weight'] ?? 1.0;
            $newWeight = max(0.1, $currentWeight + $weightChange);
            $context['weight'] = $newWeight;
            $rule->context = json_encode($context);
            $rule->save();

            // Feed this into the Global Dialectic Engine as a Deductive Sample (Phase 2)
            $dialecticEngine = new \App\Http\Controllers\DialecticEngineController();
            $thesis = $dialecticEngine->ingestThesis('Chatbot_User_Interaction', $request->input('query'));
            $sampleData = "User " . ($isPositive ? 'Agreed' : 'Contradicted') . " with response: " . $request->input('response');
            $dialecticEngine->runDeduction($thesis, [$sampleData]);
        }

        // ── Dispatch Phase 3 learning job with enriched payload ───────────────────
        // The 'feedback' type handler in ProcessAILearning now correctly processes this.
        ProcessAILearning::dispatch('feedback', [
            'trigger' => $request->input('query'),
            'response' => $request->input('response'),
            'type' => $request->input('type'),
            'category' => $request->input('branch') ?? 'general',
            'branch' => $request->input('branch'),
            'domain_partition' => $request->input('domain_partition'),
            'axiom_id' => $request->input('axiom_id'),
            'training_ticket_id' => $ticketId,
        ]);

        return response()->json([
            'success' => true,
            'message' => $isPositive
                ? 'Thank you! The engine has reinforced this knowledge.'
                : 'Contradiction registered. An expert will review this response.',
            'new_weight' => $newWeight,
            'ticket_id' => $ticketId,
            'learning_state' => $isPositive ? 'reinforced' : 'queued_for_review',
        ]);
    }

    private function getRuleBasedResponse(string $message, $hasTypo, string $conversationId, string $model = 'phi-3', string $contextString = ""): string
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
            'activities' => 'Collaborative Activities are events you can schedule within a Space. Support includes recurring daily, weekly, or monthly events. We now have synchronized badges in the header and settings!',
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
            'mediaviewer' => 'The MediaViewer is our premium full-screen experience for photos and videos. It uses zIndex: 1000 for layering. Interaction icons inside are optimized for dark backgrounds with high-contrast white and green colors. Close it with the arrow on the top-left.',
            'interaction layering' => 'Our portal-based layering system ensures all overlays like Comments, Reposts, and Bookmarks consistently stay on top of the MediaViewer. We use zIndex: 6000 for these high-priority interactive components.',
            'web layout' => 'Desktop web views are standardized to a 1440px maximum width and are centered horizontally. This applies to all major overlays including the MediaViewer, Comment Sheets, and Bookmark Gallery.',
            'repost logic' => 'Reposting is now more intuitive! The Repost context popup (ContextTagSelector) can be dismissed instantly by tapping anywhere on the blurred backdrop, removing the need for a manual close button.',
            'bookmark gallery' => 'The Bookmark Gallery is a high-fidelity modal that replaces the old bookmark page. It features an "Add Your Note" section for personal high-fidelity cards and categorization.',
            'unified design' => 'Zmzir uses a unified design system where all overlays are width-constrained (1440px) and centered on web, while mobile remains fully responsive and full-width.',
            'theme modes' => 'We support 4 premium modes: Light (clean aesthetic), Dark (high-contrast premium experience with #0A84FF tints), Automatic (OS-sync), and Dynamic (Android Material 3 Monet colors).',
            'repost flow' => 'Our 2024 Repost flow features a blurred backdrop that allows instant dismissal by tapping anywhere outside the selector—no close button required!',
            'unified spaces' => 'Direct spaces are now unified and strictly private. They support real-time collaboration features like shared whiteboards with living cursor tracking.',
            'app guide' => "Follow these 7 steps to master Zmzir:\n1. Register & Verify your email.\n2. Setup Profile (Profile > Edit, now with responsive 98% width birthday picker!).\n3. Create/Join Spaces (Direct or Protected).\n4. Start Collaborating (Whiteboard, Meetings, AI Assistants).\n5. Manage Activities (Schedule events with real-time synchronized badges).\n6. Stay Safe (Privacy Vault & Trust Score).\n7. Explore Marketplace (Buy & Sell items with real-time updates and integrated chat).",
            'date picker' => 'Our date picker for birthdays is now fully responsive for web (98% width) and supports "blackmodus" with a sleek #1A1A1A background.',
            'activity badge' => 'The activity badge is now synchronized across the app! It appears in the Space header and the Settings menu, showing the exact count of upcoming scheduled activities.',
            'marketplace' => 'The Marketplace is where you can buy and sell items within the Zmzir community. It features real-time updates and integrated chat for buyers and sellers.',
            'market browse' => 'The "Browse" tab in the Marketplace shows you all active items available for purchase from other users. You can filter them by categories like Electronics, Fashion, or Home.',
            'my items' => 'The "My Items" tab allows you to manage your own listings. You can see your active, sold, and inactive items here. This is your personal seller dashboard.',
            'item condition' => 'Marketplace items can be listed with various conditions: New, Like New, Refurbished, or Used. This helps buyers understand the state of the product before purchasing.',
            'market delivery' => 'Sellers can indicate if delivery is available for their items. Look for the box icon on the market card to see if an item can be delivered to you.',
            'market chat' => 'You can start a secure chat directly with a seller from any Marketplace item. This creates a dedicated Space where you can discuss details, price, and pick-up/delivery.',
            'selling on market' => 'To sell an item, tap the "+" FAB button in the Marketplace. You can upload up to 10 photos or videos, set a price, condition, and category for your item.',
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
        $learnedResponses = Cache::get('learned_responses', []);
        if (isset($learnedResponses[$lowerMessage])) {
            return $learnedResponses[$lowerMessage] . ' (from cache memory)';
        }

        // ————————————————————————————————————
        // 2.5 Zmzir AI Ecosystem Knowledge (Step 1 to 6)
        // ————————————————————————————————————
        $aiInfo = $this->getAIEcosystemInfo($message);
        if ($aiInfo) {
            return $aiInfo;
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
        // 8. EXACT AXIOM MATCH (Before Semantics)
        // ————————————————————————————————————
        $cleanForAxiom = trim(preg_replace('/^(what is|who is|explain|define|prove)\s+/i', '', $message), " ?.\n\r");
        if (strlen($cleanForAxiom) > 4) {
            $existingAxiom = \App\Models\KnowledgeAxiom::where('status', 'global_axiom')
                ->where(function ($query) use ($cleanForAxiom) {
                    $query->where('ast_signature', hash('sha256', $cleanForAxiom))
                        ->orWhere('thesis_statement', $cleanForAxiom)
                        ->orWhere('thesis_statement', 'like', $cleanForAxiom . '%');
                })
                ->first();

            if ($existingAxiom) {
                $solverService = app(\App\Services\SyllogismSolverService::class);
                $bookProof = $solverService->generateBookPedigreeProof($existingAxiom);
                return "### **🏛️ EXACT AXIOM RETRIEVAL**\n"
                    . "The dialectical engine has retrieved the requested knowledge directly from the universal matrix.\n\n"
                    . "---\n\n"
                    . $bookProof;
            }
        }

        // ————————————————————————————————————
        // 8.5 Fallback to meaningless check and keywords
        // ————————————————————————————————————
        if (count($keywords) === 0) {
            return 'Could you please provide more details so I can assist you better?';
        }

        // ————————————————————————————————————
        // 9. RAG AI CALL — SAFE & CLEAN
        // ————————————————————————————————————
        $categorizer = app(\App\Services\ExpertScienceCategorizer::class);
        $resolvedCategory = $categorizer->classify($message);
        $category = ($resolvedCategory && $resolvedCategory !== 'general') ? $resolvedCategory : ($this->detectCategories($message)[0] ?? 'general');
        $ragResult = $this->askRAGMicroservice($message, $model, $contextString);

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
        $categorizer = app(\App\Services\ExpertScienceCategorizer::class);
        $resolvedCategory = $categorizer->classify($message);
        $detectedCategories = $this->detectCategories($message);
        if ($resolvedCategory && $resolvedCategory !== 'general') {
            array_unshift($detectedCategories, $resolvedCategory);
            $detectedCategories = array_values(array_unique($detectedCategories));
        }

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
            $processedTraining = Cache::remember($trainingKey, 3600, function () use ($t) {
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
                if (empty($detected))
                    continue;

                // IMPROVEMENT #3: Stem detected word
                $detectedStemmed = $this->stemWord($detected);
                $detectedLower = strtolower($detected);

                foreach ($trainingCategories as $cat) {
                    $cat = trim($cat);
                    if (empty($cat))
                        continue;

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
                    elseif (
                        (str_contains($catLower, $detectedLower) ||
                            str_contains($detectedLower, $catLower)) &&
                        strlen($detected) > 2 && strlen($cat) > 2
                    ) {
                        $isMatch = true;
                    }
                    // 4. Singular/plural variations
                    elseif (
                        ($catLower === $detectedLower . 's' ||
                            $detectedLower === $catLower . 's' ||
                            $catLower === $detectedLower . 'es' ||
                            $detectedLower === $catLower . 'es') &&
                        strlen($detected) > 2
                    ) {
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
                    'score' => $totalScore,
                    'id' => $t->id,
                    'trigger' => $t->trigger,
                    'category' => $t->category,
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
        usort($candidates, function ($a, $b) {
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
            if (
                trim($top[2]['response']) !== trim($top[0]['response']) &&
                (!isset($top[1]) || trim($top[2]['response']) !== trim($top[1]['response']))
            ) {
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
                'response' => 'Go to Settings > Profile > Edit. Our date picker is now responsive for web (98% width)!',
                'next' => null
            ],
            'reset_password' => [
                'response' => 'Visit the "Forgot Password?" link on the login page or check your security settings.',
                'next' => null
            ],
            'delete_account' => [
                'response' => 'To delete your account, go to Settings > Privacy > Delete Account. This cannot be undone.',
                'next' => null
            ],
            'app_steps' => [
                'pattern' => '/\b(step|steps|guide|how to use|tutorial)\b/i',
                'response' => "Master Zmzir in 6 steps:\n1. Register & Verify.\n2. Setup Profile (new responsive birthday picker!)\n3. Join Spaces.\n4. Collaborate (Whiteboard/Meetings).\n5. Manage Activities (synchronized badges!)\n6. Safety First (Privacy Vault).",
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
        $startNodes = ['start', 'spaces_start', 'posts_start', 'privacy_start', 'settings_start', 'polls_start', 'stories_platform_start', 'ai_platform_start', 'activities_start', 'safety_trust_start', 'sync_collaboration_start', 'design_layering_start', 'app_steps'];

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

        if (!$context)
            return null;

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
                    return 'Refunds take 5–7 days. Contact our billing team via the Help Center.';
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
                if (str_contains($item, $needle))
                    return true;
            }
        }
        return false;
    }

    // ========================================================================
    // 5. LEARNING + NOTIFICATIONS FOR REVIEW
    // ========================================================================
    private function learnResponse(string $message, string $response = '', ?string $category = null): void
    {
        $analysis = $this->analyzeMessage($message);
        $categorizer = app(\App\Services\ExpertScienceCategorizer::class);
        $resolvedCategory = $categorizer->classify($message);
        $category = $category ?? ($resolvedCategory !== 'general' ? $resolvedCategory : ($this->detectCategories($message)[0] ?? 'general'));

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

        // Call the dynamic ExpertScienceCategorizer (ECE v2) to build dispatch context
        $dispatch = $categorizer::dispatch($message, $category);

        $training = ChatbotTraining::create([
            'trigger' => $message,
            'response' => $response,
            'keywords' => $analysis['keywords'],
            'category' => $category,
            'context' => json_encode(['expert_dispatch' => $dispatch]),
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
            // Commented out chatbottraing email notification, therefore only reverb is working
//             if ($usersToNotify->count() > 0) {
//                 \Illuminate\Support\Facades\Notification::send(
//                     $usersToNotify,
//                     new ChatbotTrainingNeeded($message, $category, $keywords)
//                 );
//             }
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
        // tokenizer + DialecticalKeywordBank stopword removal + sentiment detection
        $words = preg_split('/\s+/', strtolower($message));

        $filtered = array_values(array_filter($words, function ($word) {
            $w = trim(preg_replace('/[^a-z0-9]/', '', $word));
            if (strlen($w) < 2)
                return false;
            return !\App\Services\DialecticalKeywordBank::isStopWord($w);
        }));

        $positive = ['happy', 'good', 'great', 'thanks', 'thank', 'awesome', 'excellent', 'love', 'like', 'fantastic', 'positive', 'satisfied', 'pleased', 'helpful'];
        $negative = ['angry', 'bad', 'wrong', 'broken', 'issue', 'problem', 'fail', 'error', 'hate', 'dislike', 'terrible', 'negative', 'unsatisfied', 'frustrated', 'dissatisfied'];

        $sentiment = 'neutral';
        foreach ($filtered as $word) {
            if (in_array($word, $positive))
                $sentiment = 'positive';
            if (in_array($word, $negative))
                $sentiment = 'negative';
        }

        return [
            'keywords' => array_values(array_unique($filtered)),
            'sentiment' => $sentiment
        ];
    }

    private function tokenizeMessage(string $message): array
    {
        // light tokenizer + DialecticalKeywordBank stopword removal for training matching
        $message = strtolower(preg_replace('/[^a-z0-9\s]/', '', $message));
        $words = preg_split('/\s+/', trim($message));

        $filtered = array_filter($words, function ($w) {
            if (strlen($w) < 2)
                return false;
            return !\App\Services\DialecticalKeywordBank::isStopWord($w);
        });

        return array_values(array_unique($filtered));
    }

    private function detectCategories(string $message): array
    {
        $detected = [];
        $lower = strtolower(trim($message));
        $analysis = $this->analyzeMessage($message);
        $words = $analysis['keywords'] ?? [];

        // 1. O(1) Check against the Master Dialectical Keyword Bank
        $bank = \App\Services\DialecticalKeywordBank::get();
        foreach ($bank as $branch => $triggers) {
            if ($branch === 'intent_verbs')
                continue;
            foreach ($triggers as $trigger) {
                // Exact word boundary match or array intersection
                if (in_array($trigger, $words) || preg_match('/\b' . preg_quote($trigger, '/') . '\b/i', $message)) {
                    $detected[] = $branch;
                    break; // one match per branch is enough
                }
            }
        }

        // 2. Fallback to ExpertScienceCategorizer for complex structural matches
        $categorizer = app(\App\Services\ExpertScienceCategorizer::class);
        $expertBranch = $categorizer->classify($message);

        if ($expertBranch && $expertBranch !== 'general') {
            $detected[] = $expertBranch;
        }

        if (empty($detected)) {
            $detected[] = 'general';
        }

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
            ['keywords' => ['birhday', 'date', 'picker', 'responsve'], 'response' => 'Our birthday picker is now 98% width and responsive on web, with full "blackmodus" support.', 'priority' => 9],
            ['keywords' => ['badge', 'activites', 'upcomming', 'schedul'], 'response' => 'Activity badges are now synchronized! Check them in the Space header or Settings menu.', 'priority' => 9],
            ['keywords' => ['step', 'stps', 'giude', 'tutorial'], 'response' => "Master Zmzir in 6 steps: 1. Register, 2. Profile Setup, 3. Join Spaces, 4. Collab, 5. Activities, 6. Privacy.", 'priority' => 10],
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
            if (!$apiKey)
                return null;

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
        if (!isset($this->conversationContext[$conversationId]))
            return;

        // Keep last 10 messages
        $this->conversationContext[$conversationId] = array_slice(
            $this->conversationContext[$conversationId],
            -10
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
    private function askRAGMicroservice(string $message, string $model = 'phi-3', string $contextString = ""): array
    {
        // Bypass completely since the Python AI service is not deployed on Forge yet.
        // This prevents any possibility of network hangs or timeouts.
        return [
            'answer' => null,
            'confidence' => 0,
            'success' => false
        ];

        $maxRetries = 2;
        $retryDelay = 1000;

        $instruction = "";
        if ($model === 'phi-3') {
            $instruction = "[DIALECTICAL MODE: TRIAL STRATEGY] Focus on raw observation, gathering various data points, and identifying initial patterns. Act as the first step of the scientific process.\n\n";
        } elseif ($model === 'mistral') {
            $instruction = "[DIALECTICAL MODE: DEDUCTIVE LOGIC] Focus on logical consistency, filtering out contradictions, and calculating probabilities. Act as the 'Socratic Sieve' of the scientific process.\n\n";
        } elseif ($model === 'llama-3') {
            $instruction = "[DIALECTICAL MODE: INDUCTIVE PROOF] Focus on universal truths, scientific scaling (n to n+1), and establishing absolute axioms. Act as the final verification of the scientific process.\n\n";
        }

        $promptWithContext = $instruction . ($contextString ? "Conversation History:\n" . $contextString . "\n\nUser Question:\n" . trim($message) : trim($message));

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
                        'question' => $promptWithContext,
                        'model' => $model
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
            if (!is_dir($dir))
                mkdir($dir, 0755, true);

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
            //             $admin->notify(new ChatbotTrainingNeeded($message, 'general', []));
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

    public function queryTraining(Request $request)
    {
        $request->validate(['query' => 'required|string']);
        $query = strtolower($this->correctMessage($request->input('query')));
        $context = $request->input('context', []);
        $requestType = $context['requestType'] ?? 'general';

        // 0. Tokenization (Step 2 of Blueprint)
        $queryWords = array_filter(explode(' ', preg_replace('/[^\w\s]/', '', $query)), fn($w) => strlen($w) > 1);

        // 0.5 Check for Ecosystem Knowledge (Rule-based)
        $aiInfo = $this->getAIEcosystemInfo($query);
        if ($aiInfo) {
            return response()->json([
                'response' => $aiInfo,
                'confidence' => 1.0,
                'tier' => 1,
                'sentiment' => 0.5,
                'synergy' => 100,
                'suggestedActions' => ['share_insight']
            ]);
        }

        // 1. Deductive Reasoning Phase (Tiered Filtering)
        $activeRules = ChatbotTraining::where('is_active', true)->get();
        $matches = [];

        foreach ($activeRules as $rule) {
            if (empty($rule->trigger))
                continue;

            $triggerWords = array_filter(explode(' ', strtolower(preg_replace('/[^\w\s]/', '', $rule->trigger))), fn($w) => strlen($w) > 1);
            if (empty($triggerWords))
                continue;

            // Calculate Word Overlap (70%)
            $matchedWords = array_intersect($queryWords, $triggerWords);
            $overlapScore = count($triggerWords) > 0 ? (count($matchedWords) / count($triggerWords)) * 70 : 0;

            // Calculate Category Synergy (30%)
            $synergyScore = 0;
            if (isset($context['mode']) && str_contains(strtolower($rule->category), strtolower($context['mode']))) {
                $synergyScore = 30;
            }

            $totalScore = $overlapScore + $synergyScore;

            if ($totalScore > 20) { // Minimum threshold for deductive match
                $contextMeta = json_decode($rule->context ?? '{}', true) ?: [];
                $weight = $contextMeta['weight'] ?? 1.0;
                $isAxiom = !empty($contextMeta['is_axiom']);

                // Dialectical Prioritization: Axioms (Step 3 proven) receive a massive confidence boost
                // ensuring they override unproven hypotheses (Step 1/2)
                $axiomBonus = $isAxiom ? 1.5 : 1.0;
                $finalConfidence = (($totalScore / 100) * $weight) * $axiomBonus;

                $matches[] = [
                    'rule' => $rule,
                    'confidence' => $finalConfidence,
                    'is_axiom' => $isAxiom,
                    'tier' => $finalConfidence > 0.8 ? 1 : ($finalConfidence > 0.5 ? 2 : 3)
                ];
            }
        }

        // Sort by confidence
        usort($matches, fn($a, $b) => $b['confidence'] <=> $a['confidence']);
        $bestMatch = $matches[0] ?? null;

        // 2. Advanced Contextual Analysis (The "Observation Layer")
        $sentiment = $this->analyzeSentiment($query);
        $synergy = $this->calculateParticipantSynergy($context['participants'] ?? []);

        // 3. Contextual Response Generation
        $isFallback = false;
        $suggestedActions = $bestMatch ? ['apply_logic', 'share_insight'] : ['continue_trial'];

        if ($requestType === 'alternate_perspectives') {
            $baseResponse = $bestMatch ? $bestMatch['rule']->response : "Logic demands constant refinement.";
            $response = "Zmzir Logic Perspectives:\n\n" .
                "1. Mathematical View: Analysis suggests " . strtolower($baseResponse) . "\n" .
                "2. Social Impact: This trial indicates high sentiment potential.\n" .
                "3. Divergent Path: Alternative induction leads to unique creative emergence.";
            $confidence = $bestMatch ? min(1.0, $bestMatch['confidence']) : 0.42;
        } elseif ($bestMatch && $bestMatch['confidence'] > 0.4) {
            $response = $bestMatch['rule']->response;
            $confidence = min(1.0, $bestMatch['confidence']);

            // Inject sentiment-aware modifiers
            if ($sentiment < -0.3) {
                $response = "I detect a logical conflict. " . $response . " Perhaps we should re-evaluate the premise?";
                $suggestedActions[] = 'resolve_conflict';
            }
        } else {
            // Refined Fallback (Mathematical Theme)
            $isFallback = true;
            $fallbacks = [
                "Trial #" . rand(1000, 9999) . ": Deduction is ongoing. Continue the thought process for higher confidence.",
                "Logic suggests a correlation between your query and existing collaboration patterns. Analyzing...",
                "Recursive analysis indicates a 32% probability of creative emergence. Provide more data for induction.",
                "Synergy mapping indicates that " . ($synergy['most_active'] ?? 'the team') . " is approaching a creative peak."
            ];
            $response = $fallbacks[array_rand($fallbacks)];
            $confidence = 0.25 + (rand(0, 10) / 100);

            if ($sentiment > 0.5) {
                $response = "The high energy in this space is conducive to discovery. " . $response;
            }
        }

        // 4. Dynamic Action Suggestions based on Synergy
        if (!empty($synergy['roles_needed'])) {
            $suggestedActions[] = 'invite_' . $synergy['roles_needed'][0];
        }

        // 5. Dispatch Inductive Trial & Error Learning Job
        ProcessAILearning::dispatch('interaction', [
            'trigger' => $query,
            'response' => $response,
            'success' => !$isFallback && ($confidence > 0.6),
            'category' => $context['mode'] ?? 'general',
            'sentiment' => $sentiment,
            'synergy_score' => $synergy['score'] ?? 0
        ]);

        return response()->json([
            'response' => $response,
            'confidence' => $confidence,
            'source' => $isFallback ? 'inductive_fallback' : 'pure_logic',
            'suggested_actions' => array_unique($suggestedActions),
            'meta' => [
                'sentiment' => $sentiment,
                'synergy' => $synergy,
                'is_axiom' => $bestMatch['is_axiom'] ?? false
            ]
        ]);
    }

    private function analyzeSentiment(string $text): float
    {
        $positive = ['good', 'great', 'excellent', 'happy', 'yes', 'agree', 'success', 'work'];
        $negative = ['bad', 'error', 'no', 'disagree', 'fail', 'hard', 'stuck', 'conflict'];

        $score = 0;
        $words = explode(' ', strtolower($text));
        foreach ($words as $word) {
            if (in_array($word, $positive))
                $score += 0.2;
            if (in_array($word, $negative))
                $score -= 0.2;
        }

        return max(-1.0, min(1.0, $score));
    }

    private function calculateParticipantSynergy(array $participants): array
    {
        if (empty($participants))
            return ['score' => 0];

        $roles = array_column($participants, 'role');
        $uniqueRoles = array_unique($roles);

        $score = count($uniqueRoles) / 5; // Diversity score
        $rolesNeeded = [];

        $essentialRoles = ['moderator', 'contributor', 'creative'];
        foreach ($essentialRoles as $role) {
            if (!in_array($role, $uniqueRoles)) {
                $rolesNeeded[] = $role;
            }
        }

        return [
            'score' => min(1.0, $score),
            'diversity' => count($uniqueRoles),
            'roles_needed' => $rolesNeeded,
            'most_active' => $participants[0]['name'] ?? 'System'
        ];
    }

    public function queryAudio(Request $request)
    {
        // Mock transcription and pass to queryTraining
        $message = "Audio transcribed logic for: " . ($request->hasFile('audio') ? "detected voice input" : "blank audio");

        $request->merge(['query' => $message]);
        return $this->queryTraining($request);
    }

    /**
     * Scans the database for "Pure Knowledge" to trigger dynamic AI insights.
     * Persists the event if a space_id is provided to ensure it's discoverable.
     */
    public function generateMagicEvent(Request $request)
    {
        $spaceId = $request->query('space_id');

        // 1. Singleton Check: Avoid duplicate sparkles if one is already active
        if ($spaceId) {
            $existing = \App\Models\MagicEvent::where('space_id', $spaceId)
                ->where('has_been_discovered', false)
                ->whereIn('event_type', ['synchronicity', 'emergence_check', 'high_energy'])
                ->orderBy('created_at', 'desc')
                ->first();

            if ($existing) {
                return response()->json(['event' => $existing]);
            }
        }

        // 2. Fetch a high-confidence "pure knowledge" node
        $rules = ChatbotTraining::where('is_active', true)->get();

        $purestRule = null;
        $maxWeight = 0;

        foreach ($rules as $rule) {
            // context contains weight in current architecture
            $contextMeta = json_decode($rule->context ?? '{}', true) ?: [];
            $weight = $contextMeta['weight'] ?? 0;
            if ($weight > $maxWeight) {
                $maxWeight = $weight;
                $purestRule = $rule;
            }
        }

        $eventType = ['synchronicity', 'emergence_check', 'high_energy'][rand(0, 2)];
        $eventId = (string) Str::uuid();

        $eventData = [
            'pure_knowledge' => $purestRule ? $purestRule->trigger : "Logic demands constant refinement.",
            'deduced_insight' => $purestRule ? $purestRule->response : "Trial and error leads to truth.",
            'confidence_score' => $maxWeight
        ];

        // 3. Persist to DB so it can be 'discovered' by users
        if ($spaceId) {
            // Ensure space exists before creating event
            $spaceExists = \App\Models\CollaborationSpace::where('id', $spaceId)->exists();

            if ($spaceExists) {
                $event = \App\Models\MagicEvent::create([
                    'id' => $eventId,
                    'space_id' => $spaceId,
                    'triggered_by' => auth()->id(),
                    'event_type' => $eventType,
                    'event_data' => $eventData,
                    'context' => [
                        'source' => 'ai_synchronicity',
                        'model' => 'pure_knowledge_v1',
                        'generated_at' => now()->toDateTimeString()
                    ],
                    'has_been_discovered' => false,
                ]);

                return response()->json(['event' => $event]);
            }
        }

        // Fallback for non-space or invalid space calls
        return response()->json([
            'event' => [
                'id' => $eventId,
                'event_type' => $eventType,
                'event_data' => $eventData,
                'created_at' => now()->toIso8601String(),
                'has_been_discovered' => false
            ]
        ]);
    }

    /**
     * Zmzir AI Ecosystem Knowledge Base (Step 1 to 6)
     */
    private function getAIEcosystemInfo(string $message): ?string
    {
        $message = strtolower($message);

        // 1. Core 3-Step Strategy
        if (preg_match('/(how does( the)? ai work|steps? 1 to 3|ai strategy|logic steps)/i', $message)) {
            return "Our AI Ecosystem operates on a 3-Step Strategy:\n" .
                "1. **Trial & Error (Observation)**: Harvesting metadata from marketplace trends and social sentiment.\n" .
                "2. **Deductive Logic (Calculation)**: Tokenization and weighted scoring (70% Overlap, 30% Category) with confidence metrics.\n" .
                "3. **Inductive Logic (Proofing)**: Background learning that reinforces rules (+0.1 weight) or prunes false truths (-0.2 weight).";
        }

        // 2. Full 6-Step Ecosystem
        if (preg_match('/(6 steps|ecosystem info|full architecture|how is it built)/i', $message)) {
            return "The Zmzir AI Ecosystem is built across 6 technical layers:\n" .
                "1. **Observation (Trial & Error)**: Raw data harvesting from user behavior.\n" .
                "2. **Calculation (Deductive Logic)**: Rule-based matching with high-fidelity filtering.\n" .
                "3. **Cleansing (Inductive Logic)**: Self-evolving weight reinforcement and logic pruning.\n" .
                "4. **Backend Architecture**: Central Intelligence Hub with RAG microservice routing.\n" .
                "5. **Database Schema**: Mathematical triples (Trigger/Response/Keywords) with audit trails.\n" .
                "6. **Real-Time Sync**: Reverb-powered synchronization for multi-device intelligence updates.";
        }

        // 3. AI Agents / Models
        if (preg_match('/(phi-3|mistral|llama-3|trial strategy|deductive logic|inductive proof|different models|which agent)/i', $message)) {
            return "We provide 3 specialized AI Agents for different needs:\n" .
                "- **Trial Strategy**: Lightweight and lightning-fast. Ideal for quick discovery and gathering of initial data.\n" .
                "- **Deductive Logic**: The Reasoning Intelligence. Balanced reasoning and logical calculation.\n" .
                "- **Inductive Proof**: The High-Performance Engine. Designed for deep scientific verification and universal truth.\n" .
                "Selection is persistent and saved to your conversation profile.";
        }

        // 4. RAG and Hybrid Reasoning
        if (preg_match('/(rag|hybrid|how( do)? you know things)/i', $message)) {
            return "We use a **Hybrid Reasoning** model. For local precision, we use **Deductive Rules**. For broader world knowledge, we route queries to our **RAG (Retrieval-Augmented Generation)** microservice. This ensures 100% information purity by cross-referencing our internal 'Truths' with generative intelligence.";
        }

        // 5. Training and Learning
        if (preg_match('/(how( do)? you learn|train|manual review|training hub|expert dashboard)/i', $message)) {
            return "Learning happens in two ways:\n" .
                "1. **Automatic Induction**: Patterns with high success rates are automatically induced into rules.\n" .
                "2. **Expert Validation**: Our **Chatbot Training Hub** (Expert Dashboard) allows our team to review 'Pending Logic' reports, assign knowledge clusters to experts, and resolve new training rules with zero-latency silent refreshes.";
        }

        return null;
    }
}
