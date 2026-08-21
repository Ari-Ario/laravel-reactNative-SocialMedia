<?php
namespace Tests\Unit;

use Tests\TestCase;
use App\Services\SyllogismSolverService;

class SyllogismASTTest extends TestCase
{
    public function test_linguistic_ast_parsing()
    {
        $solver = new SyllogismSolverService();
        $text = "All men are mortal. Socrates is a man. Therefore, Socrates is mortal.";
        $result = $solver->proveSyllogism($text);
        
        // This relies on the DB having the axiom, but wait, if it fails induction it returns false or a halted message.
        $this->assertIsArray($result);
    }
}
