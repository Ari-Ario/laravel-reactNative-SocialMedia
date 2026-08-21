<?php

namespace Tests\Unit;

use PHPUnit\Framework\TestCase;
use App\Services\AST\Tokenizer;
use App\Services\AST\Parser;
use App\Services\CAS\ComputerAlgebraSystem;

class CASTest extends TestCase
{
    public function test_math_substitution()
    {
        $tokenizer = new Tokenizer();
        $parser = new Parser();
        $cas = new ComputerAlgebraSystem();

        $input = "x = y + 1. y = 2. x = 3.";
        $tokens = $tokenizer->tokenize($input);
        $ast = $parser->parse($tokens);

        $result = $cas->evaluateAST($ast);

        $this->assertNotNull($result);
        $this->assertEquals('proven', $result['status']);
        $this->assertStringContainsString('`x = 3`', $result['proof']);
    }

    public function test_math_transitivity()
    {
        $tokenizer = new Tokenizer();
        $parser = new Parser();
        $cas = new ComputerAlgebraSystem();

        $input = "a > b. b > c. a > c.";
        $tokens = $tokenizer->tokenize($input);
        $ast = $parser->parse($tokens);

        $result = $cas->evaluateAST($ast);

        $this->assertNotNull($result);
        $this->assertEquals('proven', $result['status']);
        $this->assertStringContainsString('`a > c`', $result['proof']);
    }
}
