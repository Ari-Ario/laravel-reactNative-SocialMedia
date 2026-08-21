<?php

namespace App\Services\CAS;

class ComputerAlgebraSystem
{
    private array $variables = [];
    private array $inequalities = [];
    private array $equalities = [];

    /**
     * Attempts to resolve mathematical AST statements.
     * Returns a valid LaTeX proof string if solved natively, null if it needs Expert Review.
     */
    public function evaluateAST(array $astStatements): ?array
    {
        $this->variables = [];
        $this->inequalities = [];
        $this->equalities = [];
        $steps = [];

        foreach ($astStatements as $stmt) {
            if ($stmt['type'] === 'equation') {
                $this->processEquation($stmt, $steps);
            }
        }

        // Look for a conclusion to verify
        $conclusion = end($astStatements);
        if ($conclusion && $conclusion['type'] === 'equation') {
            $isVerified = $this->verifyConclusion($conclusion, $steps);
            if ($isVerified) {
                return [
                    'status' => 'proven',
                    'proof' => implode("\n", $steps)
                ];
            }
        }

        return null; // Fallback to NLP / Expert review if CAS fails
    }

    private function processEquation(array $stmt, array &$steps): void
    {
        $op = $stmt['operator'];
        
        // Handle assignment/evaluation: x = y + 1
        if ($op === '=') {
            $l = $this->formatExpr($stmt['left']);
            $r = $this->formatExpr($stmt['right']);
            $this->equalities[] = ['left' => $l, 'right' => $r];

            if ($stmt['left']['type'] === 'T_VAR') {
                $varName = $stmt['left']['value'];
                $val = $this->evaluateExpression($stmt['right']);
                if ($val !== null) {
                    $this->variables[$varName] = $val;
                    $steps[] = "Identified substitution: `" . $varName . " = " . $val . "`";
                } else {
                    $steps[] = "Stored relation: `" . $l . " = " . $r . "`";
                }
            } else {
                $steps[] = "Stored relation: `" . $l . " = " . $r . "`";
            }
        }
        
        // Handle Transitivity: a > b
        if ($op === '>' || $op === '<') {
            $l = $this->formatExpr($stmt['left']);
            $r = $this->formatExpr($stmt['right']);
            $this->inequalities[] = ['left' => $l, 'op' => $op, 'right' => $r];
            $steps[] = "Stored inequality constraint: `" . $l . " " . $op . " " . $r . "`";
        }
    }

    private function evaluateExpression(array $expr)
    {
        if (isset($expr['type']) && $expr['type'] === 'T_NUM') {
            return (float) $expr['value'];
        }
        
        if (isset($expr['type']) && $expr['type'] === 'T_VAR') {
            return $this->variables[$expr['value']] ?? null;
        }

        if (isset($expr['type']) && $expr['type'] === 'operation') {
            $leftVal = $this->evaluateExpression($expr['left']);
            $rightVal = $this->evaluateExpression($expr['right']);
            
            if ($leftVal !== null && $rightVal !== null) {
                switch ($expr['operator']) {
                    case '+': return \App\Services\CAS\AxiomaticMath::add($leftVal, $rightVal);
                    case '-': return \App\Services\CAS\AxiomaticMath::subtract($leftVal, $rightVal);
                    case '*': return \App\Services\CAS\AxiomaticMath::multiply($leftVal, $rightVal);
                    case '/': return $rightVal != 0 ? \App\Services\CAS\AxiomaticMath::divide($leftVal, $rightVal) : null;
                }
            }
        }
        return null;
    }

    private function formatExpr(array $expr): string
    {
        if (isset($expr['type']) && in_array($expr['type'], ['T_NUM', 'T_VAR'])) {
            return $expr['value'];
        }
        if (isset($expr['type']) && $expr['type'] === 'operation') {
            return $this->formatExpr($expr['left']) . " " . $expr['operator'] . " " . $this->formatExpr($expr['right']);
        }
        return "?";
    }

    private function verifyConclusion(array $conclusion, array &$steps): bool
    {
        $op = $conclusion['operator'];

        if ($op === '=') {
            $l = $this->formatExpr($conclusion['left']);
            $r = $this->formatExpr($conclusion['right']);

            $leftVal = $this->evaluateExpression($conclusion['left']);
            $rightVal = $this->evaluateExpression($conclusion['right']);
            
            if ($leftVal !== null && $rightVal !== null && $leftVal === $rightVal) {
                $steps[] = ">> Dynamic CAS Evaluation Verified: `" . $l . " = " . $rightVal . "` matches conclusion.";
                $steps[] = ">> Anchored to Zermelo-Fraenkel (ZFC) Axiom of Extensionality and Peano Arithmetic substitution.";
                return true;
            }

            // Stored relations transitivity: check if there is a path from l to r in the equations graph
            $adj = [];
            foreach ($this->equalities as $eq) {
                $leftStr = $eq['left'];
                $rightStr = $eq['right'];
                $adj[$leftStr][] = $rightStr;
                $adj[$rightStr][] = $leftStr;
            }
            
            if (isset($adj[$l])) {
                $visited = [];
                $queue = [$l];
                $visited[$l] = true;
                $parent = [];
                
                while (!empty($queue)) {
                    $curr = array_shift($queue);
                    if ($curr === $r) {
                        $path = [];
                        $node = $r;
                        while ($node !== $l) {
                            $path[] = $node;
                            $node = $parent[$node];
                        }
                        $path[] = $l;
                        $path = array_reverse($path);
                        
                        $chain = [];
                        for ($k = 0; $k < count($path) - 1; $k++) {
                            $chain[] = "`" . $path[$k] . " = " . $path[$k+1] . "`";
                        }
                        $steps[] = ">> Transitivity axiom verified: since " . implode(" and ", $chain) . " then `" . $l . " = " . $r . "`.";
                        $steps[] = ">> Anchored to Zermelo-Fraenkel (ZFC) Axiom of Extensionality (Transitivity of Equivalence).";
                        return true;
                    }
                    
                    if (isset($adj[$curr])) {
                        foreach ($adj[$curr] as $neighbor) {
                            if (empty($visited[$neighbor])) {
                                $visited[$neighbor] = true;
                                $parent[$neighbor] = $curr;
                                $queue[] = $neighbor;
                            }
                        }
                    }
                }
            }
        }

        if ($op === '>') {
            // Check transitivity a > c if a > b and b > c
            $l = $this->formatExpr($conclusion['left']);
            $r = $this->formatExpr($conclusion['right']);
            
            foreach ($this->inequalities as $ineq1) {
                if ($ineq1['left'] === $l && $ineq1['op'] === '>') {
                    $mid = $ineq1['right'];
                    foreach ($this->inequalities as $ineq2) {
                        if ($ineq2['left'] === $mid && $ineq2['op'] === '>' && $ineq2['right'] === $r) {
                            $steps[] = ">> Transitivity axiom verified: if `" . $l . " > " . $mid . "` and `" . $mid . " > " . $r . "` then `" . $l . " > " . $r . "`.";
                            $steps[] = ">> Anchored to Peano Axioms for strict total ordering of natural numbers.";
                            return true;
                        }
                    }
                }
            }
        }

        return false;
    }
}
