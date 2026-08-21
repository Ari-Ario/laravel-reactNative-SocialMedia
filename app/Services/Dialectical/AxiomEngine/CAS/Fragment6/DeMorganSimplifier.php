<?php

namespace App\Services\Dialectical\AxiomEngine\CAS\Fragment6;

class DeMorganSimplifier
{
    /**
     * Performs structural mutation on a logic AST to distribute NOT operators.
     * e.g. NOT (A AND B) -> (NOT A) OR (NOT B)
     */
    public function simplify(array $logicAst): array
    {
        // Simple structural rewrite for De Morgan's laws
        if (isset($logicAst['operator']) && strtoupper($logicAst['operator']) === 'NOT') {
            $inner = $logicAst['operand'] ?? null;
            if ($inner && isset($inner['operator'])) {
                if (strtoupper($inner['operator']) === 'AND') {
                    return [
                        'operator' => 'OR',
                        'left' => ['operator' => 'NOT', 'operand' => $inner['left']],
                        'right' => ['operator' => 'NOT', 'operand' => $inner['right']]
                    ];
                }
                if (strtoupper($inner['operator']) === 'OR') {
                    return [
                        'operator' => 'AND',
                        'left' => ['operator' => 'NOT', 'operand' => $inner['left']],
                        'right' => ['operator' => 'NOT', 'operand' => $inner['right']]
                    ];
                }
            }
        }
        
        return $logicAst;
    }
}
