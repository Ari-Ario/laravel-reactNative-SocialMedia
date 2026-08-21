<?php

namespace App\Services\Dialectical\Semantic;

class LaTeXMathNormalizer
{
    /**
     * Normalize raw math or science query coming from frontend into canonical representation.
     * Supports LaTeX, TeX delimiters ($$, $), Unicode math symbols, and natural language shorthand.
     */
    public static function normalize(string $input): string
    {
        $text = trim($input);

        // 1. Global Delimiter Stripping
        // Strip $$...$$, $...$, \[...\], \(...\), \begin{equation}...\end{equation}
        $text = preg_replace('/\$\$(.*?)\$\$/s', '$1', $text);
        $text = preg_replace('/(?<!\\\\)\$(.*?)(?<!\\\\)\$/s', '$1', $text); // Match $...$ but not \$
        $text = preg_replace('/\\\\\[(.*?)\\\\\]/s', '$1', $text);
        $text = preg_replace('/\\\\\((.*?)\\\\\)/s', '$1', $text);
        $text = preg_replace('/\\\\begin\{equation\}(.*?)\\\\end\{equation\}/s', '$1', $text);
        $text = preg_replace('/\\\\begin\{align\}(.*?)\\\\end\{align\}/s', '$1', $text);

        // 2. Recursive Fraction Normalization: \frac{A}{B} -> (A)/(B)
        // We use (?R) for recursion, but in PHP PCRE, (?1) is better for recursing a specific subpattern.
        // We will process inner-most fractions first by looping until no more \frac exist.
        // But looping with a non-recursive regex that captures inner-most braces is easier and safer.
        while (preg_match('/\\\\frac\{([^{}]*)\}\{([^{}]*)\}/i', $text)) {
            $text = preg_replace('/\\\\frac\{([^{}]*)\}\{([^{}]*)\}/i', '($1)/($2)', $text);
        }
        // Then handle 1-level deep nested braces by simply applying a more permissive regex loop for remaining fractions.
        // To properly handle arbitrary nesting, we use recursive regex:
        $maxIterations = 10;
        for ($i = 0; $i < $maxIterations; $i++) {
            $text = preg_replace_callback('/\\\\frac\{((?:[^{}]++|(?R))*)\}\{((?:[^{}]++|(?R))*)\}/i', function($m) {
                return '(' . $m[1] . ')/(' . $m[2] . ')';
            }, $text, -1, $count);
            if ($count === 0) break;
        }

        // 3. Strip structural wrappers
        $wrappers = ['text', 'mathbf', 'mathit', 'mathrm', 'mathsf', 'mathtt', 'hat', 'vec', 'bar', 'dot', 'ddot', 'tilde'];
        $wrapperRegex = '/\\\\(?:' . implode('|', $wrappers) . ')\{((?:[^{}]++|(?R))*)\}/i';
        for ($i = 0; $i < $maxIterations; $i++) {
            $text = preg_replace_callback($wrapperRegex, function($m) {
                return $m[1];
            }, $text, -1, $count);
            if ($count === 0) break;
        }

        $text = str_replace(['\left', '\right'], '', $text);
        $text = str_replace(['\big', '\Big', '\bigg', '\Bigg'], '', $text);

        // 4. Roots
        for ($i = 0; $i < $maxIterations; $i++) {
            $text = preg_replace_callback('/\\\\sqrt(?:\[([^{}\[\]]*)\])?\{((?:[^{}]++|(?R))*)\}/i', function($m) {
                if (!empty($m[1])) {
                    return 'root(' . $m[2] . ', ' . $m[1] . ')';
                }
                return 'sqrt(' . $m[2] . ')';
            }, $text, -1, $count);
            if ($count === 0) break;
        }

        // 5. LaTeX Power Trig Functions: \sin^n(x+1)
        $trigFns = 'sin|cos|tan|sinh|cosh|tanh|sec|csc|cot|arcsin|arccos|arctan';
        // Match trig with exponent: \sin^{expr}(expr) or \sin^2 x
        $text = preg_replace('/\\\\(' . $trigFns . ')\^\{((?:[^{}]++|(?R))*)\}\s*\(?([^()]+)\)?/i', '$1($3)^($2)', $text);
        $text = preg_replace('/\\\\(' . $trigFns . ')\^([0-9a-zA-Z]+)\s*\(?([^()]+)\)?/i', '$1($3)^$2', $text);
        // Match normal trig: \sin(x) or \sin x
        $text = preg_replace('/\\\\(' . $trigFns . ')\s*\(([^()]+)\)/i', '$1($2)', $text);

        // 6. LaTeX Calculus & Limit Operators
        // Limit: \lim_{x \to \infty}
        $text = preg_replace('/\\\\lim_\{([^}]+)\s*(?:\\\\to|->)\s*([^}]+)\}/i', 'lim($1->$2)', $text);
        $text = preg_replace('/\\\\lim_([a-zA-Z0-9]+)\s*(?:\\\\to|->)\s*([a-zA-Z0-9_\.\\\\]+)/i', 'lim($1->$2)', $text);
        
        // Sum and Prod: \sum_{i=1}^{n}, \sum_{i=1}^n, \prod...
        $text = preg_replace('/\\\\sum_(?:\{([^}]+)\}|([0-9a-zA-Z\\\\]+))\^(?:\{([^}]+)\}|([0-9a-zA-Z\\\\]+))/i', 'Sum($1$2..$3$4)', $text);
        $text = preg_replace('/\\\\prod_(?:\{([^}]+)\}|([0-9a-zA-Z\\\\]+))\^(?:\{([^}]+)\}|([0-9a-zA-Z\\\\]+))/i', 'Product($1$2..$3$4)', $text);

        // Integrals
        // Definite: \int_a^b or \int^b_a
        $text = preg_replace('/\\\\int_(?:\{([^}]+)\}|([0-9a-zA-Z\\\\]+))\^(?:\{([^}]+)\}|([0-9a-zA-Z\\\\]+))\s*(.*?)\s*(?:d([a-zA-Z])|\\\\,\\s*d([a-zA-Z]))/i', 'integral of ($5) from $1$2 to $3$4 d$6$7', $text);
        $text = preg_replace('/\\\\int\^(?:\{([^}]+)\}|([0-9a-zA-Z\\\\]+))_(?:\{([^}]+)\}|([0-9a-zA-Z\\\\]+))\s*(.*?)\s*(?:d([a-zA-Z])|\\\\,\\s*d([a-zA-Z]))/i', 'integral of ($5) from $3$4 to $1$2 d$6$7', $text);
        // Indefinite: \int f(x) dx
        $text = preg_replace('/\\\\int\s+(.*?)\s*(?:d([a-zA-Z])|\\\\,\\s*d([a-zA-Z]))/i', 'integral of ($1) d$2$3', $text);

        // Matrices mapping
        $text = preg_replace_callback('/\\\\begin\{(p|b|v|V|B)matrix\}(.*?)\\\\end\{\1matrix\}/s', function($m) {
            $content = $m[2];
            $rows = explode('\\\\', $content);
            $parsedRows = array_map(function($row) {
                $cols = explode('&', $row);
                return '[' . implode(', ', array_map('trim', $cols)) . ']';
            }, array_filter($rows, 'trim'));
            return '[' . implode(', ', $parsedRows) . ']';
        }, $text);

        // 7. LaTeX Operators & Symbols
        $latexMap = [
            '\ln'       => 'ln',
            '\log'      => 'log',
            '\exp'      => 'exp',
            '\infty'    => 'infinity',
            '\cdot'     => '*',
            '\times'    => '*',
            '\div'      => '/',
            '\pm'       => '+-',
            '\le'       => '<=',
            '\leq'      => '<=',
            '\ge'       => '>=',
            '\geq'      => '>=',
            '\neq'      => '!=',
            '\ne'       => '!=',
            '\approx'   => '=',
            '\equiv'    => '=',
            '\in'       => 'in',
            '\notin'    => 'not in',
            '\forall'   => 'for all',
            '\exists'   => 'there exists',
            '\implies'  => '=>',
            '\Rightarrow' => '=>',
            '\rightarrow' => '->',
            '\leftarrow'  => '<-',
            '\iff'      => '<=>',
            '\Leftrightarrow' => '<=>',
            '\to'       => '->',
            '\partial'  => 'del',
            '\nabla'    => 'nabla',
            '\hbar'     => 'hbar',
            '\pi'       => 'pi',
            '\theta'    => 'theta',
            '\alpha'    => 'alpha',
            '\beta'     => 'beta',
            '\gamma'    => 'gamma',
            '\delta'    => 'delta',
            '\epsilon'  => 'epsilon',
            '\varepsilon' => 'epsilon',
            '\lambda'   => 'lambda',
            '\mu'       => 'mu',
            '\sigma'    => 'sigma',
            '\psi'      => 'psi',
            '\phi'      => 'phi',
            '\varphi'   => 'phi',
            '\omega'    => 'omega',
            '\Omega'    => 'Omega',
            '\Gamma'    => 'Gamma',
            '\Delta'    => 'Delta',
            '\Theta'    => 'Theta',
            '\Lambda'   => 'Lambda',
            '\Pi'       => 'Pi',
            '\Sigma'    => 'Sigma',
            '\Phi'      => 'Phi',
            '\Psi'      => 'Psi',
            '\cup'      => 'union',
            '\cap'      => 'intersect',
            '\wedge'    => 'and',
            '\vee'      => 'or',
            '\subset'   => 'subset of',
            '\subseteq' => 'subset or equal to',
            '\supset'   => 'superset of',
            '\supseteq' => 'superset or equal to',
            '\iint'     => 'double integral',
            '\oint'     => 'contour integral',
            '\setminus' => '\\',
        ];

        foreach ($latexMap as $cmd => $repl) {
            // Need to match command. If it's a letter command, require word boundary or non-letter
            if (preg_match('/^[a-zA-Z]+$/', substr($cmd, 1))) {
                $pattern = '/' . preg_quote($cmd, '/') . '(?![a-zA-Z])/i';
            } else {
                $pattern = '/' . preg_quote($cmd, '/') . '/i';
            }
            $text = preg_replace($pattern, $repl, $text);
        }

        // Subscript and Superscript general un-nesting: a_{b} -> a_(b), a^{b} -> a^(b)
        $text = preg_replace_callback('/_\{((?:[^{}]++|(?R))*)\}/', function($m) {
            return '_(' . $m[1] . ')';
        }, $text);
        $text = preg_replace_callback('/\^\{((?:[^{}]++|(?R))*)\}/', function($m) {
            return '^(' . $m[1] . ')';
        }, $text);

        // 8. Unicode Super/Subscript & Symbol Map
        $unicodeMap = [
            '²' => '^2', '³' => '^3', '⁴' => '^4', '⁵' => '^5',
            '⁶' => '^6', '⁷' => '^7', '⁸' => '^8', '⁹' => '^9', '⁰' => '^0',
            'ⁿ' => '^n', 'ᵐ' => '^m', '⁺' => '+', '⁻' => '-',
            '₁' => '_1', '₂' => '_2', '₃' => '_3', '₄' => '_4', '₅' => '_5',
            '×' => '*', '÷' => '/', '±' => '+-', '√' => 'sqrt',
            '∫' => 'integral', '∑' => 'sum', '∏' => 'product',
            'π' => 'pi', 'θ' => 'theta', 'α' => 'alpha', 'β' => 'beta',
            'λ' => 'lambda', 'μ' => 'mu', 'σ' => 'sigma', 'Δ' => 'delta',
            'ε' => 'epsilon', 'δ' => 'delta', 'γ' => 'gamma', '∇' => 'nabla',
            'ℏ' => 'hbar', 'ψ' => 'psi', 'ϕ' => 'phi', 'ω' => 'omega',
            '≤' => '<=', '≥' => '>=', '≠' => '!=', '≈' => '=', '≡' => '=',
            '→' => '->', '⇒' => '=>', '⇔' => '<=>', '↔' => '<->',
            '∈' => 'in', '∉' => 'not in', '∀' => 'for all', '∃' => 'there exists'
        ];

        $text = strtr($text, $unicodeMap);

        // 9. Spacing & Punctuation Cleanup
        $text = preg_replace('/\s+/', ' ', $text);

        return trim($text);
    }
}
