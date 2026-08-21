<?php

namespace App\Services\Dialectical\Semantic;

class ScientificTaxonomyService
{
    /**
     * Map a specific sub-branch/fragment to its ancestral taxonomy path.
     */
    public static function getTaxonomyPath(string $branch): array
    {
        $branch = strtolower(trim($branch));

        $taxonomy = [
            // Logic & Metaphysics Branches
            'ontology' => ['ontology', 'formal_logic', 'logic'],
            'metaphysics' => ['metaphysics', 'formal_logic', 'logic'],
            'epistemology' => ['epistemology', 'formal_logic', 'logic'],
            'phenomenology' => ['phenomenology', 'formal_logic', 'logic'],
            'existentialism' => ['existentialism', 'formal_logic', 'logic'],
            'mereology' => ['mereology', 'formal_logic', 'logic'],
            'boolean_logic' => ['boolean_logic', 'formal_logic', 'logic'],
            'symbolic_logic' => ['symbolic_logic', 'formal_logic', 'logic'],
            'predicate_logic' => ['predicate_logic', 'formal_logic', 'logic'],
            'modal_logic' => ['modal_logic', 'formal_logic', 'logic'],
            'fuzzy_logic' => ['fuzzy_logic', 'formal_logic', 'logic'],
            'paraconsistent_logic' => ['paraconsistent_logic', 'formal_logic', 'logic'],
            'temporal_logic' => ['temporal_logic', 'formal_logic', 'logic'],
            'proof_theory' => ['proof_theory', 'formal_logic', 'logic'],
            
            // Mathematical Branches
            'arithmetic' => ['arithmetic', 'math_partition', 'math'],
            'number_theory' => ['number_theory', 'math_partition', 'math'],
            'algebra' => ['algebra', 'math_partition', 'math'],
            'calculus' => ['calculus', 'math_partition', 'math'],
            'geometry' => ['geometry', 'math_partition', 'math'],
            'topology' => ['topology', 'math_partition', 'math'],
            'combinatorics' => ['combinatorics', 'math_partition', 'math'],
            'set_theory' => ['set_theory', 'math_partition', 'logic', 'math'],
            'category_theory' => ['category_theory', 'math_partition', 'logic', 'math'],
            'game_theory' => ['game_theory', 'math_partition', 'math'],
            'decision_theory' => ['decision_theory', 'math_partition', 'math'],
            
            // Physics Branches
            'classical_mechanics' => ['classical_mechanics', 'physics', 'natural_science'],
            'relativity' => ['relativity', 'physics', 'natural_science'],
            'quantum_mechanics' => ['quantum_mechanics', 'physics', 'natural_science'],
            'thermodynamics' => ['thermodynamics', 'physics', 'chemistry', 'natural_science'],
            'fluid_dynamics' => ['fluid_dynamics', 'physics', 'natural_science'],
            'astrophysics' => ['astrophysics', 'physics', 'natural_science'],
            
            // Chemistry Branches
            'inorganic_chemistry' => ['inorganic_chemistry', 'chemistry', 'natural_science'],
            'organic_chemistry' => ['organic_chemistry', 'chemistry', 'natural_science'],
            'physical_chemistry' => ['physical_chemistry', 'chemistry', 'physics', 'natural_science'],
            'quantum_chemistry' => ['quantum_chemistry', 'chemistry', 'physics', 'natural_science'],
            'polymer_chemistry' => ['polymer_chemistry', 'chemistry', 'natural_science'],
            'biochemistry' => ['biochemistry', 'biology', 'chemistry', 'natural_science'],
            
            // Biology & Medicine
            'cell_biology' => ['cell_biology', 'biology', 'natural_science'],
            'molecular_biology' => ['molecular_biology', 'biology', 'natural_science'],
            'genetics' => ['genetics', 'biology', 'natural_science'],
            'evolutionary_biology' => ['evolutionary_biology', 'biology', 'natural_science'],
            'neuroscience' => ['neuroscience', 'biology', 'medicine', 'natural_science'],
            'pharmacology' => ['pharmacology', 'biology', 'medicine', 'natural_science'],
            
            // Computer Science & Engineering
            'cryptography' => ['cryptography', 'computer_science', 'math', 'engineering'],
            'artificial_intelligence' => ['artificial_intelligence', 'computer_science', 'engineering'],
            'software_engineering' => ['software_engineering', 'computer_science', 'engineering'],
            'aerospace_engineering' => ['aerospace_engineering', 'engineering'],
            'electrical_engineering' => ['electrical_engineering', 'engineering'],
            
            // Social Sciences & Humanities
            'economics' => ['economics', 'social_science'],
            'sociology' => ['sociology', 'social_science'],
            'political_science' => ['political_science', 'social_science'],
            'linguistics' => ['linguistics', 'social_science', 'humanities'],
            'ethics' => ['ethics', 'humanities'],
            'epistemology' => ['epistemology', 'humanities'],
            'historical_materialism' => ['historical_materialism', 'humanities'],
            'dialectical_synthesis' => ['dialectical_synthesis', 'humanities'],
            'aesthetics' => ['aesthetics', 'humanities'],
            'history' => ['history', 'humanities'],
            'philosophy' => ['philosophy', 'humanities'],
            
            // Post-Human & Speculative
            'simulation_theory' => ['simulation_theory', 'speculative'],
            'transhumanism' => ['transhumanism', 'speculative'],
            'eschatology_omega_point' => ['eschatology_omega_point', 'speculative'],
            'kardashev_scale' => ['kardashev_scale', 'speculative']
        ];

        return $taxonomy[$branch] ?? [$branch, 'general'];
    }

    /**
     * Map a branch or category to its correct execution Solver class.
     */
    public static function resolveSolverClass(string $branch): string
    {
        $path = self::getTaxonomyPath($branch);

        // Check specific math sub-domains before general math_partition
        if (in_array($branch, ['calculus', 'trigonometry', 'mathematical_analysis', 'analysis', 'transcendental']) || in_array('calculus', $path)) {
            return \App\Services\Dialectical\Solvers\MathematicalAnalysisSolver::class;
        }

        if (in_array($branch, ['complex_analysis', 'complex_domain', 'complex']) || in_array('complex_analysis', $path)) {
            return \App\Services\Dialectical\Solvers\ComplexDomainSolver::class;
        }

        if (in_array($branch, ['summation', 'algebraic_summation', 'series'])) {
            return \App\Services\Dialectical\Solvers\AlgebraicSummationSolver::class;
        }

        if (in_array($branch, ['set_theory']) || in_array('set_theory', $path)) {
            return \App\Services\Dialectical\Solvers\SetTheorySolver::class;
        }

        // Check path ancestry to route correctly
        if (in_array('math_partition', $path) || in_array('math', $path)) {
            return \App\Services\Dialectical\Solvers\NumberTheorySolver::class;
        }

        if (in_array('formal_logic', $path) || in_array('logic', $path)) {
            return \App\Services\Dialectical\Solvers\FormalLogicSolver::class;
        }

        if (in_array($branch, ['statistics', 'bayes', 'bayesian', 'probability', 'entropy', 'variance', 'z-score', 'normal_distribution']) || in_array('statistics', $path)) {
            return \App\Services\Dialectical\Solvers\StatisticalScienceSolver::class;
        }

        if (in_array($branch, ['computer_science', 'cryptography', 'cs_algorithms', 'algorithms', 'software_engineering', 'turing', 'halting', 'hash_collision']) || in_array('computer_science', $path)) {
            return \App\Services\Dialectical\Solvers\ComputationalLogicSolver::class;
        }

        if (in_array('engineering', $path) || in_array('aerospace_engineering', $path) || in_array('fluid_dynamics', $path) || in_array('civil_engineering', $path) || in_array('mechanical_engineering', $path) || in_array('materials_science', $path)) {
            return \App\Services\Dialectical\Solvers\EngineeringScienceSolver::class;
        }

        if (in_array('social_science', $path) || in_array('economics', $path) || in_array('sociology', $path) || in_array('political_science', $path) || in_array('microeconomics', $path) || in_array('macroeconomics', $path) || in_array('behavioral_economics', $path)) {
            return \App\Services\Dialectical\Solvers\SocialScienceSolver::class;
        }

        if (in_array('humanities', $path) || in_array('philosophy', $path) || in_array('history', $path) || in_array('ethics', $path) || in_array('epistemology', $path) || in_array('historical_materialism', $path) || in_array('dialectical_synthesis', $path) || in_array('aesthetics', $path)) {
            return \App\Services\Dialectical\Solvers\HumanitiesDialecticsSolver::class;
        }

        if (in_array('speculative', $path) || in_array('simulation_theory', $path) || in_array('transhumanism', $path) || in_array('eschatology_omega_point', $path) || in_array('kardashev_scale', $path)) {
            return \App\Services\Dialectical\Solvers\PostHumanSpeculativeSolver::class;
        }

        if (in_array($branch, ['quantum_mechanics', 'quantum_chemistry']) || in_array('quantum_mechanics', $path)) {
            return \App\Services\Dialectical\Solvers\QuantumMechanicsSolver::class;
        }

        if (in_array($branch, ['empirical_science', 'cosmology', 'geology', 'climatology'])) {
            return \App\Services\Dialectical\Solvers\EmpiricalScienceSolver::class;
        }

        // Default to general/natural science solver
        return \App\Services\Dialectical\Solvers\NaturalScienceSolver::class;
    }
}
