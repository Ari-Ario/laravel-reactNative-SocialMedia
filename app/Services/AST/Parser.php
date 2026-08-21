<?php

namespace App\Services\AST;

class Parser
{
    private array $tokens;
    private int $pos = 0;

    public function parse(array $tokens): array
    {
        $this->tokens = $tokens;
        $this->pos = 0;
        $statements = [];

        while ($this->pos < count($this->tokens)) {
            $stmt = $this->parseStatement();
            if ($stmt) {
                $statements[] = $stmt;
            } else {
                $this->pos++; // skip unparseable
            }
        }
        return $statements;
    }

    private function parseStatement(): ?array
    {
        $startPos = $this->pos;
        
        // Math Equation: VAR OP(=|>|<) EXPRESSION
        $math = $this->parseEquation();
        if ($math) return $math;

        $this->pos = $startPos;
        
        // Deductive/Inductive Linguistic
        $linguistic = $this->parseLinguistic();
        if ($linguistic) return $linguistic;

        return null;
    }

    private function parseEquation(): ?array
    {
        $startPos = $this->pos;
        $isConclusion = false;
        
        $token = $this->current();
        if ($token && $token['type'] === Tokenizer::T_KW && in_array($token['value'], ['therefore', 'conclusion'])) {
            $isConclusion = true;
            $this->pos++;
            if ($this->current() && $this->current()['value'] === ':') {
                $this->pos++;
            }
        }

        $left = $this->parseExpression();
        if (!$left) {
            $this->pos = $startPos;
            return null;
        }

        $op = $this->current();
        if ($op && $op['type'] === Tokenizer::T_OP && in_array($op['value'], ['=', '>', '<'])) {
            $this->pos++;
            $right = $this->parseExpression();
            if ($right) {
                // Consume end punctuation if any
                if ($this->current() && $this->current()['type'] === Tokenizer::T_PUNC) {
                    $this->pos++;
                }
                return [
                    'type' => 'equation',
                    'is_conclusion' => $isConclusion,
                    'left' => $left,
                    'operator' => $op['value'],
                    'right' => $right
                ];
            }
        }
        
        $this->pos = $startPos;
        return null;
    }

    private function parseExpression(): ?array
    {
        $token = $this->current();
        if (!$token) return null;

        if ($token['type'] === Tokenizer::T_VAR || $token['type'] === Tokenizer::T_NUM) {
            $left = $token;
            $this->pos++;

            $op = $this->current();
            if ($op && $op['type'] === Tokenizer::T_OP && in_array($op['value'], ['+', '-', '*', '/'])) {
                $this->pos++;
                $right = $this->parseExpression();
                return [
                    'type' => 'operation',
                    'left' => $left,
                    'operator' => $op['value'],
                    'right' => $right
                ];
            }
            return $left;
        }
        return null;
    }

    private function parseLinguistic(): ?array
    {
        // For now, capture until punctuation as a linguistic statement,
        // we'll let SyllogismSolverService handle the exact semantics 
        // using the tokens to avoid full NLP tree building.
        $words = [];
        $isConclusion = false;
        
        while ($this->pos < count($this->tokens)) {
            $t = $this->current();
            if ($t['type'] === Tokenizer::T_PUNC) {
                if (in_array($t['value'], ['.', ';', '!', '?'])) {
                    $this->pos++;
                    break;
                } else {
                    $words[] = $t['value'];
                    $this->pos++;
                    continue;
                }
            }
            if ($t['type'] === Tokenizer::T_KW && in_array($t['value'], ['therefore', 'conclusion'])) {
                $isConclusion = true;
                $this->pos++;
                // Skip following colon if exists
                if ($this->current() && $this->current()['value'] === ':') {
                    $this->pos++;
                }
                continue;
            }
            $words[] = $t['value'];
            $this->pos++;
        }
        
        if (empty($words)) return null;

        return [
            'type' => 'linguistic',
            'is_conclusion' => $isConclusion,
            'text' => implode(' ', $words)
        ];
    }

    private function current(): ?array
    {
        return $this->tokens[$this->pos] ?? null;
    }
}
