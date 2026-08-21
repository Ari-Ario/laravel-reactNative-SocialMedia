<?php

namespace App\Services\Dialectical\AxiomEngine\Empirical\Fragment10;

class DynamicLoopEngine
{
    private int $maxIterations;
    private int $timeoutSeconds;

    public function __construct(int $maxIterations = 100000, int $timeoutSeconds = 5)
    {
        $this->maxIterations = $maxIterations;
        $this->timeoutSeconds = $timeoutSeconds;
    }

    /**
     * Executes an empirical brute-force test across one or more domain iterables.
     * Evaluates a $hypothesisClosure against the Cartesian product of the provided variables.
     * 
     * @param array $domainIterables e.g., ['x' => [1,2,3], 'y' => [4,5,6]]
     * @param \Closure $hypothesisClosure function(array $state): mixed
     * @return array The structured results matrix of the empirical test.
     */
    public function executeBruteForce(array $domainIterables, \Closure $hypothesisClosure): array
    {
        $startTime = microtime(true);
        $iterations = 0;
        
        $variables = array_keys($domainIterables);
        $results = [];
        
        // Recursive closure to synthesize N-dimensional loops dynamically
        $synthesizeLoop = function(int $varIndex, array $currentState) use (
            &$synthesizeLoop, 
            $domainIterables, 
            $variables, 
            $hypothesisClosure, 
            &$iterations, 
            $startTime, 
            &$results
        ) {
            // Safety boundaries
            if ($iterations >= $this->maxIterations) {
                throw new \RuntimeException("Empirical JIT Engine aborted: Max iterations ({$this->maxIterations}) exceeded.");
            }
            if ((microtime(true) - $startTime) > $this->timeoutSeconds) {
                throw new \RuntimeException("Empirical JIT Engine aborted: Execution timeout ({$this->timeoutSeconds}s) exceeded.");
            }

            // Base case: we have a full permutation state
            if ($varIndex >= count($variables)) {
                $iterations++;
                // Evaluate the state
                $evaluation = $hypothesisClosure($currentState);
                $results[] = [
                    'state' => $currentState,
                    'result' => $evaluation
                ];
                return;
            }
            
            // Recursive generation
            $currentVar = $variables[$varIndex];
            $currentDomain = $domainIterables[$currentVar];
            
            foreach ($currentDomain as $val) {
                $currentState[$currentVar] = $val;
                $synthesizeLoop($varIndex + 1, $currentState);
            }
        };
        
        $synthesizeLoop(0, []);
        
        return [
            'meta' => [
                'iterations' => $iterations,
                'execution_time_ms' => round((microtime(true) - $startTime) * 1000, 2),
                'status' => 'completed_safely'
            ],
            'matrix' => $results
        ];
    }
    


    /**
     * Executes a sequential simulation across the domain iterables.
     * Iterates index by index up to a limit. Ensures "less-to-more" deterministic testing.
     */
    public function executeSequential(array $domainIterables, \Closure $hypothesisClosure, int $limit = 10): array
    {
        $startTime = microtime(true);
        $results = [];
        $variables = array_keys($domainIterables);
        
        // Find the maximum index we can safely access across all domain variables
        $maxSafeIndex = PHP_INT_MAX;
        foreach ($domainIterables as $domain) {
            $maxSafeIndex = min($maxSafeIndex, count($domain) - 1);
        }
        
        if ($maxSafeIndex < 0) {
            return [
                'meta' => [
                    'iterations' => 0,
                    'execution_time_ms' => 0,
                    'status' => 'empty_domain'
                ],
                'matrix' => []
            ];
        }

        $iterations = min($limit, $this->maxIterations, $maxSafeIndex + 1);
        
        for ($i = 0; $i < $iterations; $i++) {
            if ((microtime(true) - $startTime) > $this->timeoutSeconds) {
                break;
            }
            
            $sequentialState = [];
            foreach ($variables as $var) {
                $sequentialState[$var] = $domainIterables[$var][$i];
            }
            
            $evaluation = $hypothesisClosure($sequentialState);
            $results[] = [
                'state' => $sequentialState,
                'result' => $evaluation
            ];
        }
        
        return [
            'meta' => [
                'iterations' => count($results),
                'execution_time_ms' => round((microtime(true) - $startTime) * 1000, 2),
                'status' => 'sequential_completed'
            ],
            'matrix' => $results
        ];
    }
}
