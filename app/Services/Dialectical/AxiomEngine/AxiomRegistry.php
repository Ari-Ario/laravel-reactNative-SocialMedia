<?php

namespace App\Services\Dialectical\AxiomEngine;

use App\Services\Dialectical\AxiomEngine\Contracts\DialecticalAxiomInterface;
use App\Models\KnowledgeAxiom;
use Illuminate\Support\Facades\Cache;

/**
 * AxiomRegistry
 * 
 * Dynamically tracks, loads, and queries mathematical axioms required for the Dialectical Engine.
 * Instead of static arrays, the engine compiles formal axioms from the database using the
 * DynamicAxiomCompiler. These axioms can 'self-reason' and apply themselves to an AST mathematically.
 */
class AxiomRegistry
{
    /** @var array<string, DialecticalAxiomInterface> */
    protected array $axioms = [];
    protected DynamicAxiomCompiler $compiler;

    public function __construct(DynamicAxiomCompiler $compiler)
    {
        $this->compiler = $compiler;
        // Dynamically load and compile axioms from the database
        $this->loadFromDatabase();
    }

    /**
     * Loads and compiles all active axioms from the database.
     * Leverages Cache to simulate OPcache fast memory loading.
     */
    protected function loadFromDatabase(): void
    {
        // Cache the compiled axioms to prevent DB hits on every request
        // The cache should be cleared when chatbot_training approves a new axiom
        $dbAxioms = Cache::remember('dialectical_axioms_graph', 3600, function () {
            // Using global_axiom status to ensure only expert-reviewed axioms enter the engine
            return KnowledgeAxiom::where('status', 'global_axiom')->get();
        });

        foreach ($dbAxioms as $model) {
            $compiledAxiom = $this->compiler->compile($model);
            $this->register($compiledAxiom);
        }
    }

    /**
     * Register a new axiom dynamically.
     */
    public function register(DialecticalAxiomInterface $axiom): void
    {
        $this->axioms[$axiom->getAxiomId()] = $axiom;
    }

    /**
     * Get a specific axiom by its ID.
     */
    public function getAxiom(string $id): ?DialecticalAxiomInterface
    {
        return $this->axioms[$id] ?? null;
    }

    /**
     * Given an AST context (e.g., domain, variables, constraints), search the registry
     * for all applicable parent axioms that can be used to form a proof.
     */
    public function findApplicableAxioms(array $astContext): array
    {
        $applicable = [];
        foreach ($this->axioms as $axiom) {
            if ($axiom->isApplicable($astContext)) {
                $applicable[] = $axiom;
                
                // Recursively fetch parent dependencies based on graph to construct the full proof path
                $applicable = array_merge($applicable, $this->resolveAncestors($axiom));
            }
        }
        
        // Remove duplicates and return
        $unique = [];
        foreach ($applicable as $ax) {
            $unique[$ax->getAxiomId()] = $ax;
        }
        
        return array_values($unique);
    }
    
    /**
     * Resolves the ancestral DAG (Directed Acyclic Graph) of an axiom.
     * Traverses the graph to find the foundational parents of any given axiom.
     *
     * @param DialecticalAxiomInterface $axiom
     * @return array<DialecticalAxiomInterface>
     */
    protected function resolveAncestors(DialecticalAxiomInterface $axiom): array
    {
        $ancestors = [];
        foreach ($axiom->getParentDependencies() as $parentId) {
            $parent = $this->getAxiom($parentId);
            if ($parent) {
                $ancestors[] = $parent;
                // Recursive descent into the DAG
                $ancestors = array_merge($ancestors, $this->resolveAncestors($parent));
            }
        }
        return $ancestors;
    }
}
