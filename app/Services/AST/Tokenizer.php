<?php

namespace App\Services\AST;

class Tokenizer
{
    const T_VAR = 'T_VAR';
    const T_OP = 'T_OP';
    const T_NUM = 'T_NUM';
    const T_PUNC = 'T_PUNC';
    const T_LITERAL = 'T_LITERAL';
    const T_KW = 'T_KW';

    private array $keywords = [
        'all', 'some', 'no', 'are', 'is', 'therefore', 'if', 'then', 'not', 'and', 'or', 'either', 'both', 'prove', 'by', 'induction', 'for', 'sample', 'conclusion'
    ];

    public function tokenize(string $input): array
    {
        $tokens = [];
        $length = strlen($input);
        $i = 0;

        while ($i < $length) {
            $char = $input[$i];

            if (ctype_space($char)) {
                $i++;
                continue;
            }

            if (str_contains('.,:;', $char)) {
                $tokens[] = ['type' => self::T_PUNC, 'value' => $char];
                $i++;
                continue;
            }

            if (str_contains('=><+-*/()', $char)) {
                $tokens[] = ['type' => self::T_OP, 'value' => $char];
                $i++;
                continue;
            }

            if (ctype_digit($char)) {
                $num = '';
                while ($i < $length && ctype_digit($input[$i])) {
                    $num .= $input[$i];
                    $i++;
                }
                $tokens[] = ['type' => self::T_NUM, 'value' => $num];
                continue;
            }

            if (ctype_alpha($char)) {
                $word = '';
                while ($i < $length && (ctype_alnum($input[$i]) || $input[$i] === '-' || $input[$i] === '_')) {
                    $word .= $input[$i];
                    $i++;
                }
                $lowerWord = strtolower($word);
                if (in_array($lowerWord, $this->keywords)) {
                    $tokens[] = ['type' => self::T_KW, 'value' => $lowerWord];
                } elseif (strlen($word) === 1 && ctype_lower($word)) {
                    $tokens[] = ['type' => self::T_VAR, 'value' => $word];
                } else {
                    $tokens[] = ['type' => self::T_LITERAL, 'value' => $word];
                }
                continue;
            }
            
            $tokens[] = ['type' => 'T_UNKNOWN', 'value' => $char];
            $i++;
        }

        return $tokens;
    }
}
