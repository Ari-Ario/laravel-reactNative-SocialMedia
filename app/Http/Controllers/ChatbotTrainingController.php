<?php

// app/Http/Controllers/ChatbotTrainingController.php
namespace App\Http\Controllers;

use App\Events\AxiomPromoted;
use App\Models\ChatbotTraining;
use App\Models\ExpertDomain;
use App\Models\KnowledgeAxiom;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class ChatbotTrainingController extends Controller
{
    // ─── All 25 science categories aligned to the 6 dialectical phases ───────
    private const SCIENCE_CATEGORIES = [
        // Phase 1: Ontological Roots
        'ontology'            => ['phase' => 1, 'label' => 'Ontology / Root'],
        'epistemology'        => ['phase' => 1, 'label' => 'Epistemology'],
        'metaphysics'         => ['phase' => 1, 'label' => 'Metaphysics'],
        // Phase 2: Logic & Dialectics
        'formal_logic'        => ['phase' => 2, 'label' => 'Formal Logic'],
        'set_theory'          => ['phase' => 2, 'label' => 'Set Theory'],
        'modal_logic'         => ['phase' => 2, 'label' => 'Modal Logic'],
        'dialectics'          => ['phase' => 2, 'label' => 'Dialectics'],
        'proof_theory'        => ['phase' => 2, 'label' => 'Proof Theory'],
        // Phase 3: Mathematics
        'arithmetic'          => ['phase' => 3, 'label' => 'Arithmetic'],
        'algebra'             => ['phase' => 3, 'label' => 'Algebra'],
        'calculus'            => ['phase' => 3, 'label' => 'Calculus'],
        'number_theory'       => ['phase' => 3, 'label' => 'Number Theory'],
        'topology'            => ['phase' => 3, 'label' => 'Topology'],
        'game_theory'         => ['phase' => 3, 'label' => 'Game Theory'],
        // Phase 4: Physical Sciences
        'classical_mechanics' => ['phase' => 4, 'label' => 'Classical Mechanics'],
        'quantum_mechanics'   => ['phase' => 4, 'label' => 'Quantum Mechanics'],
        'relativity'          => ['phase' => 4, 'label' => 'Relativity'],
        'thermodynamics'      => ['phase' => 4, 'label' => 'Thermodynamics'],
        'chemistry'           => ['phase' => 4, 'label' => 'Chemistry'],
        // Phase 5: Life & Earth Sciences
        'genetics'            => ['phase' => 5, 'label' => 'Genetics'],
        'evolutionary_biology'=> ['phase' => 5, 'label' => 'Evolutionary Biology'],
        'neuroscience'        => ['phase' => 5, 'label' => 'Neuroscience'],
        'ecology'             => ['phase' => 5, 'label' => 'Ecology'],
        // Phase 6: Applied Sciences
        'computer_science'    => ['phase' => 6, 'label' => 'Computer Science'],
        'economics'           => ['phase' => 6, 'label' => 'Economics'],
        'sociology'           => ['phase' => 6, 'label' => 'Sociology'],
        'law'                 => ['phase' => 6, 'label' => 'Law & Ethics'],
        // Special
        'general'             => ['phase' => 0, 'label' => 'General'],
        'support'             => ['phase' => 0, 'label' => 'App Support'],
        'technical'           => ['phase' => 0, 'label' => 'Technical'],
        'moderation'          => ['phase' => 0, 'label' => 'Moderation'],
    ];

    // ──────────────────────────────────────────────────────────────────────────

    public function index(Request $request)
    {
        $userId   = auth()->id();
        $category = $request->category;

        $rules = ChatbotTraining::query()
            ->with(['trainer', 'assignedTo', 'reviewedBy'])
            ->when($category && $category !== 'all', function ($q) use ($category, $userId) {
                if ($category === 'pending') {
                    $q->where('needs_review', true);
                } elseif ($category === 'my_tickets') {
                    // Filter by expert's registered branches OR direct assignment
                    $isSuperAdmin = ExpertDomain::userIsSuperAdmin($userId)
                        || ExpertDomain::where('user_id', $userId)->where('branch', '*')->exists();

                    if ($isSuperAdmin) {
                        // Superadmin sees all pending
                        $q->where(function ($sub) use ($userId) {
                            $sub->where('assigned_to', $userId)
                                ->orWhere('needs_review', true);
                        });
                    } else {
                        $myBranches = ExpertDomain::branchesForUser($userId);
                        $q->where(function ($sub) use ($userId, $myBranches) {
                            $sub->where('assigned_to', $userId);
                            if ($myBranches->isNotEmpty()) {
                                $sub->orWhereIn('branch', $myBranches);
                            }
                        });
                    }
                } elseif ($category === 'promoted') {
                    $q->whereNotNull('knowledge_axiom_id');
                } else {
                    $q->where('category', $category);
                }
            })
            ->when($request->search, function ($q, $s) {
                $q->where(function ($sub) use ($s) {
                    $sub->where('trigger', 'like', "%$s%")
                        ->orWhere('response', 'like', "%$s%")
                        ->orWhere('keywords', 'like', "%$s%")
                        ->orWhere('branch', 'like', "%$s%")
                        ->orWhere('category', 'like', "%$s%");
                });
            })
            ->when($request->status && $request->status !== 'all', function ($q, $status) {
                match ($status) {
                    'active'   => $q->where('is_active', true),
                    'inactive' => $q->where('is_active', false),
                    'pending'  => $q->where('needs_review', true),
                    'promoted' => $q->whereNotNull('knowledge_axiom_id'),
                    default    => null,
                };
            })
            ->orderBy('needs_review', 'desc')
            ->orderBy('created_at', 'desc')
            ->get();

        return response()->json($rules);
    }

    // ──────────────────────────────────────────────────────────────────────────

    /**
     * Expert check + expert list.
     */
    public function experts()
    {
        $userId = auth()->id();
        $user   = auth()->user();

        $isExpert = ExpertDomain::where('user_id', $userId)->exists()
            || ($user && in_array($user->role ?? '', ['ai_admin', 'admin', 'expert']));

        $experts = User::whereHas('expertDomains')
            ->orWhere('role', 'ai_admin')
            ->limit(20)
            ->get(['id', 'name', 'profile_photo'])
            ->map(function ($u) {
                $domains = ExpertDomain::where('user_id', $u->id)->get(['branch', 'phase']);
                return array_merge($u->toArray(), [
                    'domains'        => $domains,
                    'assigned_count' => ChatbotTraining::where('assigned_to', $u->id)->count(),
                    'review_count'   => ChatbotTraining::where('reviewed_by', $u->id)->count(),
                ]);
            });

        return response()->json([
            'is_expert' => $isExpert,
            'experts'   => $experts,
        ]);
    }

    // ──────────────────────────────────────────────────────────────────────────

    /**
     * Return the expert's registered branches (for "My Inbox" frontend filtering).
     */
    public function myDomains()
    {
        $userId = auth()->id();
        $isSuperAdmin = ExpertDomain::userIsSuperAdmin($userId)
            || ExpertDomain::where('user_id', $userId)->where('branch', '*')->exists();

        $domains = ExpertDomain::where('user_id', $userId)->get(['branch', 'domain_partition', 'phase']);

        return response()->json([
            'is_superadmin' => $isSuperAdmin,
            'domains'       => $domains,
            'branches'      => $domains->pluck('branch'),
        ]);
    }

    // ──────────────────────────────────────────────────────────────────────────

    public function assign(Request $request, $id)
    {
        $training = ChatbotTraining::findOrFail($id);
        $training->update([
            'assigned_to' => auth()->id(),
            'updated_at'  => now(),
        ]);

        return response()->json(['success' => true, 'data' => $training->fresh(['trainer', 'assignedTo'])]);
    }

    // ──────────────────────────────────────────────────────────────────────────

    /**
     * Review (approve/reject) a training ticket.
     * When promote_to_knowledge_axiom=true AND approved=true, the ticket is
     * immediately inserted into knowledge_axioms with a fully resolved pedigree.
     */
    public function review(Request $request, $id)
    {
        $validated = $request->validate([
            'approved'                   => 'required|boolean',
            'trigger'                    => 'sometimes|string|max:500',
            'response'                   => 'sometimes|string',
            'category'                   => 'nullable|string|max:100',
            'branch'                     => 'nullable|string|max:100',
            'domain_partition'           => 'nullable|string|max:100',
            'parent_thesis'              => 'nullable|string',
            'formal_proof'               => 'nullable|string',
            'promote_to_knowledge_axiom' => 'nullable|boolean',
        ]);

        $training = ChatbotTraining::findOrFail($id);

        // Apply expert edits to the ticket first
        $updateFields = array_filter([
            'trigger'          => $validated['trigger']          ?? null,
            'response'         => $validated['response']         ?? null,
            'category'         => $validated['category']         ?? null,
            'branch'           => $validated['branch']           ?? null,
            'domain_partition' => $validated['domain_partition'] ?? null,
            'parent_thesis'    => $validated['parent_thesis']    ?? null,
            'formal_proof'     => $validated['formal_proof']     ?? null,
        ], fn($v) => !is_null($v));

        if (!empty($updateFields)) {
            $training->update($updateFields);
        }

        $training->update([
            'needs_review' => false,
            'is_active'    => $validated['approved'],
            'reviewed_by'  => auth()->id(),
        ]);

        $newAxiom = null;

        // ── Dialectical Promotion: training ticket → knowledge_axiom ──────────
        if ($validated['approved'] && ($validated['promote_to_knowledge_axiom'] ?? false)) {
            $branch          = $training->fresh()->branch ?? $validated['branch'] ?? 'general';
            // domain_partition has a NOT NULL constraint; fall back to branch if not provided
            $domainPartition = $training->fresh()->domain_partition
                ?? $validated['domain_partition']
                ?? $validated['branch']
                ?? $branch;
            $formalProof     = $validated['formal_proof'] ?? $training->fresh()->formal_proof ?? $training->response;
            $parentThesis    = $validated['parent_thesis'] ?? $training->fresh()->parent_thesis ?? null;

            // Resolve parent axiom by sha256 hash then LIKE fallback
            $parentId = $this->resolveParentAxiom($parentThesis);

            DB::beginTransaction();
            try {
                $thesis     = $training->fresh()->trigger;
                $signature  = hash('sha256', trim($thesis));

                // Prevent duplicate promotions
                $existing = KnowledgeAxiom::where('ast_signature', $signature)->first();
                if ($existing) {
                    DB::rollBack();
                    return response()->json([
                        'success'           => true,
                        'message'           => 'Axiom already exists in knowledge base.',
                        'knowledge_axiom_id'=> $existing->id,
                        'data'              => $training->load(['trainer', 'assignedTo', 'reviewedBy']),
                    ]);
                }

                $newAxiom = KnowledgeAxiom::create([
                    'thesis_statement'  => $thesis,
                    'formal_proof'      => $formalProof,
                    'branch'            => $branch,
                    'domain_partition'  => $domainPartition,
                    'parent_axiom_id'   => $parentId,
                    'status'            => 'global_axiom',
                    'confidence_score'  => 1.0,
                    'ast_signature'     => $signature,
                    'source_type'       => 'expert_promoted',
                    'data_type'         => 'text',
                    'inductive_logic'   => "Promoted from chatbot training ticket #{$training->id} by expert " . auth()->id(),
                ]);

                $training->update([
                    'knowledge_axiom_id' => $newAxiom->id,
                    'promoted_at'        => now(),
                ]);

                DB::commit();

                // ── Bust semantic model cache so next request uses new axiom ──
                cache()->forget('dialectical_semantic_model_meta');
                cache()->forget('learned_responses');
                $modelPath = storage_path('app/dialectical_semantic_model.bin');
                if (file_exists($modelPath)) {
                    @unlink($modelPath);
                    Log::info("Semantic model cache busted after axiom promotion #{$newAxiom->id}");
                }

                // ── Broadcast to all experts via Reverb ───────────────────────
                try {
                    broadcast(new AxiomPromoted($newAxiom))->toOthers();
                } catch (\Throwable $e) {
                    Log::warning('AxiomPromoted broadcast failed: ' . $e->getMessage());
                }

            } catch (\Throwable $e) {
                DB::rollBack();
                Log::error('Axiom promotion failed: ' . $e->getMessage());
                return response()->json([
                    'success' => false,
                    'message' => 'Axiom promotion failed: ' . $e->getMessage(),
                ], 500);
            }
        }

        cache()->forget('learned_responses');

        return response()->json([
            'success'            => true,
            'axiom_id'           => $newAxiom?->id,           // alias used by frontend toast
            'knowledge_axiom_id' => $newAxiom?->id,           // keep for backwards compat
            'promoted_at'        => $newAxiom ? now()->toISOString() : null,
            'data'               => $training->load(['trainer', 'assignedTo', 'reviewedBy']),
        ]);
    }


    // ──────────────────────────────────────────────────────────────────────────

    public function store(Request $request)
    {
        $data = $request->validate([
            'trigger'    => 'required|string|max:500',
            'response'   => 'required|string',
            'category'   => 'nullable|string|max:100',
            'subcategory'=> 'nullable|string|max:100',
            'branch'     => 'nullable|string|max:100',
            'keywords'   => 'nullable|array',
            'is_active'  => 'nullable|boolean',
        ]);

        $training = ChatbotTraining::create([
            ...$data,
            'trained_by'   => auth()->id(),
            'needs_review' => true,
            'is_active'    => $data['is_active'] ?? true,
        ]);

        return response()->json($training, 201);
    }

    // ──────────────────────────────────────────────────────────────────────────

    public function destroy($id)
    {
        $training = ChatbotTraining::findOrFail($id);
        $training->delete();

        return response()->json(['success' => true]);
    }

    // ──────────────────────────────────────────────────────────────────────────

    public function update(Request $request, $id)
    {
        $validated = $request->validate([
            'trigger'          => 'sometimes|string|max:500',
            'response'         => 'sometimes|string',
            'category'         => 'nullable|string|max:100',
            'subcategory'      => 'nullable|string|max:100',
            'branch'           => 'nullable|string|max:100',
            'domain_partition' => 'nullable|string|max:100',
            'parent_thesis'    => 'nullable|string',
            'formal_proof'     => 'nullable|string',
            'is_active'        => 'sometimes|boolean',
            'keywords'         => 'nullable|array',
        ]);

        try {
            $training = ChatbotTraining::findOrFail($id);
            $training->update($validated);
            cache()->forget('learned_responses');

            return response()->json([
                'success' => true,
                'data'    => $training->load(['trainer', 'assignedTo', 'reviewedBy']),
            ]);
        } catch (\Exception $e) {
            return response()->json(['success' => false, 'message' => 'Update failed: ' . $e->getMessage()], 500);
        }
    }

    // ──────────────────────────────────────────────────────────────────────────

    public function bulkApprove(Request $request)
    {
        $request->validate(['ids' => 'required|array']);
        ChatbotTraining::whereIn('id', $request->ids)
            ->update(['needs_review' => false, 'reviewed_by' => auth()->id()]);
        cache()->forget('learned_responses');

        return response()->json(['message' => 'Responses approved', 'count' => count($request->ids)]);
    }

    public function needsReview()
    {
        return ChatbotTraining::where('needs_review', true)->count();
    }

    public function categories()
    {
        $dbCounts = ChatbotTraining::select('category', DB::raw('count(*) as count'))
            ->whereNotNull('category')
            ->groupBy('category')
            ->pluck('count', 'category');

        $result = [];
        foreach (self::SCIENCE_CATEGORIES as $id => $meta) {
            $result[] = [
                'id'    => $id,
                'name'  => $meta['label'],
                'phase' => $meta['phase'],
                'count' => $dbCounts[$id] ?? 0,
            ];
        }

        return response()->json($result);
    }

    // ──────────────────────────────────────────────────────────────────────────

    /**
     * Resolve a parent axiom ID from the provided thesis text.
     * Strategy: sha256 exact match → LIKE match on thesis_statement.
     */
    private function resolveParentAxiom(?string $parentThesis): ?int
    {
        if (!$parentThesis || strlen(trim($parentThesis)) < 5) {
            return null;
        }

        $parentThesis = trim($parentThesis);
        $sig          = hash('sha256', $parentThesis);

        // 1. Exact signature match (O(1) — indexed)
        $axiom = KnowledgeAxiom::where('ast_signature', $sig)
            ->where('status', 'global_axiom')
            ->first();

        if ($axiom) {
            return $axiom->id;
        }

        // 2. LIKE fallback — first 60 chars to avoid MySQL LIKE overflow
        $prefix = mb_substr($parentThesis, 0, 60);
        $axiom  = KnowledgeAxiom::where('thesis_statement', 'like', '%' . $prefix . '%')
            ->where('status', 'global_axiom')
            ->orderBy('confidence_score', 'desc')
            ->first();

        return $axiom?->id;
    }
}