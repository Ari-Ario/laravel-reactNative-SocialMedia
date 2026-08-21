<?php

namespace App\Jobs;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Cache;
use App\Models\ChatbotTraining;
use App\Models\Post;
use App\Models\MarketItem;

class ProcessAILearning implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public $timeout = 120;
    protected $learningData;
    protected $type;

    /**
     * Create a new job instance.
     * $type can be 'interaction', 'market', 'post_engagement'
     */
    public function __construct(string $type, array $learningData = [])
    {
        $this->type = $type;
        $this->learningData = $learningData;
    }

    /**
     * Execute the job.
     * Step 1: Trial & Error (Observation)
     * Step 2: Deductive Logic (Matching)
     * Step 3: Inductive Logic (Proofing & Cleansing)
     */
    public function handle(): void
    {
        try {
            Log::info("🤖 AI Learning Cycle Started: {$this->type}");

            // 1. Observation (Trial & Error Setup)
            $observations = $this->gatherObservations();

            if (empty($observations)) {
                return; // Nothing to learn right now
            }

            // 2. Deductive Reasoning
            $deductiveResults = $this->applyDeductiveLogic($observations);

            // 3. Inductive Proofing
            $this->applyInductiveProofing($deductiveResults);

            // Clear AI cache after learning to reflect changes instantly
            Cache::forget('all_chatbot_trainings');

            Log::info("🧠 AI Learning Cycle Completed: {$this->type}");
        } catch (\Exception $e) {
            Log::error("❌ AI Learning Error: " . $e->getMessage());
        }
    }

    private function gatherObservations(): array
    {
        $observations = [];

        if ($this->type === 'interaction') {
            if (!empty($this->learningData)) {
                $observations[] = $this->learningData;
            }
        } elseif ($this->type === 'market') {
            MarketItem::where('status', 'active')->chunk(1000, function ($items) use (&$observations) {
                foreach ($items as $item) {
                    $observations[] = [
                        'context'  => 'market',
                        'data'     => $item->title . ' ' . $item->description,
                        'category' => $item->category ?? 'market',
                        'success'  => $item->views_count > 20,
                    ];
                }
            });
        } elseif ($this->type === 'post_engagement') {
            Post::orderBy('created_at', 'desc')->limit(1000)->get()->each(function ($post) use (&$observations) {
                $observations[] = [
                    'context'  => 'post',
                    'data'     => $post->content,
                    'category' => 'general',
                    'success'  => $post->reactions()->count() > 3,
                ];
            });

        // ── PHASE 3 FIX: 'feedback' type from user agree/contradict votes ────────────
        // Previously this type was dispatched but never handled → zero learning occurred.
        // Now it maps directly into the dialectical observation pipeline.
        } elseif ($this->type === 'feedback') {
            $data = $this->learningData;
            if (!empty($data['trigger'])) {
                $observations[] = [
                    'context'           => 'feedback',
                    'trigger'           => $data['trigger'],
                    'response'          => $data['response'] ?? '',
                    'data'              => $data['trigger'],
                    'category'          => $data['category'] ?? 'general',
                    'branch'            => $data['branch'] ?? null,
                    'domain_partition'  => $data['domain_partition'] ?? null,
                    'training_ticket_id'=> $data['training_ticket_id'] ?? null,
                    'axiom_id'          => $data['axiom_id'] ?? null,
                    // 'save' = agree (positive reinforcement), 'discard' = contradict (negative)
                    'success'           => ($data['type'] ?? 'discard') === 'save',
                ];
            }
        }

        return $observations;
    }

    private function applyDeductiveLogic(array $observations): array
    {
        $results = [];
        $activeRules = ChatbotTraining::where('is_active', true)->get();
        // The Socratic Sieve: Absolute Negation Words (Anti-thesis triggers)
        $toxicContradictions = ['stupid', 'idiot', 'fake', 'scam', 'hate', 'kill', 'false_info'];

        foreach ($observations as $obs) {
            $matchedRule = null;
            $dataString = strtolower($obs['data'] ?? $obs['trigger'] ?? '');
            if (empty($dataString)) continue;
            
            // 1. Socratic Contradiction Check (Absolute Negation)
            $isToxic = false;
            foreach ($toxicContradictions as $toxic) {
                if (str_contains($dataString, $toxic)) {
                    $isToxic = true;
                    Log::warning("🛡️ Socratic Sieve: Purged toxic/false trial containing '{$toxic}'.");
                    break;
                }
            }
            if ($isToxic) {
                continue; // Purged from existence, does not proceed to induction
            }
            
            // 2. Deduce meaning by checking against known rules
            foreach ($activeRules as $rule) {
                if (!empty($rule->trigger) && str_contains($dataString, strtolower($rule->trigger))) {
                    $matchedRule = $rule;
                    break;
                }
            }

            $results[] = [
                'observation' => $obs,
                'matched_rule' => $matchedRule,
                'is_successful_trial' => $obs['success'] ?? false,
            ];
        }

        return $results;
    }

    private function applyInductiveProofing(array $deductiveResults): void
    {
        $unmatchedSuccesses = [];

        foreach ($deductiveResults as $result) {
            $rule    = $result['matched_rule'];
            $success = $result['is_successful_trial'];
            $obs     = $result['observation'];

            if ($rule) {
                // Extract or default weight from context (JSON string format fallback)
                $contextMeta  = json_decode($rule->context ?? '{}', true) ?: [];
                $currentScore = $contextMeta['weight'] ?? 1.0;

                if ($success) {
                    $currentScore = min(5.0, $currentScore + 0.1);
                    if ($currentScore >= 4.5 && empty($contextMeta['is_axiom'])) {
                        $contextMeta['is_axiom'] = true;
                        Log::info("🌟 AI PROMOTED GLOBAL AXIOM: Rule '{$rule->trigger}' reached infinite scaling weight.");
                    }

                    // ── Positive reinforcement: cache the agreed response for fast recall ──
                    // When a user agrees (thumbs-up) with a response, cache it so the next
                    // identical trigger bypasses the full solver pipeline entirely.
                    if (($obs['context'] ?? '') === 'feedback' && !empty($obs['response'])) {
                        $learnedResponses = Cache::get('learned_responses', []);
                        $cacheKey = strtolower(trim($obs['trigger'] ?? $rule->trigger));
                        if (!isset($learnedResponses[$cacheKey]) || $currentScore > 2.0) {
                            $learnedResponses[$cacheKey] = $obs['response'];
                            Cache::put('learned_responses', $learnedResponses, now()->addDays(7));
                            Log::info("💾 Learned-response cache reinforced for: '{$cacheKey}'");
                        }
                    }
                } else {
                    $currentScore = max(0.0, $currentScore - 0.2);
                    $contextMeta['is_axiom'] = false;

                    // ── Contradiction escalation: weight < 0.3 → Expert Review ticket ──
                    // When a user contradicts a response enough times, auto-create a
                    // chatbot_training ticket so an expert can inspect and correct it.
                    if (($obs['context'] ?? '') === 'feedback' && $currentScore < 0.3) {
                        $trigger = $obs['trigger'] ?? $rule->trigger;
                        $alreadyQueued = ChatbotTraining::where('trigger', 'like', '%' . mb_substr($trigger, 0, 80) . '%')
                            ->where('needs_review', true)
                            ->exists();

                        if (!$alreadyQueued) {
                            ChatbotTraining::create([
                                'trigger'      => mb_substr($trigger, 0, 500),
                                'response'     => $obs['response'] ?? '',
                                'category'     => $obs['category'] ?? $rule->category ?? 'general',
                                'branch'       => $obs['branch'] ?? $rule->branch ?? null,
                                'needs_review' => true,
                                'is_active'    => false,
                                'context'      => json_encode([
                                    'weight'             => $currentScore,
                                    'auto_contradiction' => true,
                                    'source_rule_id'     => $rule->id,
                                ]),
                            ]);
                            Log::info("🚨 Contradiction ticket auto-created for rule #{$rule->id}: '{$trigger}'");
                        }
                    }
                }

                if ($currentScore <= 0.1) {
                    $rule->is_active = false;
                    Log::info("🗑️ AI Erased False Information: Rule '{$rule->trigger}' deactivated (failed trials).");
                } else {
                    $contextMeta['weight'] = $currentScore;
                    $rule->context = json_encode($contextMeta);
                }

                $rule->save();
            } else {
                // If no rule matched but trial was successful, gather for synthesis
                if ($success) {
                    $category = $obs['category'] ?? 'general';

                    if (isset($obs['trigger'])) {
                        $triggerStr = strtolower(trim($obs['trigger']));
                        if (strlen($triggerStr) > 5) {
                            $this->synthesizeNewRule(
                                $triggerStr,
                                $obs['response'] ?? 'Acknowledged valid pattern.',
                                $category
                            );
                        }
                    } else {
                        $unmatchedSuccesses[] = $obs;
                    }
                }
            }
        }

        // Inductive Scaling Synthesis for Market/Posts
        if (count($unmatchedSuccesses) > 10) {
            Log::info("✨ AI Inductive Scaling: Analyzing " . count($unmatchedSuccesses) . " successful unmapped trials.");
            $this->synthesizeNewRule(
                "High performance pattern detected in " . $unmatchedSuccesses[0]['context'],
                "The system inductively verified a repeated success pattern across multiple trials.",
                "system_induction"
            );
        }
    }
    
    private function synthesizeNewRule(string $trigger, string $response, string $category): void
    {
        ChatbotTraining::create([
            'trigger'      => $trigger,
            'response'     => $response,
            'category'     => $category,
            'is_active'    => true,
            'context'      => json_encode(['weight' => 1.0, 'induced' => true, 'is_axiom' => false]),
            'keywords'     => explode(' ', $trigger),
            'needs_review' => true, // Awaiting Pancracy (Expert) review
        ]);
        Log::info("✨ AI Synthesized New Thesis from Trial: '{$trigger}' (Awaiting Pancracy Verification)");
    }
}
