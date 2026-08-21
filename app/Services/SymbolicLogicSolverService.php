<?php

namespace App\Services;

class SymbolicLogicSolverService
{
    private $pos = 0;
    private $tokens = [];

    /**
     * Checks if a logical expression is a Tautology (always true).
     * Returns an array with 'is_tautology' => bool, 'variables' => array, 'truth_table' => array of evaluated rows.
     */
    public function proveTautology(string $expression): array
    {
        $tokens = $this->tokenize($expression);
        $ast = $this->parse($tokens);
        
        $vars = $this->extractVariables($ast);
        $vars = array_values(array_unique($vars));
        sort($vars);
        
        $rows = [];
        $isTautology = true;
        
        $numVars = count($vars);
        $numRows = pow(2, $numVars);
        
        for ($i = 0; $i < $numRows; $i++) {
            $bindings = [];
            for ($v = 0; $v < $numVars; $v++) {
                // Determine truth value for this variable in this row
                $val = ($i >> ($numVars - 1 - $v)) & 1;
                $bindings[$vars[$v]] = (bool)$val;
            }
            
            $result = $this->evaluateAST($ast, $bindings);
            if (!$result) {
                $isTautology = false;
            }
            
            $rows[] = [
                'bindings' => $bindings,
                'result' => $result
            ];
        }
        
        return [
            'is_tautology' => $isTautology,
            'variables' => $vars,
            'truth_table' => $rows,
            'ast' => $ast
        ];
    }

    /**
     * Public wrapper to parse and evaluate an expression with bindings.
     */
    public function evaluate(string $expression, array $bindings): bool
    {
        $tokens = $this->tokenize($expression);
        $ast = $this->parse($tokens);
        return $this->evaluateAST($ast, $bindings);
    }

    private function tokenize(string $expr): array
    {
        $expr = str_replace([' ', "\t", "\n"], '', $expr);
        // Replace aliases
        $expr = str_ireplace(['implies', '=>'], '->', $expr);
        $expr = str_ireplace(['iff', '<=>'], '<->', $expr);
        $expr = str_ireplace(['and', '&&'], '&', $expr);
        $expr = str_ireplace(['or', '||'], '|', $expr);
        $expr = str_ireplace(['not', '!'], '~', $expr);
        
        $tokens = [];
        $i = 0;
        $len = strlen($expr);
        
        while ($i < $len) {
            $char = $expr[$i];
            
            if (preg_match('/[a-zA-Z_]/', $char)) {
                $var = '';
                while ($i < $len && preg_match('/[a-zA-Z_0-9]/', $expr[$i])) {
                    $var .= $expr[$i];
                    $i++;
                }
                $tokens[] = ['type' => 'VAR', 'value' => $var];
                continue;
            }
            
            if ($char === '<' && $i + 2 < $len && substr($expr, $i, 3) === '<->') {
                $tokens[] = ['type' => 'OP', 'value' => '<->'];
                $i += 3;
                continue;
            }
            
            if ($char === '-' && $i + 1 < $len && substr($expr, $i, 2) === '->') {
                $tokens[] = ['type' => 'OP', 'value' => '->'];
                $i += 2;
                continue;
            }
            
            if (in_array($char, ['&', '|', '~', '(', ')'])) {
                $tokens[] = ['type' => 'OP', 'value' => $char];
                $i++;
                continue;
            }
            
            $i++;
        }
        
        return $tokens;
    }

    private function parse(array &$tokens)
    {
        $this->pos = 0;
        $this->tokens = $tokens;
        return $this->parseIff();
    }

    private function currentToken() {
        return $this->pos < count($this->tokens) ? $this->tokens[$this->pos] : null;
    }

    private function consume() {
        $this->pos++;
    }

    private function parseIff() {
        $node = $this->parseImplies();
        while ($curr = $this->currentToken()) {
            if ($curr['type'] === 'OP' && $curr['value'] === '<->') {
                $this->consume();
                $right = $this->parseImplies();
                $node = ['type' => '<->', 'left' => $node, 'right' => $right];
            } else {
                break;
            }
        }
        return $node;
    }

    private function parseImplies() {
        $node = $this->parseOr();
        while ($curr = $this->currentToken()) {
            if ($curr['type'] === 'OP' && $curr['value'] === '->') {
                $this->consume();
                $right = $this->parseImplies(); // Right associative
                $node = ['type' => '->', 'left' => $node, 'right' => $right];
            } else {
                break;
            }
        }
        return $node;
    }

    private function parseOr() {
        $node = $this->parseAnd();
        while ($curr = $this->currentToken()) {
            if ($curr['type'] === 'OP' && $curr['value'] === '|') {
                $this->consume();
                $right = $this->parseAnd();
                $node = ['type' => '|', 'left' => $node, 'right' => $right];
            } else {
                break;
            }
        }
        return $node;
    }

    private function parseAnd() {
        $node = $this->parseNot();
        while ($curr = $this->currentToken()) {
            if ($curr['type'] === 'OP' && $curr['value'] === '&') {
                $this->consume();
                $right = $this->parseNot();
                $node = ['type' => '&', 'left' => $node, 'right' => $right];
            } else {
                break;
            }
        }
        return $node;
    }

    private function parseNot() {
        $curr = $this->currentToken();
        if ($curr && $curr['type'] === 'OP' && $curr['value'] === '~') {
            $this->consume();
            $node = $this->parseNot();
            return ['type' => '~', 'operand' => $node];
        }
        return $this->parsePrimary();
    }

    private function parsePrimary() {
        $curr = $this->currentToken();
        if (!$curr) return null;

        if ($curr['type'] === 'VAR') {
            $this->consume();
            return $curr;
        }

        if ($curr['type'] === 'OP' && $curr['value'] === '(') {
            $this->consume();
            $node = $this->parseIff();
            if ($this->currentToken() && $this->currentToken()['value'] === ')') {
                $this->consume();
            }
            return $node;
        }

        return null;
    }

    private function extractVariables($node): array
    {
        if (!$node) return [];
        if ($node['type'] === 'VAR') return [$node['value']];
        if ($node['type'] === '~') return $this->extractVariables($node['operand']);
        
        return array_merge(
            $this->extractVariables($node['left'] ?? null),
            $this->extractVariables($node['right'] ?? null)
        );
    }

    private function evaluateAST($node, array $bindings): bool
    {
        if (!$node) return false;

        if ($node['type'] === 'VAR') {
            return $bindings[$node['value']] ?? false;
        }

        if ($node['type'] === '~') {
            return !$this->evaluateAST($node['operand'], $bindings);
        }

        if ($node['type'] === '&') {
            return $this->evaluateAST($node['left'], $bindings) && $this->evaluateAST($node['right'], $bindings);
        }

        if ($node['type'] === '|') {
            return $this->evaluateAST($node['left'], $bindings) || $this->evaluateAST($node['right'], $bindings);
        }

        if ($node['type'] === '->') {
            $p = $this->evaluateAST($node['left'], $bindings);
            $q = $this->evaluateAST($node['right'], $bindings);
            return !$p || $q;
        }

        if ($node['type'] === '<->') {
            $p = $this->evaluateAST($node['left'], $bindings);
            $q = $this->evaluateAST($node['right'], $bindings);
            return $p === $q;
        }

        return false;
    }
}
